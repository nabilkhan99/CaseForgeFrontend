import type { PortfolioArticle } from '@/lib/portfolio-guides/articleTypes';
import { usingAiForEportfolioEntries } from '@/lib/portfolio-guides/articles/using-ai-for-eportfolio-entries';
import { howToWriteAClinicalCaseReview } from '@/lib/portfolio-guides/articles/how-to-write-a-clinical-case-review';
import { rcgpCapabilitiesExplained } from '@/lib/portfolio-guides/articles/rcgp-capabilities-explained';

/**
 * Registry of the ePortfolio cluster, in the build order given by section 7 of
 * the build spec. The dynamic route at app/gp-portfolio-tool/[slug] renders any
 * slug present here; generateStaticParams pre-renders each one at build time,
 * and app/sitemap.ts derives the article URLs from this array.
 *
 * This order is also the order the "More on the GP ePortfolio" block on the
 * tool page should list them in (spec section 6c, wired in at integration).
 */
export const portfolioArticles: PortfolioArticle[] = [
    usingAiForEportfolioEntries,
    howToWriteAClinicalCaseReview,
    rcgpCapabilitiesExplained,
];

export const portfolioArticlesBySlug: Record<string, PortfolioArticle> = Object.fromEntries(
    portfolioArticles.map(article => [article.slug, article]),
);

export function getPortfolioArticle(slug: string): PortfolioArticle | undefined {
    return portfolioArticlesBySlug[slug];
}
