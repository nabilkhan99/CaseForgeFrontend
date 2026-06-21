import type { MetadataRoute } from 'next';
import { getPublicCases } from '@/lib/cases/publicCases';
import { GUIDE_INDEX_PATH, SCA_PILLAR_PATH } from '@/lib/guides/scaPillarGuide';
import { buildCaseSeoIndex } from '@/lib/seo/cases';
import { absoluteUrl } from '@/lib/seo/site';

export const dynamic = 'force-dynamic';

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
    const now = new Date();
    const cases = buildCaseSeoIndex(await getPublicCases());

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
        {
            url: absoluteUrl(GUIDE_INDEX_PATH),
            lastModified: now,
            changeFrequency: 'monthly',
            priority: 0.8,
        },
        {
            url: absoluteUrl(SCA_PILLAR_PATH),
            lastModified: now,
            changeFrequency: 'monthly',
            priority: 0.85,
        },
        ...cases.map(caseItem => ({
            url: absoluteUrl(caseItem.path),
            lastModified: now,
            changeFrequency: 'monthly' as const,
            priority: 0.75,
        })),
        {
            url: absoluteUrl('/gp-portfolio-tool'),
            lastModified: now,
            changeFrequency: 'monthly',
            priority: 0.85,
        },
    ];
}
