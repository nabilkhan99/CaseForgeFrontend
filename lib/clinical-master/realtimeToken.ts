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
 * The two lanes are different Azure resources with different quota, so they may
 * transcribe with different models — each target therefore carries its own
 * transcription model, read from env for BOTH lanes so the resources can be
 * swapped between the slots without a code change. `callsUrl` is always built
 * from the endpoint that actually minted the key (a key from one region will
 * not authenticate against another region's /calls).
 *
 * `origin` records which SLOT served the session and `lane` which RESOURCE did
 * (e.g. 'fourteenfisherman-voice-us'), so the flight recorder can still tell the
 * regions apart after the slots are swapped.
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
  /** Which slot served this mint. */
  origin: MintOrigin;
  /** Which Azure resource served it, e.g. 'fourteenfisherman-voice-us'. */
  lane: string;
}

export interface MintOptions {
  /** See SessionConfigOptions.unreliableAec. */
  unreliableAec?: boolean;
}

export { unreliableEchoCancellation } from './echoCancellation';

/**
 * Transcription model for the standby slot when its env var is unset.
 *
 * Which transcriber a lane can run is a property of the RESOURCE, not of the
 * slot: gpt-realtime-whisper (DEFAULT_TRANSCRIPTION_MODEL) is GlobalStandard-only
 * and its quota is held entirely by one resource, while gpt-4o-transcribe deploys
 * on DataZoneStandard. Swapping which resource serves the primary slot therefore
 * has to swap the transcriber with it, so both slots read the model from env
 * (AZURE_OPENAI_REALTIME_TRANSCRIPTION_MODEL and the _FALLBACK_ variant) and
 * these constants are only the defaults for an environment that sets neither.
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

/**
 * The Azure resource behind an endpoint: the first label of its host, e.g.
 * `https://fourteenfisherman-voice-us.openai.azure.com/` → `fourteenfisherman-voice-us`.
 * Tolerates a missing scheme and a trailing path; returns 'unknown' rather than
 * throwing, because a mint must never fail over a log label.
 */
export function laneFromEndpoint(endpoint: string): string {
  const host = endpoint.trim().replace(/^[a-z][a-z0-9+.-]*:\/\//i, '').split('/')[0];
  return host.split('.')[0] || 'unknown';
}

interface MintTarget {
  origin: MintOrigin;
  /** Resource name derived from `endpoint` — see laneFromEndpoint. */
  lane: string;
  endpoint: string;
  apiKey: string;
  deployment: string;
  transcriptionModel: string;
  timeoutMs: number;
}

/**
 * Ordered mint targets, best-first. The fallback is included only when both its
 * endpoint and key are set, so an environment without standby credentials
 * behaves exactly as before. `env` is a parameter so the resolution can be
 * tested without touching the process environment.
 */
export function resolveTargets(env: Record<string, string | undefined> = process.env): MintTarget[] {
  const targets: MintTarget[] = [];

  const endpoint = env.AZURE_OPENAI_REALTIME_ENDPOINT;
  const apiKey = env.AZURE_OPENAI_REALTIME_API_KEY;
  const deployment = env.AZURE_OPENAI_REALTIME_DEPLOYMENT;
  if (endpoint && apiKey && deployment) {
    targets.push({
      origin: 'primary',
      lane: laneFromEndpoint(endpoint),
      endpoint,
      apiKey,
      deployment,
      transcriptionModel:
        env.AZURE_OPENAI_REALTIME_TRANSCRIPTION_MODEL || DEFAULT_TRANSCRIPTION_MODEL,
      timeoutMs: PRIMARY_TIMEOUT_MS,
    });
  }

  const fallbackEndpoint = env.AZURE_OPENAI_REALTIME_FALLBACK_ENDPOINT;
  const fallbackApiKey = env.AZURE_OPENAI_REALTIME_FALLBACK_API_KEY;
  if (fallbackEndpoint && fallbackApiKey) {
    targets.push({
      origin: 'fallback',
      lane: laneFromEndpoint(fallbackEndpoint),
      endpoint: fallbackEndpoint,
      apiKey: fallbackApiKey,
      deployment: env.AZURE_OPENAI_REALTIME_FALLBACK_DEPLOYMENT || FALLBACK_DEPLOYMENT,
      transcriptionModel:
        env.AZURE_OPENAI_REALTIME_FALLBACK_TRANSCRIPTION_MODEL || FALLBACK_TRANSCRIPTION_MODEL,
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
    lane: target.lane,
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
      console.warn(`[realtime-token] ${target.origin} (${target.lane}) mint failed: ${reason}`);
      failures.push(`${target.origin} (${reason})`);
    }
  }

  throw new Error(`All realtime mint targets failed — tried ${failures.join('; ')}`);
}
