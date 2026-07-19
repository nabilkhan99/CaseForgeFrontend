/**
 * Normalise candidate-brief markdown before rendering.
 *
 * Station briefs are authored with inline bold labels ("**Allergies:** Nil
 * significant. **Recent Notes:** ...") that run together into one paragraph —
 * and a label can end up dangling at the end of the previous item. Give every
 * bold label its own block so the brief reads like the exam paper it mimics.
 */
export function formatBriefMarkdown(markdown: string): string {
    if (!markdown) return '';
    return (
        markdown
            // Start a new paragraph at each inline bold label ("**Label:**") that
            // follows sentence content — a label that already opens its line or
            // bullet stays put. No lookbehind — older Safari throws on lookbehind
            // at regex parse time.
            .replace(/([.!?;:)a-zA-Z0-9"'”])[ \t]+(\*\*[^*\n]{2,48}?:\*\*)/g, '$1\n\n$2')
            .trim()
    );
}
