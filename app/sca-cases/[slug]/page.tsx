import type { Metadata } from 'next';
import { notFound, permanentRedirect } from 'next/navigation';
import CaseDetailPageClient from '@/components/cases/CaseDetailPageClient';
import {
    findArchivedCaseForwardPath,
    getPublicCaseById,
    getPublicCasesForList,
} from '@/lib/cases/publicCases';
import { buildCaseSeoIndex, caseMetaDescription, caseTitle } from '@/lib/seo/cases';
import { absoluteUrl, pageMetadata, SITE_NAME, SITE_URL } from '@/lib/seo/site';

export const revalidate = 3600;

// Slugs outside generateStaticParams must still reach the page: that is how an
// archived case's old address gets to the forwarding lookup below (and how a
// case added since the last build gets its page). This is Next's default; it is
// spelled out so nobody turns it off without seeing what it would break.
export const dynamicParams = true;

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

// The live library's size, for the page's "part of a free library of N" line.
// getPublicCasesForList is request-cached, so this costs nothing extra.
async function getLiveCaseCount() {
    return (await getPublicCasesForList()).length;
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
        description: caseMetaDescription(caseItem),
        path: caseItem.path,
    });
}

export default async function ScaCasePage({ params }: PageProps) {
    const { slug } = await params;
    const caseItem = await getSeoCase(slug);

    if (!caseItem) {
        // Not a live case. If it was one that has since been replaced, its old
        // address forwards permanently to the replacement's page; otherwise this
        // is the 404 it always was. Outside any try/catch: permanentRedirect
        // throws to do its work.
        const forwardTo = await findArchivedCaseForwardPath({ archivedSlug: slug });
        if (forwardTo) {
            permanentRedirect(forwardTo);
        }
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
            { '@type': 'ListItem', position: 1, name: 'Home', item: SITE_URL },
            {
                '@type': 'ListItem',
                position: 2,
                name: 'Free SCA Practice Cases',
                item: absoluteUrl('/sca-cases'),
            },
            {
                '@type': 'ListItem',
                position: 3,
                name: `${caseItem.condition} SCA Case`,
                item: absoluteUrl(`/sca-cases/${caseItem.slug}`),
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
            <CaseDetailPageClient caseData={caseItem} libraryCaseCount={await getLiveCaseCount()} />
        </>
    );
}
