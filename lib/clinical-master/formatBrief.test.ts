import { describe, expect, it } from 'vitest';
import { formatBriefMarkdown, stripMarkdownImages } from './formatBrief';

// Shaped like the stored briefs: an examination label, the photo description,
// then the image line that used to render (or break) under it.
const BRIEF_WITH_PHOTO = [
    '**Patient Name:** Paul Whitmore',
    '**Age:** 56',
    '',
    '**Examination (Visual provided during consult):**',
    '',
    '- **Photograph (uploaded before the call):** A band of grouped vesicles.',
    '',
    '![Uploaded photo of dermatomal shingles rash — ASSET TO CREATE](/images/cases/shingles-dermatome-1.png)',
].join('\n');

describe('stripMarkdownImages', () => {
    it('removes an image line and the description stays', () => {
        const out = stripMarkdownImages(BRIEF_WITH_PHOTO);
        expect(out).not.toContain('![');
        expect(out).not.toContain('/images/cases/');
        expect(out).not.toContain('ASSET TO CREATE');
        expect(out).toContain('A band of grouped vesicles.');
        expect(out.endsWith('vesicles.')).toBe(true);
    });

    it('removes consecutive image lines without leaving a run of blank lines', () => {
        const out = stripMarkdownImages('Intro.\n\n![a](/a.png)\n\n![b](/b.png)\n\nAfter.');
        expect(out).toBe('Intro.\n\nAfter.');
    });

    it('removes an image written inline in a sentence', () => {
        expect(stripMarkdownImages('See this ![x](/x.png) photo.')).toBe('See this  photo.');
    });

    it('leaves ordinary links and text alone', () => {
        const text = 'Read [the guidance](https://example.org) and stop! [not an image]';
        expect(stripMarkdownImages(text)).toBe(text);
    });

    it('handles empty input', () => {
        expect(stripMarkdownImages('')).toBe('');
    });
});

describe('formatBriefMarkdown', () => {
    it('never passes a markdown image to the renderer', () => {
        const out = formatBriefMarkdown(BRIEF_WITH_PHOTO);
        expect(out).not.toMatch(/!\[[^\]]*\]\([^)]*\)/);
        expect(out).toContain('**Age:** 56');
    });

    it('still gives each label line a hard break', () => {
        expect(formatBriefMarkdown('**Patient Name:** Simon\n**Age:** 45')).toBe('**Patient Name:** Simon  \n**Age:** 45');
    });
});
