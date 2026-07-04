import { SCA_PILLAR_PATH } from '@/lib/guides/scaPillarGuide';

/**
 * Content model for the SCA sub-guides.
 *
 * Article body text is stored close to verbatim. Two inline conventions are
 * resolved at render time so the source data stays readable:
 *   - `[link: Exact Guide Name]` becomes an internal <Link> via LINK_MAP.
 *   - `**bold**` becomes a <strong>.
 * Anything that is not a recognised link name is left as plain text, so a
 * typo degrades to visible text rather than a broken link.
 */

export type ArticleBlock =
    | { type: 'text'; text: string }
    | { type: 'statement'; label: string; text: string }
    | { type: 'table'; caption?: string; columns: string[]; rows: string[][] }
    | { type: 'note'; text: string };

export interface ArticleSection {
    id: string;
    title: string;
    blocks: ArticleBlock[];
}

export interface GuideArticle {
    slug: string;
    /** Group label used by the guides index and pillar series. */
    group: string;
    /** Sequence number shown in the series (matches pillar guideSeriesGroups). */
    number: string;
    /** <h1> shown on the page. */
    heading: string;
    /** Card label in the series index. */
    cardLabel: string;
    /** Card subtitle in the series index. */
    cardSubtitle: string;
    /** SEO <title>. */
    metaTitle: string;
    /** SEO meta description. */
    metaDescription: string;
    /** Short kicker above the heading. */
    kicker: string;
    /** Lead paragraphs (may contain [link: ...] and **bold**). */
    intro: string[];
    readTime: string;
    updated: string;
    sections: ArticleSection[];
    /**
     * Optional editorial banner shown at the top of the article, e.g. for
     * pieces the docx flagged for clinical review or source verification.
     */
    reviewNote?: string;
}

export const GUIDE_BASE_PATH = '/guides';

export function guidePath(slug: string): string {
    return `${GUIDE_BASE_PATH}/${slug}`;
}

/**
 * Resolves the docx's `[link: Name]` markers to live guide URLs.
 * Names are matched exactly to the text inside the marker. Multiple aliases
 * map to the same slug where the docx used varying phrasings.
 */
export const LINK_MAP: Record<string, string> = {
    'complete guide to passing the SCA': SCA_PILLAR_PATH,
    'What Is the SCA: Format, Cost and Eligibility': guidePath('what-is-the-mrcgp-sca'),
    'What Is the MRCGP SCA': guidePath('what-is-the-mrcgp-sca'),
    'SCA Pass Rates Explained': guidePath('sca-pass-rates-explained'),
    'What to Expect on SCA Day': guidePath('sca-exam-day'),
    'The 3 SCA Marking Domains Explained': guidePath('sca-marking-domains-explained'),
    'Decoding the RCGP SCA Feedback Statements': guidePath('sca-feedback-statements'),
    'The 12 Minute Consultation Framework': guidePath('sca-twelve-minute-consultation-framework'),
    'The SCA Phrase Bank': guidePath('sca-phrase-bank'),
    'Challenging SCA Consultations': guidePath('challenging-sca-consultations'),
    'Complex Consultation Structures': guidePath('complex-sca-consultation-structures'),
    'How to Build Your SCA Revision Timeline': guidePath('sca-revision-timeline'),
    'How to Practise SCA Cases With a Study Partner': guidePath(
        'how-to-practise-sca-cases-study-partner',
    ),
    'The Best SCA Revision Resources': guidePath('best-sca-revision-resources'),
    'Which SCA AI Platform Should You Use': guidePath('which-sca-ai-platform'),
    'Failed the MRCGP SCA: How to Pass Your Re-sit': guidePath('failed-mrcgp-sca-resit-guide'),
    'Managing SCA Anxiety': guidePath('managing-sca-anxiety'),
};
