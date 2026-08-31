/**
 * Content model for the ePortfolio article cluster at /gp-portfolio-tool/[slug].
 *
 * Deliberately a sibling of lib/guides (the SCA cluster) rather than a reuse of
 * it. The two clusters are kept apart on purpose so they do not compete for the
 * same queries, and the SCA type carries series machinery (group, number,
 * cardLabel, cardSubtitle) that belongs to the SCA pillar and means nothing
 * here. The two inline conventions are copied verbatim from lib/guides because
 * they are what make the source copy readable in place:
 *   - `[link: Exact Name]` becomes an internal <Link> via PORTFOLIO_LINK_MAP.
 *   - `**bold**` becomes a <strong>.
 * Anything that is not a recognised link name is left as plain text, so a typo
 * degrades to visible text rather than a broken link.
 *
 * House rules for this cluster (from the source drafts): no entry counts, no
 * word counts, no dates, no year references, no policy figures. That is why
 * there is no `updated` or `readTime` field here, and why the route emits no
 * datePublished. Anywhere a requirement could change, the copy describes the
 * shape of the thing and points at the RCGP.
 */

/** One term and its prose, e.g. `Context` / `Evidences well` / `Reasoning`. */
export interface PortfolioDefinition {
    term: string;
    paragraphs: string[];
}

export type PortfolioArticleBlock =
    /** A body paragraph. May contain [link: ...] and **bold**. */
    | { type: 'text'; text: string }
    /**
     * A line set off from the body (the source italicises these), followed by
     * the paragraph that unpacks it. No quote marks are added: where the source
     * quotes something, the quote marks are already in the copy.
     */
    | { type: 'statement'; label: string; text: string }
    /**
     * A description list. Covers the three places the source uses a labelled
     * paragraph group: the worked examples (Context / Reasoning / What I'd do
     * differently), the capability entries (Evidences well / Commonly
     * mistagged) and the training-stage entries (What a strong ST1 entry looks
     * like / The characteristic ST1 weakness).
     */
    | { type: 'defs'; items: PortfolioDefinition[] }
    /** The capability tag row that closes a worked example. */
    | { type: 'capabilities'; items: string[] };

export interface PortfolioArticleSection {
    id: string;
    title: string;
    blocks: PortfolioArticleBlock[];
}

export interface PortfolioArticleCta {
    /** CTA copy, verbatim from the draft. Inline conventions apply. */
    paragraphs: string[];
    /** The bracketed call to action from the draft, rendered as a link. */
    actions: { label: string; href: string }[];
}

export interface PortfolioArticle {
    slug: string;
    /** <h1> shown on the page. */
    heading: string;
    /** Short topic label above the heading. */
    kicker: string;
    /** SEO <title>, supplied verbatim by the draft. */
    metaTitle: string;
    /** SEO meta description, supplied verbatim by the draft. */
    metaDescription: string;
    /** Lead paragraphs, before the first section. */
    intro: string[];
    sections: PortfolioArticleSection[];
    /** Every article closes with a CTA back to the tool. */
    cta: PortfolioArticleCta;
}

export const PORTFOLIO_TOOL_PATH = '/gp-portfolio-tool';
export const SCA_CASES_PATH = '/sca-cases';
export const PRICING_PATH = '/pricing';

/** Articles are children of the tool page, which is their structural parent. */
export function portfolioArticlePath(slug: string): string {
    return `${PORTFOLIO_TOOL_PATH}/${slug}`;
}

/**
 * Resolves `[link: Name]` markers in the copy to live URLs. Names match the
 * exact phrase inside the marker, which is why the phrases read as ordinary
 * prose: the anchor text is the sentence, not a bolted-on "click here".
 */
export const PORTFOLIO_LINK_MAP: Record<string, string> = {
    'free GP portfolio tool': PORTFOLIO_TOOL_PATH,
    'free portfolio tool': PORTFOLIO_TOOL_PATH,
    'GP portfolio tool': PORTFOLIO_TOOL_PATH,
    'full SCA preparation course': PRICING_PATH,
    'free library of SCA practice stations': SCA_CASES_PATH,
};
