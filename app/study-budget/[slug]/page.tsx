import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import StudyBudgetArticleView from '@/components/study-budget/StudyBudgetArticleView';
import { pageMetadata } from '@/lib/seo/site';
import {
  getStudyBudgetArticle,
  STUDY_BUDGET_SPOKES,
  studyBudgetSlugParam,
} from '@/lib/study-budget/content';
import { deaneryIdForArticle } from '@/lib/study-budget/deaneryMap';
import { articleJsonLd, breadcrumbJsonLd, faqJsonLd } from '@/lib/study-budget/jsonLd';

export function generateStaticParams() {
  return STUDY_BUDGET_SPOKES.map((article) => ({
    slug: studyBudgetSlugParam(article),
  }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const article = getStudyBudgetArticle(slug);
  if (!article) {
    return { title: 'Page not found | Fourteen Fisherman' };
  }
  return pageMetadata({
    title: article.title,
    description: article.metaDescription,
    path: article.slug,
    type: 'article',
  });
}

export default async function StudyBudgetSpokePage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const article = getStudyBudgetArticle(slug);
  if (!article) notFound();

  const faq = faqJsonLd(article);

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(articleJsonLd(article)) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbJsonLd(article)) }}
      />
      {faq ? (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(faq) }}
        />
      ) : null}

      <StudyBudgetArticleView article={article} deaneryId={deaneryIdForArticle(article)} />
    </>
  );
}
