/**
 * Did the doctor finish a thought, or are they thinking out loud?
 *
 * The client detector commits a doctor turn after ~900ms of quiet, which cannot
 * tell "900ms because I'm done" from "900ms because I'm thinking". Committing is
 * harmless; asking the patient to REPLY to a half-thought is not. Ismat's
 * session: "Okay and um" was committed as a finished turn and the patient
 * answered it by volunteering the painkiller overuse — the diagnostic crux she
 * was there to elicit. The station is then worthless as practice, because she
 * got the finding without asking for it.
 *
 * So the turn is committed either way, and this decides whether to ask for a
 * response. A withheld turn is not lost: it stays in the conversation, and when
 * the doctor does ask their question the model sees both items and answers the
 * real one.
 *
 * PUNCTUATION IS NOT THE SIGNAL. The obvious rule — "no question mark, no
 * reply" — was tested against a real session log and got 2 of 6 wrong: Whisper
 * returned "Tell me more" and "Carry on" with no terminal punctuation, and both
 * are genuine prompts that must be answered.
 *
 * Two rules instead, on the words themselves:
 *   A. every token is discourse noise            -> "Okay", "um", "right yeah"
 *   B. the last token is one no question can end on -> "Okay and um", "so..."
 *
 * The asymmetry drives every judgement call below. Answering filler invalidates
 * the station; withholding on a real short question costs a beat of silence
 * (which is what a real patient does anyway — see rule 12 of the patient
 * prompt), and the caller's stall guard eventually speaks regardless. When a
 * token is arguable, it stays OUT of these sets only if a real question could
 * plausibly end on it.
 */

/**
 * Whole-utterance noise: if the turn is nothing but these, there is no question
 * in it. Deliberately EXCLUDES "sorry", "huh", "what" and "no" — "Sorry?" and
 * "Huh?" ask the patient to repeat themselves, and a bare "No" is usually an
 * answer to something the patient just asked.
 */
const FILLER_TOKENS = new Set([
    'um', 'umm', 'uhm', 'uh', 'uhh', 'er', 'err', 'erm', 'ermm',
    'ah', 'ahh', 'eh', 'oh', 'ooh',
    'mm', 'mmm', 'mhm', 'uhhuh', 'hm', 'hmm', 'hmmm',
    'ok', 'okay', 'okey', 'kay', 'right', 'alright', 'allright',
    'yeah', 'yea', 'yep', 'yup', 'yes', 'sure',
    'and', 'so', 'but', 'well', 'anyway',
    'cool', 'fine', 'good', 'great', 'perfect', 'lovely',
]);

/**
 * Tokens no finished question ends on. Prepositions are absent on purpose —
 * English asks "who do you live with?", "what are you taking it for?", "what
 * are you worried about?", "who did you speak to?". Also absent: "like" ("what
 * does it feel like?"), "is" ("can you show me where the pain is?"), "do"
 * ("what do you do?"), "that" ("how bad is that?"), "then" ("and then?"),
 * "on" ("carry on"), and every wh-word ("Why?", "Where?").
 */
const HANGING_TOKENS = new Set([
    'um', 'umm', 'uhm', 'uh', 'uhh', 'er', 'err', 'erm', 'ermm',
    'ah', 'ahh', 'eh', 'mm', 'mmm', 'hm', 'hmm', 'hmmm',
    'and', 'so', 'but', 'or', 'the', 'a', 'an', 'my', 'your',
    'if', 'because', 'cos', 'cause',
]);

/** Stock thinking-aloud phrases that survive tokenisation as real words. */
const THINKING_PHRASES = [
    'i see',
    'got it',
    'let me see',
    'let me think',
    'let me just think',
    'one moment',
    'one sec',
    'one second',
    'just a moment',
    'just a second',
    'bear with me',
];

/**
 * Normalise for token comparison: lowercase, fold the backchannels that only
 * exist as hyphenated pairs ("uh-huh", "mm-hmm") into single tokens, then drop
 * everything that is not a letter, digit or apostrophe.
 */
function tokenise(text: string): string[] {
    return text
        .toLowerCase()
        .replace(/\buh[\s-]?huh\b/g, 'uhhuh')
        .replace(/\bmm[\s-]?hmm?\b/g, 'mhm')
        .replace(/[^a-z0-9'\s]+/g, ' ')
        .split(/\s+/)
        .filter(Boolean);
}

/**
 * True when this committed turn should NOT trigger a patient response.
 *
 * Empty counts as incomplete: an empty transcription over a committed buffer
 * means the detector opened a turn on room noise, and the patient has nothing
 * to answer.
 */
export function isIncompleteDoctorTurn(text: string): boolean {
    const tokens = tokenise(text ?? '');
    if (tokens.length === 0) return true;

    const joined = tokens.join(' ');
    if (THINKING_PHRASES.includes(joined)) return true;

    // Rule A — nothing but discourse noise.
    if (tokens.every((t) => FILLER_TOKENS.has(t))) return true;

    // Rule B — trailed off mid-thought.
    return HANGING_TOKENS.has(tokens[tokens.length - 1]);
}
