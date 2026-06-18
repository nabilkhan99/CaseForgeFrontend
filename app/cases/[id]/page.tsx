import { notFound, permanentRedirect } from 'next/navigation';
import { getPublicCaseById, getPublicCases } from '@/lib/cases/publicCases';
import { buildCaseSeoIndex } from '@/lib/seo/cases';

interface PageProps {
    params: Promise<{ id: string }>;
}

export default async function LegacyCasePage({ params }: PageProps) {
    const { id } = await params;
    const caseItem = await getPublicCaseById(id);

    if (!caseItem) {
        notFound();
    }

    const seoCases = buildCaseSeoIndex(await getPublicCases());
    const seoCase = seoCases.find(item => item.id === caseItem.id);

    if (!seoCase) {
        notFound();
    }

    permanentRedirect(seoCase.path);
}
