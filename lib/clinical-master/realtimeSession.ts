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
          // Relaxed server VAD so the trainee isn't cut off mid-sentence
          // (mirrors the old LiveKit min/max endpointing of 0.8s/3.0s).
          turn_detection: {
            type: 'server_vad',
            threshold: 0.5,
            prefix_padding_ms: 300,
            silence_duration_ms: 900,
          },
        },
        output: {
          voice: opts.voice ?? DEFAULT_VOICE,
        },
      },
    },
  };
}
