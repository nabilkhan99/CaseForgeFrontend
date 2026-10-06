import type { Metadata } from 'next';
import CaseBankPageClient from '@/components/cases/CaseBankPageClient';
import { getPublicCasesForList, getPublicCasesGroupedByDomainForList } from '@/lib/cases/publicCases';
import { buildCaseSeoIndex, publicLibrarySize } from '@/lib/seo/cases';
import { pageMetadata } from '@/lib/seo/site';

export const revalidate = 3600;

// The count in the title and description is the live library's real size
// (read from the same request-cached list the page renders), so it follows the
// bank as cases are replaced. The share image is a fixed PNG, so neither it nor
// its alt text prints a count.
export async function generateMetadata(): Promise<Metadata> {
    const count = publicLibrarySize((await getPublicCasesForList()).length);

    return pageMetadata({
        title: `Free SCA Practice Cases | ${count} RCGP Curriculum Cases`,
        description: `${count} free SCA practice cases built directly from RCGP curriculum topic stations. Candidate brief, patient script, marking scheme and learning points. Free for GP registrar exam prep.`,
        path: '/sca-cases',
        image: {
            url: '/og/sca-cases.png',
            width: 1200,
            height: 1200,
            alt: 'Free SCA practice cases built from the RCGP curriculum: candidate brief, patient script, marking scheme and learning points',
        },
    });
}

export default async function ScaCasesPage() {
    const domains = await getPublicCasesGroupedByDomainForList();
    const seoCases = buildCaseSeoIndex(domains.flatMap(domain => domain.cases));
    const seoCaseMap = new Map(seoCases.map(caseItem => [caseItem.id, caseItem]));
    const seoDomains = domains.map(domain => ({
        ...domain,
        cases: domain.cases
            .map(caseItem => seoCaseMap.get(caseItem.id))
            .filter((caseItem): caseItem is NonNullable<typeof caseItem> => Boolean(caseItem)),
    }));

    return <CaseBankPageClient initialDomains={seoDomains} />;
}
