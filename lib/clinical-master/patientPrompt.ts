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
 *
 * HISTORY — why this is written so defensively. The original pair of regexes
 * removed a parenthesis group and an asterisk-delimited group, and both of
 * their character classes matched newlines. The scripts are markdown (bold
 * headers, italic "If asked about X" triggers), so the asterisk rule paired
 * markers blindly across the whole document and deleted everything between
 * them. Measured against all 79 active stations it
 * destroyed an average of 80% of every script — on the medication-overuse case
 * the words "co-codamol", "ibuprofen" and "brain tumour" never reached the
 * model at all, while a bare list of answers survived with every "If asked..."
 * trigger stripped off. That is what made the patient recite unprompted
 * negatives and answer questions nobody asked.
 *
 * Rules now: emphasis markers are UNWRAPPED, never deleted with their contents;
 * parentheses are removed only when they look like an actor note, so clinical
 * parentheticals such as "Co-codamol (paracetamol and codeine)" and "(128/82)"
 * survive. See patientPrompt.test.ts — it asserts retention across real scripts.
 */

/** Words that mark a parenthetical as an actor note rather than clinical detail. */
const ACTOR_NOTE_OPENERS = [
  'wearing', 'holding', 'holds', 'looking', 'looks', 'sounding', 'sounds',
  'pause', 'pauses', 'paused', 'pausing', 'wince', 'winces', 'wincing',
  'sigh', 'sighs', 'sighing', 'cough', 'coughs', 'coughing', 'cries',
  'crying', 'tearful', 'shrug', 'shrugs', 'nods', 'nodding', 'gesture',
  'gestures', 'gesturing', 'rubs', 'rubbing', 'clutches', 'clutching',
  'leans', 'leaning', 'smiles', 'smiling', 'frowns', 'frowning', 'quietly',
  'softly', 'hesitates', 'hesitating', 'actor guidance', 'note to actor',
  'actor note', 'aside',
];

// `note:` deliberately handled separately. As a plain opener it could never
// match: the list is joined and followed by \b, and a colon is a non-word
// character, so \b then demands a word character where "(Note: Candidate..."
// has a space. That silently let assessment notes through.
const ACTOR_NOTE_RE = new RegExp(
  `\\((?:(?:${ACTOR_NOTE_OPENERS.join('|')})\\b|note\\s*:)[^)\\n]{0,200}\\)\\s*`,
  'gi'
);

/**
 * Assessment language must NEVER reach the patient — it tells the actor how the
 * candidate is being scored, which is the one thing that can invalidate the
 * station. Some scripts carry mark-scheme notes inline, e.g.
 *   (Note: Candidate critically fails for worsening a Medication Overuse Headache)
 * The old catch-all paren strip hid these by accident; once parentheses were
 * preserved for clinical detail, they became visible to the model. Stripped
 * explicitly on content, whatever the wrapper looks like.
 */
// Anchored on the opening parenthesis. An earlier version made it optional so
// it could also catch unwrapped notes — but with no left anchor the match ran
// backwards into the patient's own dialogue and deleted the line it was
// attached to. Every leak observed in the real scripts is parenthesised, so
// requiring "(" is both sufficient and safe.
// NB "examiner" alone is NOT a marker of assessment leakage — real cases
// legitimately reference an "Aeromedical Examiner" (CAA pilot medicals) and the
// NHS "Medical Examiner" system (death review). Both are clinical facts the
// patient should know. Only an examiner *doing the marking* counts.
const ASSESSMENT_LEAK_RE =
  /\(\s*[^)\n]{0,100}?\b(?:critically fails?|candidate (?:critically )?(?:fails?|passes|scores?)|mark scheme|marking scheme|examiner (?:expects|awards|wants|is looking|will mark)|clear fail|clear pass|awards? (?:a )?(?:pass|fail))\b[^)\n]{0,200}\)\s*/gi;

export function stripStageDirections(text: string): string {
  if (!text) return text;
  let out = text;

  // Scripts are stored with escaped quotes in places; unescape before parsing.
  out = out.replace(/\\"/g, '"');

  // Asterisk actions on their own — "*holds jaw*" — are true stage directions.
  // Constrained to a single line so a pair can never span the document.
  out = out.replace(/^[ \t]*\*[^*\n]{0,120}\*[ \t]*$/gm, '');

  // Remaining emphasis: unwrap the markers, KEEP the text. Longest first.
  out = out.replace(/\*\*\*([^*\n]+)\*\*\*/g, '$1');
  out = out.replace(/\*\*([^*\n]+)\*\*/g, '$1');
  out = out.replace(/\*([^*\n]+)\*/g, '$1');
  out = out.replace(/\*/g, ''); // sweep unmatched strays

  // Assessment language first — before the emphasis unwrap has finished
  // reshaping the line, and regardless of how it is wrapped.
  out = out.replace(ASSESSMENT_LEAK_RE, ' ');

  // Parentheses: only actor notes, never clinical parentheticals.
  out = out.replace(ACTOR_NOTE_RE, '');

  out = out.replace(/^"(.*)"$/gm, '$1');
  out = out.replace(/[ \t]{2,}/g, ' ');
  // Tidy punctuation orphaned by a removed note, e.g. '..." .' -> '..."'
  out = out.replace(/[ \t]+([.,;:])/g, '$1');
  out = out.replace(/(["'”’])\s*\.\s*$/gm, '$1');
  out = out.replace(/\n{3,}/g, '\n\n');
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

// The voice-output rules used to live here as VOICE_OUTPUT_GUARD. They are a
// STANDING rule, so they now sit with the rest of them at the end of
// VOICE_ACTOR_PROMPT — one file for how to behave, Supabase for the case.

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

  return `${VOICE_ACTOR_PROMPT}\n\n${caseBlock}\n`;
}
