import { notFound, permanentRedirect } from 'next/navigation';
import { getPublicCasesForList } from '@/lib/cases/publicCases';
import { buildCaseSeoIndex } from '@/lib/seo/cases';

export const revalidate = 3600;

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
        notFound();
    }

    permanentRedirect(seoCase.path);
}
