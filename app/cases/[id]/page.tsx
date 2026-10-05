import { notFound, permanentRedirect } from 'next/navigation';
import { findArchivedCaseForwardPath, getPublicCasesForList } from '@/lib/cases/publicCases';
import { buildCaseSeoIndex } from '@/lib/seo/cases';

export const revalidate = 3600;

// No generateStaticParams here, so every id renders on demand; stated so the
// archived-id forwarding below can never be switched off by accident.
export const dynamicParams = true;

interface PageProps {
    params: Promise<{ id: string }>;
}

export default async function LegacyCasePage({ params }: PageProps) {
    const { id } = await params;

    // Redirect only needs the slug, so the light list select is enough —
    // avoids pulling every case body just to compute a URL.
    const seoCases = buildCaseSeoIndex(await getPublicCasesForList());
    const seoCase = seoCases.find(item => item.id === id);

    if (!seoCase) {
        // An archived case's id forwards to its live replacement's page, the
        // same as its old /sca-cases slug does; anything else is a 404.
        const forwardTo = await findArchivedCaseForwardPath({ id });
        if (forwardTo) {
            permanentRedirect(forwardTo);
        }
        notFound();
    }

    permanentRedirect(seoCase.path);
}
