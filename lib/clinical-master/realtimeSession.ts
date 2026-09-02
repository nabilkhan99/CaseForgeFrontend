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

/**
 * Model used to transcribe the DOCTOR's microphone audio.
 *
 * Only the doctor's side goes through this. The patient's side comes back as
 * `response.output_audio_transcript.done` — the model reporting what it just
 * generated — so it is accurate by construction. Measured on one 112-turn
 * session: patient turns averaged 11 words with 2 artefacts, doctor turns
 * averaged 5 words with 14 turns of two words or fewer. Every garbled line in
 * the transcript came from this model, not from the consultation.
 *
 * That matters beyond the record: gpt-realtime is speech-to-speech, so the
 * patient answers from the AUDIO and never reads this text (the response is
 * requested 483-1771ms BEFORE the transcript arrives, 57/57 turns in that
 * session). But the MARKER reads only this text — so ASR errors here become
 * unfair feedback, e.g. "any weight loss?" transcribed "Anyway, loss." then
 * marked as a question never asked.
 *
 * whisper-1 dates from the original API and is the weakest option available.
 * gpt-realtime-whisper (2026-05-06) is purpose-built for this slot; OpenAI's
 * realtime guidance names it directly as the streaming transcription path.
 * Deployed on the realtime resource, so the name resolves either as a raw
 * model id on the /openai/v1 surface or as a deployment name.
 */
export const DEFAULT_TRANSCRIPTION_MODEL = 'gpt-realtime-whisper';

/**
 * Pin transcription to English.
 *
 * Left unset, Whisper detects the language per segment — and on breath, room
 * noise or a half-second of silence it will confidently return a phrase in a
 * language nobody spoke. Observed in one 3-minute session on 26 Jul: a doctor
 * turn transcribed as "هواي" (Arabic) and another as "ürün" (Turkish). The
 * second one was answered, and the patient replied with meta-commentary because
 * there was no question to answer.
 *
 * This is an English-language exam, so there is nothing to lose by pinning it,
 * and the language hint also improves accuracy on the accented English the SCA
 * is full of — the decoder stops spending probability mass on other languages.
 */
export const TRANSCRIPTION_LANGUAGE = 'en';

/**
 * End-of-turn silence: how long the doctor must be quiet before the turn is
 * treated as over.
 *
 * ONE number for BOTH turn-taking paths, because they must not drift apart.
 * The reliable-AEC path hands it to server VAD as `silence_duration_ms` below;
 * the unreliable-AEC path counts it out in 50ms frames in the client detector
 * (`DT_END_SILENCE_FRAMES` in useRealtimeSession.ts). A doctor on Safari and a
 * doctor on Chrome should feel the same patient.
 *
 * 700ms, down from 900ms: this wait is dead air on the front of every single
 * reply, so 200ms off it is the cheapest felt-latency saving available. The
 * trade is that a thinking pause mid-question is now slightly more likely to be
 * read as the end of a turn — survivable because committing a turn does not
 * itself ask for a reply (`create_response: false`); the transcript gate in
 * doctorTurn.ts still decides whether the patient answers.
 */
export const END_OF_TURN_SILENCE_MS = 700;

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
   * is hardened server-side:
   *  - far_field noise reduction, which filters the input BEFORE VAD so
   *    the leaked echo doesn't register as speech;
   *  - turn_detection: null — server VAD is switched OFF entirely, and the
   *    client-side double-talk detector in useRealtimeSession.ts owns turns
   *    instead (see DT_* constants there for the real thresholds).
   * Chrome-family browsers have reliable AEC and keep the defaults —
   * server_vad at threshold 0.5 with 700ms silence, and barge-in.
   *
   * NB this comment used to describe "VAD threshold 0.75 and
   * interrupt_response: false", which the code has not done since server VAD
   * was turned off for these browsers. That combination now only exists in the
   * no-WebAudio fallback further down useRealtimeSession.ts. Correcting it
   * because the stale version sends you looking for tuning knobs that are not
   * in play on this path.
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
            language: TRANSCRIPTION_LANGUAGE,
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
                silence_duration_ms: END_OF_TURN_SILENCE_MS,
                // The server still detects turns and commits the buffer, but it
                // does NOT get to decide that a reply is due. 700ms of quiet
                // cannot tell "I have finished my question" from "I am thinking
                // mid-sentence", and on this path the patient was answering
                // fillers and cutting in on half-finished questions — reported
                // as "when I would start a question it would interrupt and then
                // pause". The client now gates the reply on the transcript, the
                // same way it already does on the Safari path
                // (useRealtimeSession.ts → doctorTurn.ts), so both paths get the
                // same protection instead of only one.
                create_response: false,
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
