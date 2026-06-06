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

/** Function tools exposed to the model, mirroring the former @function_tool methods. */
export const REALTIME_TOOLS = [
  {
    type: 'function',
    name: 'request_examination',
    description:
      'Call this when the doctor asks to perform a physical examination on you ' +
      '(e.g. blood pressure, abdominal, chest, neurological). It returns how you ' +
      'cooperate and what is found, which you then describe as the patient.',
    parameters: {
      type: 'object',
      properties: {
        examination_type: {
          type: 'string',
          description:
            'The type of examination being requested, e.g. "blood pressure", "abdominal", "chest", "neurological".',
        },
      },
      required: ['examination_type'],
    },
  },
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

/**
 * Guidance returned to the model when the doctor requests a physical
 * examination (the `request_examination` tool output). Carries the intent of
 * the former Python `request_examination` @function_tool, but station-free:
 * the model already holds the full scenario in its server-side instructions, so
 * we never need to send the patient script to the browser. The instruction
 * preserves the original guardrail — report no abnormality when the scenario
 * doesn't specify findings — so the model doesn't invent results.
 */
export function getExaminationGuidance(examinationType: string): string {
  return (
    `The patient cooperates with the ${examinationType} examination. ` +
    'Describe realistic findings drawn from your clinical scenario. ' +
    'If your scenario does not specify findings for this examination, report no significant abnormality. ' +
    'Respond as the patient would — describe what you feel, not clinical measurements.'
  );
}
