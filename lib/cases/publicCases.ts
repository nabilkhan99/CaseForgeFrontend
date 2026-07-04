import { cache } from 'react';
import { getSupabaseAdmin } from '@/lib/supabase/admin';

export interface PublicCase {
    id: string;
    title: string;
    patient_name: string;
    patient_age: number;
    difficulty: string | null;
    consultation_type: string | null;
    reading_duration_seconds: number;
    consultation_duration_seconds: number;
    candidate_instructions: string;
    station_script: string | null;
    data_gathering: string | null;
    clinical_management: string | null;
    relating_to_others: string | null;
    clinical_learning_points: string | null;
    domain_id: string;
    domain_name: string;
}

export interface PublicCaseDomain {
    id: string;
    name: string;
    description: string | null;
    cases: PublicCase[];
}

const CASE_SELECT =
    'id, title, patient_name, patient_age, difficulty, consultation_type, reading_duration_seconds, consultation_duration_seconds, candidate_instructions, station_script, data_gathering, clinical_management, relating_to_others, clinical_learning_points, domain_id';

export const getPublicCases = cache(async (): Promise<PublicCase[]> => {
    const supabase = getSupabaseAdmin();

    const { data: stations, error: stationsError } = await supabase
        .from('stations')
        .select(CASE_SELECT)
        .eq('is_active', true)
        .order('title');

    if (stationsError || !stations) {
        console.error('Error fetching public cases:', stationsError);
        return [];
    }

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
});

export const getPublicCasesGroupedByDomain = cache(async (): Promise<PublicCaseDomain[]> => {
    const cases = await getPublicCases();
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
});

export const getPublicCaseById = cache(async (id: string) => {
    const cases = await getPublicCases();
    return cases.find(caseItem => caseItem.id === id) || null;
});
