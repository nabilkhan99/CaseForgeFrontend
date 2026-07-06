import type { MetadataRoute } from 'next';
import { getPublicCasesForList } from '@/lib/cases/publicCases';
import { guideArticles } from '@/lib/guides/articles';
import { guidePath } from '@/lib/guides/articleTypes';
import { GUIDE_INDEX_PATH } from '@/lib/guides/scaPillarGuide';
import { buildCaseSeoIndex } from '@/lib/seo/cases';
import { absoluteUrl } from '@/lib/seo/site';

export const revalidate = 3600;

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
    const now = new Date();
    const cases = buildCaseSeoIndex(await getPublicCasesForList());

    return [
        {
            url: absoluteUrl('/'),
            lastModified: now,
            changeFrequency: 'weekly',
            priority: 1,
        },
        {
            url: absoluteUrl('/sca-cases'),
            lastModified: now,
            changeFrequency: 'weekly',
            priority: 0.9,
        },
        ...cases.map(caseItem => ({
            url: absoluteUrl(caseItem.path),
            lastModified: now,
            changeFrequency: 'monthly' as const,
            priority: 0.75,
        })),
        {
            url: absoluteUrl(GUIDE_INDEX_PATH),
            lastModified: now,
            changeFrequency: 'monthly',
            priority: 0.85,
        },
        ...guideArticles.map(article => ({
            url: absoluteUrl(guidePath(article.slug)),
            lastModified: now,
            changeFrequency: 'monthly' as const,
            priority: 0.7,
        })),
        {
            url: absoluteUrl('/gp-portfolio-tool'),
            lastModified: now,
            changeFrequency: 'monthly',
            priority: 0.85,
        },
    ];
}
