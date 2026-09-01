/**
 * The presenting complaint, pulled out of the candidate brief.
 *
 * `stations` has no presenting-complaint column, but every brief but one
 * carries a "Reason for Encounter" line — the sentence the patient booked the
 * appointment with. That sentence is what a trainee actually searches for
 * ("chest pain", "HIV test", "med review"), whereas the title is a curated
 * one-liner that often uses none of those words.
 *
 * Two brief layouts exist and both appear in production:
 *
 *   **Reason for Encounter:**
 *   \"Patient complaining of daily headaches...\"
 *   **Medical Records:**
 *
 *   - **Reason for Encounter:** "Requests HIV testing after a recent incident."
 *   - **Last BP/BMI:** ...
 *
 * so the value runs from the heading to the next bold heading (bulleted or
 * not), and is capped — this feeds a search index and a one-line row caption,
 * not a reading surface.
 */

const HEADING = /\*{0,2}\s*reason for encounter\s*\*{0,2}\s*:\s*/i;

/** Next bold heading, with or without a list marker in front of it. */
const NEXT_HEADING = /\n\s*(?:[-*+]\s+)?\*\*/;

const MAX_LENGTH = 240;

export function extractPresentingComplaint(candidateInstructions?: string | null): string {
    if (!candidateInstructions) return '';

    const match = HEADING.exec(candidateInstructions);
    if (!match) return '';

    let value = candidateInstructions.slice(match.index + match[0].length);

    const stop = value.search(NEXT_HEADING);
    if (stop !== -1) value = value.slice(0, stop);

    return tidy(value);
}

function tidy(value: string): string {
    const cleaned = value
        // Briefs written through JSON carry literal backslash-escaped quotes.
        .replace(/\\+(["'])/g, '$1')
        // Emphasis markers: some briefs italicise the triage note inside the line.
        .replace(/\*+/g, '')
        .replace(/\s+/g, ' ')
        .trim()
        // Strip the wrapping quotes; the row renders its own punctuation.
        .replace(/^["'“‘]+/, '')
        .replace(/["'”’]+$/, '')
        .trim();

    if (cleaned.length <= MAX_LENGTH) return cleaned;
    // Cut on a word boundary so the caption never ends mid-word.
    const cut = cleaned.slice(0, MAX_LENGTH);
    const lastSpace = cut.lastIndexOf(' ');
    return `${(lastSpace > MAX_LENGTH * 0.6 ? cut.slice(0, lastSpace) : cut).trimEnd()}…`;
}
