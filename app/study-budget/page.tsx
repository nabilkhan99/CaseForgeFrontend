import type { Metadata } from 'next';
import Link from 'next/link';
import StudyBudgetArticleView from '@/components/study-budget/StudyBudgetArticleView';
import { pageMetadata } from '@/lib/seo/site';
import { STUDY_BUDGET_HUB, STUDY_BUDGET_SPOKES } from '@/lib/study-budget/content';
import { deaneryIdForArticle } from '@/lib/study-budget/deaneryMap';
import {
  articleJsonLd,
  breadcrumbJsonLd,
  faqJsonLd,
  itemListJsonLd,
} from '@/lib/study-budget/jsonLd';

export const metadata: Metadata = pageMetadata({
  title: STUDY_BUDGET_HUB.title,
  description: STUDY_BUDGET_HUB.metaDescription,
  path: STUDY_BUDGET_HUB.slug,
  type: 'article',
});

/** Deanery spokes only — the three support pages are listed separately. */
const DEANERY_SPOKES = STUDY_BUDGET_SPOKES.filter((a) => deaneryIdForArticle(a));
const SUPPORT_SPOKES = STUDY_BUDGET_SPOKES.filter((a) => !deaneryIdForArticle(a));

export default function StudyBudgetHubPage() {
  const faq = faqJsonLd(STUDY_BUDGET_HUB);

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(articleJsonLd(STUDY_BUDGET_HUB)) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbJsonLd(STUDY_BUDGET_HUB)) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(itemListJsonLd(DEANERY_SPOKES)) }}
      />
      {faq ? (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(faq) }}
        />
      ) : null}

      <StudyBudgetArticleView article={STUDY_BUDGET_HUB}>
        <nav aria-label="Deanery guides" className="mt-12">
          <h2 className="[font-family:var(--font-serif)] text-[26px] font-semibold tracking-tight text-heading md:text-[32px]">
            Every deanery
          </h2>
          <ul className="mt-5 grid gap-2 sm:grid-cols-2">
            {DEANERY_SPOKES.map((article) => (
              <li key={article.slug}>
                <Link
                  href={article.slug}
                  className="block rounded-xl border border-[#e2d8c8] bg-white/70 px-4 py-3 text-[15px] font-medium text-heading transition-colors hover:border-primary/40 hover:bg-white"
                >
                  {article.h1.replace(/ GP study budget.*$/, '')}
                </Link>
              </li>
            ))}
          </ul>

          <h2 className="mt-10 [font-family:var(--font-serif)] text-[26px] font-semibold tracking-tight text-heading md:text-[32px]">
            Also worth reading
          </h2>
          <ul className="mt-5 grid gap-2 sm:grid-cols-2">
            {SUPPORT_SPOKES.map((article) => (
              <li key={article.slug}>
                <Link
                  href={article.slug}
                  className="block rounded-xl border border-[#e2d8c8] bg-white/70 px-4 py-3 text-[15px] font-medium text-heading transition-colors hover:border-primary/40 hover:bg-white"
                >
                  {article.h1}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
      </StudyBudgetArticleView>
    </>
  );
}
