import { cache } from 'react';
import { getSupabaseAdmin } from '@/lib/supabase/admin';

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
    'id, title, patient_name, patient_age, difficulty, consultation_type, reading_duration_seconds, consultation_duration_seconds, candidate_instructions, station_script, data_gathering, clinical_management, relating_to_others, clinical_learning_points, domain_id';

// Card-display fields only — list page, avoids pulling the large text blobs for every card.
const CASE_SELECT_LIST =
    'id, title, patient_name, patient_age, consultation_type, consultation_duration_seconds, domain_id';

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
