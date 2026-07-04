import type { PublicCase } from '@/lib/cases/publicCases';

const TITLE_PREFIXES = [
    'patient with',
    'patient presenting with',
    'woman with',
    'man with',
    'child with',
    'infant with',
    'consultation about',
    'review of',
    'follow up for',
    'follow-up for',
];

const STOP_PHRASES = ['suspected', 'possible', 'new onset', 'new-onset'];

function titleCase(value: string) {
    return value
        .split(/\s+/)
        .filter(Boolean)
        .map(word => {
            const lower = word.toLowerCase();
            if (['and', 'or', 'of', 'the', 'in', 'to', 'for', 'with'].includes(lower)) {
                return lower;
            }
            return lower.charAt(0).toUpperCase() + lower.slice(1);
        })
        .join(' ')
        .replace(/\bGp\b/g, 'GP')
        .replace(/\bMrcgp\b/g, 'MRCGP')
        .replace(/\bCopd\b/g, 'COPD')
        .replace(/\bUti\b/g, 'UTI')
        .replace(/\bIbs\b/g, 'IBS')
        .replace(/\bHrt\b/g, 'HRT')
        .replace(/\bT2dm\b/g, 'T2DM')
        .replace(/\bAdhd\b/g, 'ADHD');
}

export function slugify(value: string) {
    return value
        .toLowerCase()
        .replace(/&/g, ' and ')
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '')
        .replace(/-{2,}/g, '-');
}

export function inferCondition(station: Pick<PublicCase, 'title' | 'clinical_learning_points' | 'candidate_instructions'>) {
    const title = station.title.replace(/[–—]/g, '-').trim();
    const afterDash = title.includes(' - ') ? title.split(' - ').pop() || title : title;
    let candidate = afterDash.replace(/\([^)]*\)/g, ' ').trim();
    const lower = candidate.toLowerCase();
    const prefix = TITLE_PREFIXES.find(item => lower.startsWith(item));

    if (prefix) {
        candidate = candidate.slice(prefix.length).trim();
    }

    const genericWithMatch = candidate.match(/^[A-Za-z][A-Za-z' -]{1,42}\s+with\s+(.+)$/i);
    if (genericWithMatch && genericWithMatch[1]) {
        candidate = genericWithMatch[1].trim();
    }

    for (const phrase of STOP_PHRASES) {
        candidate = candidate.replace(new RegExp(`\\b${phrase}\\b`, 'i'), '').trim();
    }

    candidate = candidate
        .replace(/^(a|an|the)\s+/i, '')
        .replace(/\s+(case|scenario|presentation|consultation|review)$/i, '')
        .replace(/\s{2,}/g, ' ')
        .trim();

    if (!candidate || candidate.length < 3) {
        candidate = title;
    }

    return titleCase(candidate);
}

export function buildCaseSeoIndex<T extends PublicCase>(cases: T[]) {
    const seen = new Map<string, number>();

    return cases.map(caseItem => {
        const condition = inferCondition(caseItem);
        const baseSlug = slugify(condition) || slugify(caseItem.title) || caseItem.id;
        const count = seen.get(baseSlug) || 0;
        seen.set(baseSlug, count + 1);
        const slug = count === 0 ? baseSlug : `${baseSlug}-${caseItem.id.slice(0, 8)}`;

        return {
            ...caseItem,
            condition,
            slug,
            path: `/sca-cases/${slug}`,
        };
    });
}

export type SeoCase<T extends PublicCase = PublicCase> = ReturnType<typeof buildCaseSeoIndex<T>>[number];

export function caseTitle(condition: string) {
    return `${condition} SCA Case | Free RCGP Practice Case`;
}

export function caseDescription(condition: string) {
    return `Free SCA practice case covering ${condition}. Candidate brief, patient script, marking scheme and learning points. Built from the RCGP curriculum for GP registrar exam preparation.`;
}
