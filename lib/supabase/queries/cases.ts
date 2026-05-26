/**
 * Case Bank queries for Supabase
 * 
 * Functions to fetch cases for the public Case Bank page
 */

import { createClient } from '@/lib/supabase/client';

export interface CaseBankStation {
    id: string;
    title: string;
    patient_name: string;
    patient_age: number;
    difficulty: string | null;
    consultation_type: string | null;
    reading_duration_seconds: number;
    consultation_duration_seconds: number;
    candidate_instructions: string;
    domain_id: string;
    domain_name: string;
}

export interface CaseBankDomain {
    id: string;
    name: string;
    description: string | null;
    cases: CaseBankStation[];
}

export interface CaseDetail {
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
    domain_name: string;
}

/**
 * Fetch all active cases grouped by domain for the Case Bank listing
 */
export async function getCasesGroupedByDomain(): Promise<CaseBankDomain[]> {
    const supabase = createClient();

    // Fetch all active stations
    const { data: stations, error: stationsError } = await supabase
        .from('stations')
        .select('id, title, patient_name, patient_age, difficulty, consultation_type, reading_duration_seconds, consultation_duration_seconds, candidate_instructions, domain_id')
        .eq('is_active', true)
        .order('title');

    if (stationsError || !stations) {
        console.error('Error fetching stations:', stationsError);
        return [];
    }

    // Fetch all domains
    const domainIds = [...new Set(stations.map(s => s.domain_id))];
    const { data: domains, error: domainsError } = await supabase
        .from('domains')
        .select('id, name, description')
        .in('id', domainIds)
        .order('name');

    if (domainsError || !domains) {
        console.error('Error fetching domains:', domainsError);
        return [];
    }

    // Build domain map
    const domainMap: Record<string, { name: string; description: string | null }> = {};
    domains.forEach(d => {
        domainMap[d.id] = { name: d.name, description: d.description };
    });

    // Group stations by domain
    const grouped: Record<string, CaseBankStation[]> = {};
    stations.forEach(s => {
        if (!grouped[s.domain_id]) {
            grouped[s.domain_id] = [];
        }
        grouped[s.domain_id].push({
            id: s.id,
            title: s.title,
            patient_name: s.patient_name,
            patient_age: s.patient_age,
            difficulty: s.difficulty,
            consultation_type: s.consultation_type,
            reading_duration_seconds: s.reading_duration_seconds,
            consultation_duration_seconds: s.consultation_duration_seconds,
            candidate_instructions: s.candidate_instructions,
            domain_id: s.domain_id,
            domain_name: domainMap[s.domain_id]?.name || 'Unknown',
        });
    });

    // Build domain list
    return domains
        .filter(d => grouped[d.id]?.length > 0)
        .map(d => ({
            id: d.id,
            name: d.name,
            description: d.description,
            cases: grouped[d.id],
        }));
}

/**
 * Fetch a single case by ID with all detail fields
 */
export async function getCaseById(id: string): Promise<CaseDetail | null> {
    const supabase = createClient();

    const { data: station, error } = await supabase
        .from('stations')
        .select('id, title, patient_name, patient_age, difficulty, consultation_type, reading_duration_seconds, consultation_duration_seconds, candidate_instructions, station_script, data_gathering, clinical_management, relating_to_others, clinical_learning_points, domain_id')
        .eq('id', id)
        .single();

    if (error || !station) {
        console.error('Error fetching case:', error);
        return null;
    }

    // Fetch domain name
    const { data: domain } = await supabase
        .from('domains')
        .select('name')
        .eq('id', station.domain_id)
        .single();

    return {
        id: station.id,
        title: station.title,
        patient_name: station.patient_name,
        patient_age: station.patient_age,
        difficulty: station.difficulty,
        consultation_type: station.consultation_type,
        reading_duration_seconds: station.reading_duration_seconds,
        consultation_duration_seconds: station.consultation_duration_seconds,
        candidate_instructions: station.candidate_instructions,
        station_script: station.station_script,
        data_gathering: station.data_gathering,
        clinical_management: station.clinical_management,
        relating_to_others: station.relating_to_others,
        clinical_learning_points: station.clinical_learning_points,
        domain_name: domain?.name || 'Unknown',
    };
}
