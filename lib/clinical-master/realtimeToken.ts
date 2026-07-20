/**
 * Mints a short-lived ephemeral key for the browser to open a WebRTC
 * connection to Azure gpt-realtime. SERVER-ONLY — the real Azure api-key
 * never leaves this module; only the ephemeral token is returned to the client.
 *
 * Azure GA endpoints (no api-version):
 *   POST {endpoint}/openai/v1/realtime/client_secrets   → mint ephemeral key
 *        {endpoint}/openai/v1/realtime/calls            → browser SDP exchange
 */

import { buildSessionPayload, DEFAULT_VOICE } from './realtimeSession';
import type { StationData } from './patientPrompt';

export interface EphemeralKeyResult {
  ephemeralKey: string;
  callsUrl: string;
  model: string;
  voice: string;
}

export interface MintOptions {
  /** See SessionConfigOptions.disableBargeIn. */
  disableBargeIn?: boolean;
}

/**
 * True for browsers whose acoustic echo cancellation leaks the patient's
 * own voice back into the mic (Safari/WebKit, Firefox). Chrome's AEC is
 * reliable, so barge-in stays enabled there. Chrome-family UAs contain
 * "Chrome"/"CriOS"; real Safari and Firefox never do.
 */
export function bargeInUnsupported(userAgent: string | null): boolean {
  if (!userAgent) return false;
  if (/firefox|fxios/i.test(userAgent)) return true;
  // Every iOS browser (including Chrome/CriOS) runs on WebKit, so they all
  // share Safari's echo cancellation.
  if (/iphone|ipad|ipod/i.test(userAgent)) return true;
  const isSafari = /safari/i.test(userAgent) && !/chrome|chromium|crios|edg|android/i.test(userAgent);
  return isSafari;
}

export async function mintEphemeralKey(
  stationData: StationData | null,
  voice: string = DEFAULT_VOICE,
  mintOpts: MintOptions = {}
): Promise<EphemeralKeyResult> {
  const endpoint = process.env.AZURE_OPENAI_REALTIME_ENDPOINT;
  const apiKey = process.env.AZURE_OPENAI_REALTIME_API_KEY;
  const deployment = process.env.AZURE_OPENAI_REALTIME_DEPLOYMENT;

  if (!endpoint || !apiKey || !deployment) {
    throw new Error('Azure realtime credentials not configured');
  }

  const base = endpoint.replace(/\/+$/, '');
  const payload = buildSessionPayload(stationData, {
    model: deployment,
    voice,
    disableBargeIn: mintOpts.disableBargeIn,
  });

  const res = await fetch(`${base}/openai/v1/realtime/client_secrets`, {
    method: 'POST',
    headers: {
      'api-key': apiKey,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });

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
    callsUrl: `${base}/openai/v1/realtime/calls?webrtcfilter=on`,
    model: deployment,
    voice,
  };
}
