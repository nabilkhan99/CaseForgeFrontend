import { cache } from 'react';
import { getSupabaseAdmin } from '@/lib/supabase/admin';
import { buildCaseSeoIndex } from '@/lib/seo/cases';

export interface PublicCase {
    id: string;
    title: string;
    patient_name: string;
    patient_age: number;
    difficulty?: string | null;
    consultation_type: string | null;
    reading_duration_seconds?: number;
    consultation_duration_seconds: number;
    candidate_instructions?: string;
    station_script?: string | null;
    data_gathering?: string | null;
    clinical_management?: string | null;
    relating_to_others?: string | null;
    clinical_learning_points?: string | null;
    /**
     * One of the five free cases. Read-only here: the flag is set in the
     * database and the public case page uses it to decide whether its button
     * can offer THIS case free or has to offer the five.
     *
     * Optional because the light list select does not carry it — only the
     * detail select does, and the detail page merges detail over list.
     */
    is_free_trial?: boolean | null;
    /**
     * Hand-written one-line page description (stations.seo_description). Null
     * for every case written before case versions; the page then falls back to
     * the caseDescription() template in lib/seo/cases.ts.
     */
    seo_description?: string | null;
    domain_id: string;
    domain_name: string;
}

export interface PublicCaseDomain {
    id: string;
    name: string;
    description: string | null;
    cases: PublicCase[];
}

// Full case body, incl. large text fields (patient script, marking scheme, learning points) — detail page + sitemap.
const CASE_SELECT_DETAIL =
    'id, title, patient_name, patient_age, difficulty, consultation_type, reading_duration_seconds, consultation_duration_seconds, candidate_instructions, station_script, data_gathering, clinical_management, relating_to_others, clinical_learning_points, is_free_trial, seo_description, domain_id';

// Card-display fields only — list page, avoids pulling the large text blobs for every card.
// seo_description rides along (one short line) because the case page's
// metadata is built from the list entry, not the detail row.
const CASE_SELECT_LIST =
    'id, title, patient_name, patient_age, consultation_type, consultation_duration_seconds, seo_description, domain_id';

async function attachDomainNames<T extends { domain_id: string }>(
    supabase: ReturnType<typeof getSupabaseAdmin>,
    stations: T[]
): Promise<(T & { domain_name: string })[]> {
    const domainIds = [...new Set(stations.map(station => station.domain_id).filter(Boolean))];
    const { data: domains, error: domainsError } = await supabase
        .from('domains')
        .select('id, name, description')
        .in('id', domainIds)
        .order('name');

    if (domainsError || !domains) {
        console.error('Error fetching case domains:', domainsError);
        return stations.map(station => ({ ...station, domain_name: 'Unknown' }));
    }

    const domainMap = new Map(domains.map(domain => [domain.id, domain.name]));

    return stations.map(station => ({
        ...station,
        domain_name: domainMap.get(station.domain_id) || 'Unknown',
    }));
}

export const getPublicCasesForList = cache(async (): Promise<PublicCase[]> => {
    const supabase = getSupabaseAdmin();

    const { data: stations, error: stationsError } = await supabase
        .from('stations')
        .select(CASE_SELECT_LIST)
        .eq('is_active', true)
        .order('title');

    if (stationsError || !stations) {
        console.error('Error fetching public cases:', stationsError);
        return [];
    }

    return attachDomainNames(supabase, stations);
});

function groupByDomain(cases: PublicCase[]): PublicCaseDomain[] {
    const domains = new Map<string, PublicCaseDomain>();

    for (const caseItem of cases) {
        if (!domains.has(caseItem.domain_id)) {
            domains.set(caseItem.domain_id, {
                id: caseItem.domain_id,
                name: caseItem.domain_name,
                description: null,
                cases: [],
            });
        }
        domains.get(caseItem.domain_id)!.cases.push(caseItem);
    }

    return [...domains.values()].sort((a, b) => a.name.localeCompare(b.name));
}

export const getPublicCasesGroupedByDomainForList = cache(async (): Promise<PublicCaseDomain[]> => {
    return groupByDomain(await getPublicCasesForList());
});

export const getPublicCaseById = cache(async (id: string): Promise<PublicCase | null> => {
    const supabase = getSupabaseAdmin();

    const { data: station, error } = await supabase
        .from('stations')
        .select(CASE_SELECT_DETAIL)
        .eq('id', id)
        .eq('is_active', true)
        .maybeSingle();

    if (error) {
        console.error('Error fetching public case:', error);
        return null;
    }

    if (!station) {
        return null;
    }

    const [withDomain] = await attachDomainNames(supabase, [station]);
    return withDomain;
});

/*
 * ── Forwarding an old case's address to its replacement ──────────────────────
 *
 * When a case is replaced (case versions, Oct 2026) the old station is archived
 * and its public slug is stored on it as `archived_slug`, so the address it was
 * indexed under can forward permanently to the live case that took its place.
 * The lists above stay live-only (is_active mirrors lifecycle = 'live'), so an
 * archived case never renders a page of its own: it either forwards or 404s.
 *
 * Service role, because RLS hides archived rows from anon readers.
 */

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * How many replacements to follow. A case replaced, and its replacement later
 * replaced again, still forwards to the case live today; the cap only guards
 * against a malformed cycle in the data.
 */
const MAX_REPLACEMENT_HOPS = 5;

type ArchivedLookup = { archivedSlug: string } | { id: string };

/**
 * The id of the live case now standing in for an archived one, or null when
 * the lookup is not an archived case or nothing live replaces it (the caller
 * then 404s, as it always has). Never throws: a failed read is a null.
 */
export async function findLiveReplacementId(lookup: ArchivedLookup): Promise<string | null> {
    if ('id' in lookup && !UUID_RE.test(lookup.id)) return null;
    if ('archivedSlug' in lookup && !lookup.archivedSlug) return null;

    try {
        const supabase = getSupabaseAdmin();
        const base = supabase.from('stations').select('id').eq('lifecycle', 'archived');
        const { data: archived, error } = await ('id' in lookup
            ? base.eq('id', lookup.id)
            : base.eq('archived_slug', lookup.archivedSlug)
        ).maybeSingle();

        if (error) {
            console.error('[publicCases] archived case lookup failed', error);
            return null;
        }
        if (!archived) return null;

        let current = (archived as { id: string }).id;
        for (let hop = 0; hop < MAX_REPLACEMENT_HOPS; hop++) {
            const { data: next, error: nextError } = await supabase
                .from('stations')
                .select('id, lifecycle')
                .eq('replaces_station_id', current)
                .maybeSingle();

            if (nextError) {
                console.error('[publicCases] replacement lookup failed', nextError);
                return null;
            }
            const row = next as { id: string; lifecycle: string } | null;
            if (!row) return null;
            if (row.lifecycle === 'live') return row.id;
            // A draft replacement is not public yet: no forwarding until it is.
            if (row.lifecycle !== 'archived') return null;
            current = row.id;
        }
        return null;
    } catch (error: unknown) {
        console.error('[publicCases] archived case forwarding failed', error);
        return null;
    }
}

/**
 * Where an archived case's old address should now point: the replacement's
 * public path, computed over the live list with buildCaseSeoIndex so slug
 * overrides and collision suffixes apply exactly as on the replacement's own
 * page. Null when there is nowhere to forward to.
 */
export async function findArchivedCaseForwardPath(lookup: ArchivedLookup): Promise<string | null> {
    const replacementId = await findLiveReplacementId(lookup);
    if (!replacementId) return null;
    const live = buildCaseSeoIndex(await getPublicCasesForList());
    return live.find(caseItem => caseItem.id === replacementId)?.path ?? null;
}
