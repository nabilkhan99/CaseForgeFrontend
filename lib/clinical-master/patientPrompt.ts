/**
 * Patient Prompt Builder (full Voice Actor Specification fidelity).
 *
 * The standing behaviour is the verbatim Voice Actor prompt (Runtime Prompts,
 * Prompt 1 / Voice Actor Specification Appendix A): persona inference, the golden
 * minute, disclosure discipline, cues offered once, known-diagnosis exception,
 * no-stonewall, scripted patient requests, management negotiation, third party
 * handling. The case binding (candidate brief + patient script) is appended.
 *
 * The fence holds: only the candidate brief and patient script are sent to the
 * voice model, never the mark scheme or learning points.
 */
import { VOICE_ACTOR_PROMPT } from './voiceActorPrompt';

export interface StationData {
  patient_name?: string | null;
  patient_age?: string | number | null;
  title?: string | null;
  consultation_type?: string | null;
  station_script?: string | null;
  candidate_instructions?: string | null;
  [key: string]: unknown;
}

/**
 * Remove stage directions and action markers from script text. The output is
 * spoken by a speech-to-speech model, so parentheticals like "(wearing
 * sunglasses)" and asterisk actions like "*holds jaw*" must not reach it.
 */
export function stripStageDirections(text: string): string {
  if (!text) return text;
  let out = text;
  out = out.replace(/\([^)]*\)\s*/g, '');
  out = out.replace(/\*[^*]+\*\s*/g, '');
  out = out.replace(/^"(.*)"$/gm, '$1');
  out = out.replace(/ {2,}/g, ' ');
  out = out.replace(/\n\s*\n\s*\n/g, '\n\n');
  return out.trim();
}

const DEFAULT_NAME = 'the patient';
const DEFAULT_AGE = 'adult';

const CONSULTATION_TYPE_MAP: Record<string, string> = {
  'face-to-face': 'an in-person GP surgery consultation',
  telephone: 'a telephone consultation',
  video: 'a video consultation',
  'home visit': 'a home visit by the GP',
};

const VOICE_OUTPUT_GUARD = `# VOICE OUTPUT FORMAT (this is a live speech-to-speech consultation)
- Speak ONLY the words you would say aloud. No narration, no stage directions, no asterisks, no parentheses, no bracketed actions.
- Convey emotion through tone, pace, pauses, and word choice, never through written action tags.
- Speak natural, conversational British English.`;

/**
 * Build the complete patient system prompt from station data.
 *
 * Station fields used: patient_name, patient_age, title, consultation_type,
 * candidate_instructions (the candidate brief), station_script (the patient
 * script: character, history, ICE, reactions). The actor infers from these
 * whether it is the patient or a third party (parent, carer, paramedic).
 */
export function buildPatientPrompt(stationData?: StationData | null): string {
  const patientName = (stationData?.patient_name ?? DEFAULT_NAME).toString();
  const patientAge = (stationData?.patient_age ?? DEFAULT_AGE).toString();
  const title = (stationData?.title ?? 'this case').toString();
  const consultationType = (stationData?.consultation_type ?? 'face-to-face').toString();
  const consultationDescription =
    CONSULTATION_TYPE_MAP[consultationType.toLowerCase()] ?? 'a GP consultation';

  const candidateBrief = (stationData?.candidate_instructions ?? '').toString().trim();
  const rawScript = (stationData?.station_script ?? '').toString();
  const patientScript = rawScript ? stripStageDirections(rawScript) : '';

  const caseBlock = [
    '# YOUR CASE',
    `This is ${consultationDescription}. Read the candidate brief and the patient script below, work out exactly who you are (the patient, or a parent, carer, or paramedic speaking about the patient), and stay in that single role for the whole consultation.`,
    '',
    '## Identity',
    `Name: ${patientName}`,
    `Age: ${patientAge}`,
    `Case: ${title}`,
    '',
    '## Candidate brief (what the doctor was given to read)',
    candidateBrief || 'No candidate brief provided for this case.',
    '',
    '## Patient script (your character, history, ideas, concerns, expectations, and how you react to management)',
    patientScript || 'No patient script provided. React naturally and stay in character.',
  ].join('\n');

  return `${VOICE_ACTOR_PROMPT}\n\n${VOICE_OUTPUT_GUARD}\n\n${caseBlock}\n`;
}
