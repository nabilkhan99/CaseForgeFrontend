/**
 * Normalise candidate-brief markdown before rendering.
 *
 * Two separate problems, both of which made the brief render as one run-on
 * paragraph — the thing reviewers reported as "not on separate lines":
 *
 * 1. SOFT LINE BREAKS. Briefs are stored with each label on its own line
 *    ("**Patient Name:** Simon Fletcher\n**Age:** 45"), but a single newline in
 *    markdown is a soft wrap, so the renderer joined them into
 *    "Patient Name: Simon Fletcher Age: 45". Every label line now gets a hard
 *    break. This was the actual cause; the inline-label rule below never fired
 *    on these briefs because the labels were already at line starts.
 * 2. INLINE LABELS. Some briefs run labels together on one line
 *    ("**Allergies:** Nil. **Recent Notes:** ..."), so an inline label that
 *    follows sentence content still needs its own block.
 *
 * Also unescapes the literal \" sequences present in stored briefs.
 */
export function formatBriefMarkdown(markdown: string): string {
    if (!markdown) return '';
    return (
        markdown
            // Stored escapes: \" -> "
            .replace(/\\"/g, '"')
            // Start a new paragraph at each inline bold label ("**Label:**") that
            // follows sentence content — a label that already opens its line or
            // bullet stays put. No lookbehind — older Safari throws on lookbehind
            // at regex parse time.
            .replace(/([.!?;:)a-zA-Z0-9"'”])[ \t]+(\*\*[^*\n]{2,48}?:\*\*)/g, '$1\n\n$2')
            // Deliberately NOT collapsing a lone label onto the bullet beneath
            // it: "**Medical Records:**" heads a multi-item list, so a blanket
            // rule breaks the list apart. Where a label should read as one row
            // with its value, that belongs in the stored brief, not here.
            // Single newline -> hard break, so each label keeps its own line.
            // Blank lines (paragraph breaks) and list items are left alone.
            .replace(/([^\n])\n(?!\n|[ \t]*[-*+][ \t]|[ \t]*\d+\.[ \t])/g, '$1  \n')
            .trim()
    );
}
