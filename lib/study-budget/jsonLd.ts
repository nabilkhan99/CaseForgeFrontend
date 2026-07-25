import { absoluteUrl, SITE_NAME } from '@/lib/seo/site';
import {
  STUDY_BUDGET_HUB,
  type StudyBudgetArticle,
} from './content';

/**
 * JSON-LD per the build package §2: Article + BreadcrumbList on every page,
 * FAQPage where the article carries a FAQ block, ItemList on the hub.
 *
 * `dateModified` is the page's real last-reviewed date and must only move on
 * human re-verification — never on an unrelated deploy — so it is derived from
 * the article's own dateline rather than from build time.
 */
const PUBLISH_DATE = '2026-07-16';

/** "Correct as of July 2026 · ..." -> "2026-07-01". */
function lastReviewedFrom(dateline: string): string {
  const match = dateline.match(
    /Correct as of (January|February|March|April|May|June|July|August|September|October|November|December)\s+(\d{4})/i,
  );
  if (!match) return PUBLISH_DATE;
  const months = [
    'january', 'february', 'march', 'april', 'may', 'june',
    'july', 'august', 'september', 'october', 'november', 'december',
  ];
  const month = months.indexOf(match[1].toLowerCase()) + 1;
  return `${match[2]}-${String(month).padStart(2, '0')}-01`;
}

export function articleJsonLd(article: StudyBudgetArticle) {
  return {
    '@context': 'https://schema.org',
    '@type': 'Article',
    headline: article.h1,
    description: article.metaDescription,
    datePublished: PUBLISH_DATE,
    dateModified: lastReviewedFrom(article.dateline),
    author: { '@type': 'Organization', name: SITE_NAME },
    publisher: { '@type': 'Organization', name: SITE_NAME },
    mainEntityOfPage: absoluteUrl(article.slug),
  };
}

export function breadcrumbJsonLd(article: StudyBudgetArticle) {
  const isHub = article.slug === STUDY_BUDGET_HUB.slug;
  const items = [
    { '@type': 'ListItem', position: 1, name: 'Home', item: absoluteUrl('/') },
    {
      '@type': 'ListItem',
      position: 2,
      name: 'Study budget',
      item: absoluteUrl(STUDY_BUDGET_HUB.slug),
    },
  ];
  if (!isHub) {
    items.push({
      '@type': 'ListItem',
      position: 3,
      name: article.h1,
      item: absoluteUrl(article.slug),
    });
  }
  return { '@context': 'https://schema.org', '@type': 'BreadcrumbList', itemListElement: items };
}

/** "[GP0001 explained](/study-budget/gp0001-explained/)" -> "GP0001 explained". */
function stripMarkdown(text: string): string {
  return text
    .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')
    .replace(/\*\*([^*]+)\*\*/g, '$1')
    .replace(/\s+/g, ' ')
    .trim();
}

export function faqJsonLd(article: StudyBudgetArticle) {
  if (article.faq.length === 0) return null;
  return {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: article.faq.map((item) => ({
      '@type': 'Question',
      name: stripMarkdown(item.q),
      // Schema answers must be clean prose, not markdown source.
      acceptedAnswer: { '@type': 'Answer', text: stripMarkdown(item.a) },
    })),
  };
}

/** Hub only — the ordered list of deanery pages. */
export function itemListJsonLd(spokes: StudyBudgetArticle[]) {
  return {
    '@context': 'https://schema.org',
    '@type': 'ItemList',
    itemListElement: spokes.map((article, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      name: article.h1,
      url: absoluteUrl(article.slug),
    })),
  };
}
