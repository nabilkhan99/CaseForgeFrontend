import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import CaseDetailPageClient from '@/components/cases/CaseDetailPageClient';
import { getPublicCaseById, getPublicCasesForList } from '@/lib/cases/publicCases';
import { buildCaseSeoIndex, caseDescription, caseTitle } from '@/lib/seo/cases';
import { absoluteUrl, pageMetadata, SITE_NAME, SITE_URL } from '@/lib/seo/site';

export const revalidate = 3600;

interface PageProps {
    params: Promise<{ slug: string }>;
}

// Slug lookup uses the light list select (slugs derive from title + id ordering only),
// so unknown-slug requests never pull the large case-body columns.
async function getSeoIndexEntry(slug: string) {
    const seoCases = buildCaseSeoIndex(await getPublicCasesForList());
    return seoCases.find(caseItem => caseItem.slug === slug) || null;
}

async function getSeoCase(slug: string) {
    const entry = await getSeoIndexEntry(slug);

    if (!entry) {
        return null;
    }

    const detail = await getPublicCaseById(entry.id);

    if (!detail) {
        return null;
    }

    return {
        ...entry,
        ...detail,
        condition: entry.condition,
        slug: entry.slug,
        path: entry.path,
    };
}

export async function generateStaticParams() {
    const seoCases = buildCaseSeoIndex(await getPublicCasesForList());
    return seoCases.map(caseItem => ({ slug: caseItem.slug }));
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
    const { slug } = await params;
    const caseItem = await getSeoIndexEntry(slug);

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
