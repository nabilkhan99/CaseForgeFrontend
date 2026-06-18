import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import CaseDetailPageClient from '@/components/cases/CaseDetailPageClient';
import { getPublicCases } from '@/lib/cases/publicCases';
import { buildCaseSeoIndex, caseDescription, caseTitle } from '@/lib/seo/cases';
import { absoluteUrl, pageMetadata, SITE_NAME, SITE_URL } from '@/lib/seo/site';

export const dynamic = 'force-dynamic';

interface PageProps {
    params: Promise<{ slug: string }>;
}

async function getSeoCase(slug: string) {
    const seoCases = buildCaseSeoIndex(await getPublicCases());
    return seoCases.find(caseItem => caseItem.slug === slug) || null;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
    const { slug } = await params;
    const caseItem = await getSeoCase(slug);

    if (!caseItem) {
        return pageMetadata({
            title: 'SCA Practice Case Not Found',
            description: 'This SCA practice case could not be found.',
            path: '/sca-cases',
        });
    }

    return pageMetadata({
        title: caseTitle(caseItem.condition),
        description: caseDescription(caseItem.condition),
        path: caseItem.path,
    });
}

export default async function ScaCasePage({ params }: PageProps) {
    const { slug } = await params;
    const caseItem = await getSeoCase(slug);

    if (!caseItem) {
        notFound();
    }

    const courseJsonLd = {
        '@context': 'https://schema.org',
        '@type': 'Course',
        name: `${caseItem.condition} SCA Practice Case`,
        description: `Free MRCGP SCA practice case covering ${caseItem.condition}, with candidate brief, patient script, marking scheme and learning points. Built from the RCGP curriculum.`,
        provider: {
            '@type': 'Organization',
            name: SITE_NAME,
            url: SITE_URL,
        },
        isAccessibleForFree: true,
        educationalLevel: 'Postgraduate (GP registrar / ST3)',
        about: caseItem.domain_name,
    };

    const breadcrumbJsonLd = {
        '@context': 'https://schema.org',
        '@type': 'BreadcrumbList',
        itemListElement: [
            {
                '@type': 'ListItem',
                position: 1,
                name: 'Free SCA Practice Cases',
                item: absoluteUrl('/sca-cases'),
            },
            {
                '@type': 'ListItem',
                position: 2,
                name: caseItem.domain_name,
            },
            {
                '@type': 'ListItem',
                position: 3,
                name: `${caseItem.condition} SCA Case`,
            },
        ],
    };

    return (
        <>
            <script
                type="application/ld+json"
                dangerouslySetInnerHTML={{ __html: JSON.stringify(courseJsonLd) }}
            />
            <script
                type="application/ld+json"
                dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbJsonLd) }}
            />
            <CaseDetailPageClient caseData={caseItem} />
        </>
    );
}
