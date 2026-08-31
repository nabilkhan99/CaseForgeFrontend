/**
 * Mints a short-lived ephemeral key for the browser to open a WebRTC
 * connection to Azure gpt-realtime. SERVER-ONLY — the real Azure api-key
 * never leaves this module; only the ephemeral token is returned to the client.
 *
 * Azure GA endpoints (no api-version):
 *   POST {endpoint}/openai/v1/realtime/client_secrets   → mint ephemeral key
 *        {endpoint}/openai/v1/realtime/calls            → browser SDP exchange
 *
 * REGIONAL FAILOVER
 * -----------------
 * The 31 Aug 2026 eastus2 realtime outage took voice down with no second lane
 * to fall back to — every consultation failed at this mint until the resource
 * was repointed by hand. Minting now walks an ORDERED list of regional targets
 * (primary, then an optional standby in another region) and the first target to
 * answer serves the consultation. Each attempt is bounded by an AbortController
 * deadline, so a region that hangs costs seconds rather than the whole request.
 *
 * The standby is a different Azure resource with different quota, so it may
 * transcribe with a different model — each target therefore carries its own
 * transcription model, and `callsUrl` is always built from the endpoint that
 * actually minted the key (a key from one region will not authenticate against
 * another region's /calls).
 *
 * `origin` records which lane served the session so the flight recorder can
 * attribute it afterwards.
 */

import {
  buildSessionPayload,
  DEFAULT_VOICE,
  DEFAULT_TRANSCRIPTION_MODEL,
} from './realtimeSession';
import type { StationData } from './patientPrompt';

/** Which regional lane minted a key. */
export type MintOrigin = 'primary' | 'fallback';

export interface EphemeralKeyResult {
  ephemeralKey: string;
  callsUrl: string;
  model: string;
  voice: string;
  /** Regional lane that served this mint. */
  origin: MintOrigin;
}

export interface MintOptions {
  /** See SessionConfigOptions.unreliableAec. */
  unreliableAec?: boolean;
}

export { unreliableEchoCancellation } from './echoCancellation';

/**
 * Transcription model for the standby lane.
 *
 * gpt-realtime-whisper — the primary's model, see DEFAULT_TRANSCRIPTION_MODEL —
 * is GlobalStandard-only and its quota is fully held by the primary region, so
 * it cannot be deployed on the standby. gpt-4o-transcribe is the closest
 * available substitute there and deploys on DataZoneStandard.
 */
const FALLBACK_TRANSCRIPTION_MODEL = 'gpt-4o-transcribe';

/** Fallback deployment name when the env var is unset. */
const FALLBACK_DEPLOYMENT = 'gpt-realtime-2';

/**
 * Per-target mint deadlines. The primary gets a tight budget so a dead region
 * costs the trainee ~5s before the standby is tried; the standby gets longer
 * because by then it is the only lane left and giving up helps nobody.
 */
const PRIMARY_TIMEOUT_MS = 5000;
const FALLBACK_TIMEOUT_MS = 8000;

interface MintTarget {
  origin: MintOrigin;
  endpoint: string;
  apiKey: string;
  deployment: string;
  transcriptionModel: string;
  timeoutMs: number;
}

/**
 * Ordered mint targets, best-first. The fallback is included only when both its
 * endpoint and key are set, so an environment without standby credentials
 * behaves exactly as before.
 */
function resolveTargets(): MintTarget[] {
  const targets: MintTarget[] = [];

  const endpoint = process.env.AZURE_OPENAI_REALTIME_ENDPOINT;
  const apiKey = process.env.AZURE_OPENAI_REALTIME_API_KEY;
  const deployment = process.env.AZURE_OPENAI_REALTIME_DEPLOYMENT;
  if (endpoint && apiKey && deployment) {
    targets.push({
      origin: 'primary',
      endpoint,
      apiKey,
      deployment,
      transcriptionModel: DEFAULT_TRANSCRIPTION_MODEL,
      timeoutMs: PRIMARY_TIMEOUT_MS,
    });
  }

  const fallbackEndpoint = process.env.AZURE_OPENAI_REALTIME_FALLBACK_ENDPOINT;
  const fallbackApiKey = process.env.AZURE_OPENAI_REALTIME_FALLBACK_API_KEY;
  if (fallbackEndpoint && fallbackApiKey) {
    targets.push({
      origin: 'fallback',
      endpoint: fallbackEndpoint,
      apiKey: fallbackApiKey,
      deployment: process.env.AZURE_OPENAI_REALTIME_FALLBACK_DEPLOYMENT || FALLBACK_DEPLOYMENT,
      transcriptionModel:
        process.env.AZURE_OPENAI_REALTIME_FALLBACK_TRANSCRIPTION_MODEL ||
        FALLBACK_TRANSCRIPTION_MODEL,
      timeoutMs: FALLBACK_TIMEOUT_MS,
    });
  }

  return targets;
}

/** Mint against one region. Throws on timeout, transport error, or non-OK. */
async function mintFromTarget(
  target: MintTarget,
  stationData: StationData | null,
  voice: string,
  mintOpts: MintOptions
): Promise<EphemeralKeyResult> {
  const base = target.endpoint.replace(/\/+$/, '');
  const payload = buildSessionPayload(stationData, {
    model: target.deployment,
    voice,
    transcriptionModel: target.transcriptionModel,
    unreliableAec: mintOpts.unreliableAec,
  });

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), target.timeoutMs);

  let res: Response;
  try {
    res = await fetch(`${base}/openai/v1/realtime/client_secrets`, {
      method: 'POST',
      headers: {
        'api-key': target.apiKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timer);
  }

  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`Azure client_secrets failed (${res.status}): ${text.slice(0, 300)}`);
  }

  const data = await res.json();
  // GA response carries the ephemeral token in `value` (older shapes nest it under client_secret).
  const ephemeralKey: string | undefined = data?.value ?? data?.client_secret?.value;
  if (!ephemeralKey) {
    throw new Error('No ephemeral key in Azure response');
  }

  return {
    ephemeralKey,
    // Built from THIS target's endpoint — an ephemeral key is only valid
    // against the region that issued it.
    callsUrl: `${base}/openai/v1/realtime/calls?webrtcfilter=on`,
    model: target.deployment,
    voice,
    origin: target.origin,
  };
}

/** Describe a failure compactly enough for one server log line. */
function describeFailure(err: unknown, timeoutMs: number): string {
  if (err instanceof Error) {
    // An aborted fetch surfaces as AbortError (undici may wrap it in a
    // TimeoutError-ish DOMException); either way the cause is our deadline.
    if (err.name === 'AbortError' || err.name === 'TimeoutError') {
      return `timed out after ${timeoutMs}ms`;
    }
    return err.message;
  }
  return String(err);
}

export async function mintEphemeralKey(
  stationData: StationData | null,
  voice: string = DEFAULT_VOICE,
  mintOpts: MintOptions = {}
): Promise<EphemeralKeyResult> {
  const targets = resolveTargets();
  if (targets.length === 0) {
    throw new Error('Azure realtime credentials not configured');
  }

  const failures: string[] = [];

  for (const target of targets) {
    try {
      return await mintFromTarget(target, stationData, voice, mintOpts);
    } catch (err) {
      const reason = describeFailure(err, target.timeoutMs);
      console.warn(`[realtime-token] ${target.origin} mint failed: ${reason}`);
      failures.push(`${target.origin} (${reason})`);
    }
  }

  throw new Error(`All realtime mint targets failed — tried ${failures.join('; ')}`);
}
