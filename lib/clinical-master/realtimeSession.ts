/**
 * Azure gpt-realtime session configuration.
 *
 * Builds the session-config payload posted to the Azure
 * `/openai/v1/realtime/client_secrets` endpoint (server-side, in the
 * realtime-token routes) and the function-tool definitions + examination
 * logic that the client handles over the data channel.
 *
 * The patient persona, two-step greeting, and examination behaviour are
 * carried over from the former LiveKit Python agent.
 */

import { buildPatientPrompt, StationData } from './patientPrompt';

/** Default patient voice. gpt-realtime voices: alloy, ash, ballad, coral,
 *  echo, sage, shimmer, verse, marin, cedar. "marin" is a newer natural voice. */
export const DEFAULT_VOICE = 'marin';

/** Voice used when the person speaking to the doctor is female (the default). */
export const FEMALE_VOICE = 'marin';
/** Voice used when the person speaking to the doctor is male. "cedar" is marin's
 *  natural male counterpart in the gpt-realtime voice set. */
export const MALE_VOICE = 'cedar';

/**
 * Pick the patient voice from the station's `voice_gender` — the gender of the
 * person the doctor actually speaks to (the standardised patient, or, in a
 * paediatric / third-party case, the parent, carer, or paramedic voicing the
 * case). Falls back to the default female voice when gender is unknown, so
 * behaviour is unchanged for any station that hasn't been tagged yet.
 */
export function voiceForStation(
  station?: { voice_gender?: string | null } | null
): string {
  const g = (station?.voice_gender ?? '').toString().trim().toLowerCase();
  if (g === 'male' || g === 'm' || g === 'man' || g === 'boy') return MALE_VOICE;
  if (g === 'female' || g === 'f' || g === 'woman' || g === 'girl') return FEMALE_VOICE;
  return DEFAULT_VOICE;
}

/** Model used to transcribe the doctor's microphone audio (so we capture the
 *  user side of the transcript). whisper-1 is the most broadly available. */
export const DEFAULT_TRANSCRIPTION_MODEL = 'whisper-1';

/**
 * Function tools exposed to the model. Examination is intentionally NOT a tool:
 * per Build Package Section 1.1 (audio only, no live visual examination) and
 * Voice Actor Prompt 1 rule 8, the patient handles any examination request
 * in-character, giving scripted findings or a neutral/negative answer and never
 * inventing a new clinical finding.
 */
export const REALTIME_TOOLS = [
  {
    type: 'function',
    name: 'end_consultation',
    description:
      'Call this when the doctor clearly indicates the consultation is over — ' +
      'for example they say goodbye, summarise and close, or state the appointment is finished.',
    parameters: {
      type: 'object',
      properties: {},
      required: [],
    },
  },
] as const;

export interface SessionConfigOptions {
  /** Azure deployment name, e.g. "gpt-realtime-2". */
  model: string;
  voice?: string;
  transcriptionModel?: string;
  /**
   * The connecting browser's echo cancellation can't be trusted
   * (Safari, Firefox, anything on iOS): playback of the patient's own
   * voice leaks back into the mic, trips server VAD, and the patient
   * interrupts itself / answers itself. For these browsers the session
   * is hardened server-side (community-validated combination):
   *  - far_field noise reduction, which filters the input BEFORE VAD so
   *    the leaked echo doesn't register as speech;
   *  - VAD threshold 0.75 instead of 0.5;
   *  - interrupt_response: false so residual echo can never cancel the
   *    patient mid-sentence.
   * Chrome-family browsers have reliable AEC and keep the defaults,
   * including barge-in.
   */
  unreliableAec?: boolean;
}

/**
 * Build the `{ session: {...} }` payload for the Azure client_secrets request.
 * The patient prompt is injected as `instructions`.
 */
export function buildSessionPayload(stationData: StationData | null, opts: SessionConfigOptions) {
  const instructions = buildPatientPrompt(stationData);

  return {
    session: {
      type: 'realtime',
      model: opts.model,
      instructions,
      tools: REALTIME_TOOLS,
      tool_choice: 'auto',
      // Stream input-transcription logprobs so we can derive a per-turn ASR
      // confidence for the candidate's speech (Build Package Section 3.1).
      include: ['item.input_audio_transcription.logprobs'],
      audio: {
        input: {
          transcription: {
            model: opts.transcriptionModel ?? DEFAULT_TRANSCRIPTION_MODEL,
          },
          // Reliable-AEC browsers: relaxed server VAD so the trainee isn't
          // cut off mid-sentence (mirrors the old LiveKit endpointing).
          // Unreliable-AEC browsers (Safari/Firefox/iOS): server VAD is
          // DISABLED entirely — their echo leak passes every threshold and
          // the patient ends up transcribing and answering its own voice.
          // The client's double-talk detector owns turn-taking instead: it
          // commits the input buffer and requests the response itself
          // (useRealtimeSession.ts), and falls back to server VAD via
          // session.update only if audio analysis is unavailable.
          turn_detection: opts.unreliableAec
            ? null
            : {
                type: 'server_vad',
                threshold: 0.5,
                prefix_padding_ms: 300,
                silence_duration_ms: 900,
              },
          ...(opts.unreliableAec ? { noise_reduction: { type: 'far_field' } } : {}),
        },
        output: {
          voice: opts.voice ?? DEFAULT_VOICE,
        },
      },
    },
  };
}
