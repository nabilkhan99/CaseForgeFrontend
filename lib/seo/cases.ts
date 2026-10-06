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
        .replace(/\bAdhd\b/g, 'ADHD')
        .replace(/\bA&e\b/g, 'A&E')
        .replace(/\bMmr\b/g, 'MMR')
        .replace(/\bCt\b/g, 'CT')
        .replace(/\bTv\b/g, 'TV')
        .replace(/\bCpap\b/g, 'CPAP');
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

// Hand-set overrides for cases whose auto-derived condition/slug is too
// generic to stand as a URL or H1, keyed by station id. An overridden slug
// change MUST come with a permanent redirect from the old slug in
// next.config.js so the previously indexed URL keeps working.
const CASE_SEO_OVERRIDES: Record<string, { condition?: string; slug?: string }> = {
    // "Remote Triage of the Acute Headache - examination expected": the parser
    // keeps only the text after the dash, yielding the meaningless slug
    // "examination-expected" (redirected in next.config.js).
    'ac653a32-5a4e-40e3-bbfc-09eab9fddd21': {
        condition: 'Remote Triage of an Acute Headache (Examination Expected)',
        slug: 'remote-triage-acute-headache',
    },
    // Was "Cardiovascular Risk and Impaired Fasting Glycaemia in a South Asian
    // Male": impaired fasting glycaemia describes a fasting glucose, and his
    // result is an HbA1c of 45, so the case was retitled to pre-diabetes. The
    // address is pinned here so the title can change freely (redirected in
    // next.config.js).
    '16c48616-d334-4d20-8af1-f17388f702b8': {
        condition: 'Pre-diabetes and Cardiovascular Risk After a Health Check',
        slug: 'pre-diabetes-and-cardiovascular-risk-after-a-health-check',
    },
    // Replacement cases switched on 7 Oct 2026 (case bank rewrite). Their
    // auto-derived headings dropped the subject ("Heartburn Who Wants...") or
    // were too generic ("Hepatitis A", "Urine Infection"). These pages were
    // never public under the auto slug, so no redirect is needed.
    '3ed011be-30c2-49bc-8ea8-38db42b1aa66': { condition: 'Shingles in a Teacher Taking Methotrexate', slug: 'shingles-in-a-teacher-taking-methotrexate' },
    '4e5b2638-a316-4faf-9e9f-1f5183cc8d89': { condition: 'Gallstones on an A&E Letter', slug: 'gallstones-on-an-a-and-e-letter' },
    'd5705a73-74cf-4d1c-8309-08ddffa740b0': { condition: 'Heartburn in a Night Shift Nurse', slug: 'heartburn-in-a-night-shift-nurse' },
    '174435e0-553d-4167-88b7-07457d730a18': { condition: 'Fibroid Pressing on the Bladder', slug: 'fibroid-pressing-on-the-bladder' },
    '467bc563-852f-4e59-b7f7-cc6464e2b09a': { condition: 'HRT After a Past Blood Clot', slug: 'hrt-after-a-past-blood-clot' },
    '466026c8-2977-400d-8806-9860d927c227': { condition: 'Partner Diagnosed with Hepatitis A', slug: 'partner-diagnosed-with-hepatitis-a' },
    '22b0c431-c775-4534-9330-40507fd2f2b0': { condition: 'Breast Lump in a Woman with a Learning Disability', slug: 'breast-lump-in-a-woman-with-a-learning-disability' },
    '17183fdc-f4f7-4f43-9630-09fce2d97c41': { condition: 'Planning a Pregnancy on Lithium', slug: 'planning-a-pregnancy-on-lithium' },
    'fea91315-0225-4dad-b0f5-d75044c453d4': { condition: 'Spotting and One Sided Pain at Seven Weeks Pregnant', slug: 'spotting-and-one-sided-pain-at-seven-weeks-pregnant' },
    '60422fa9-cb5d-4be8-bc9e-c3e1d449e844': { condition: 'Widower with Weight Loss and Poor Sleep', slug: 'widower-with-weight-loss-and-poor-sleep' },
    'ec749e6a-7e2f-4044-883b-95874c4af87b': { condition: 'Low Potassium in a Young Man Preparing for a Modelling Job', slug: 'low-potassium-in-a-young-man-preparing-for-a-modelling-job' },
    'ef2909ca-39dd-4886-ad69-d58944d3db9d': { condition: 'Fever in a Seven Week Old Baby', slug: 'fever-in-a-seven-week-old-baby' },
    '4d248034-f0f0-4d17-955b-384de27eed4f': { condition: 'Noisy Breathing in a Dying Mother', slug: 'noisy-breathing-in-a-dying-mother' },
    'da50dff8-1cfd-4589-a4b9-2fb0ff69ec11': { condition: 'Urine Infection in a Man', slug: 'urine-infection-in-a-man' },
    'd44ec7a6-ec89-4d22-803c-d2ba779af0ac': { condition: 'Headache and High Blood Pressure After Giving Birth', slug: 'headache-and-high-blood-pressure-after-giving-birth' },
};

export function buildCaseSeoIndex<T extends PublicCase>(cases: T[]) {
    const seen = new Map<string, number>();

    return cases.map(caseItem => {
        const override = CASE_SEO_OVERRIDES[caseItem.id];
        const condition = override?.condition ?? inferCondition(caseItem);
        const baseSlug =
            override?.slug ?? (slugify(condition) || slugify(caseItem.title) || caseItem.id);
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

/**
 * The page's meta (and Open Graph / Twitter) description: the hand-written
 * stations.seo_description when a case has one, otherwise the template above.
 * A blank or whitespace-only value counts as none.
 */
export function caseMetaDescription(caseItem: { condition: string; seo_description?: string | null }) {
    const written = caseItem.seo_description?.trim();
    return written ? written : caseDescription(caseItem.condition);
}

/**
 * Static copy's fallback for the size of the public library, used only where
 * no live count reaches the text (or the count read failed). The bank is held
 * at 200 cases through the Oct 2026 rewrite.
 */
export const PUBLIC_LIBRARY_SIZE_FALLBACK = 200;

/** The number to print for the public library: the live count, or the fallback. */
export function publicLibrarySize(liveCount: number | null | undefined) {
    return liveCount && liveCount > 0 ? liveCount : PUBLIC_LIBRARY_SIZE_FALLBACK;
}
