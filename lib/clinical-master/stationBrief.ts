/**
 * What the pre-consultation brief page renders, and how a station row becomes
 * it. Shared by the page's own browser read and by the server route it falls
 * back to (app/api/clinical-master/station-brief/[id]), so the two can never
 * render the same case differently. Pure: no client, no server imports.
 */

export interface StationBrief {
    id: string;
    title: string;
    patient_name: string;
    candidate_instructions: string;
    reading_duration_seconds: number;
    consultation_duration_seconds: number;
    domain_name: string;
}

/** The stations columns a brief is built from (plus the version columns the page checks). */
export const STATION_BRIEF_COLUMNS =
    'id, title, patient_name, candidate_instructions, domain_id, reading_duration_seconds, consultation_duration_seconds';

export interface StationBriefRow {
    id: string;
    title: string;
    patient_name: string;
    candidate_instructions: string | null;
    reading_duration_seconds: number | null;
    consultation_duration_seconds: number | null;
}

/** The page's long-standing defaults: 3 minutes' reading, a 12-minute consultation. */
export function toStationBrief(row: StationBriefRow, domainName: string | null | undefined): StationBrief {
    return {
        id: row.id,
        title: row.title,
        patient_name: row.patient_name,
        candidate_instructions: row.candidate_instructions || '',
        reading_duration_seconds: row.reading_duration_seconds || 180,
        consultation_duration_seconds: row.consultation_duration_seconds || 720,
        domain_name: domainName || 'General Practice',
    };
}
