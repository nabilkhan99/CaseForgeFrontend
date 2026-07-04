import type { Metadata } from 'next';
import CaseBankPageClient from '@/components/cases/CaseBankPageClient';
import { getPublicCasesGroupedByDomain } from '@/lib/cases/publicCases';
import { buildCaseSeoIndex } from '@/lib/seo/cases';
import { pageMetadata } from '@/lib/seo/site';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = pageMetadata({
    title: 'Free SCA Practice Cases | 79 RCGP Curriculum Cases',
    description:
        '79 free SCA practice cases built directly from RCGP curriculum topic stations. Candidate brief, patient script, marking scheme and learning points. Free for GP registrar exam prep.',
    path: '/sca-cases',
});

export default async function ScaCasesPage() {
    const domains = await getPublicCasesGroupedByDomain();
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
