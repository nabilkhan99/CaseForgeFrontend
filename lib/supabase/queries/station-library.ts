/**
 * Station Library queries for Supabase
 * 
 * Functions to fetch domains & stations from the database
 */

import { createClient } from '@/lib/supabase/client';

export interface Domain {
    id: string;
    name: string;
    description: string;
    station_count: number;
    completed_count: number;
}

export interface CompletedAttempt {
    sessionId: string;
    score: number | null;
    completedAt: string;
}

export interface Station {
    id: string;
    title: string;
    patient_name: string;
    domain_id: string;
    domain_name: string;
    consultation_duration_seconds: number;
    difficulty: string;
    is_active: boolean;
    // User-specific data (from clinical_sessions)
    status: 'not-started' | 'in-progress' | 'completed';
    score?: number;
    sessionId?: string;
    last_attempted?: string;
    attempts: CompletedAttempt[];
}

/**
 * Fetch all domains with station counts and user progress
 */
export async function getDomains(userId?: string): Promise<Domain[]> {
    const supabase = createClient();

    // Get all domains
    const { data: domains, error: domainsError } = await supabase
        .from('domains')
        .select('id, name, description')
        .order('name');

    if (domainsError || !domains) {
        console.error('Error fetching domains:', domainsError);
        return [];
    }

    // Get station counts per domain
    const { data: stationCounts } = await supabase
        .from('stations')
        .select('domain_id')
        .eq('is_active', true);

    // Count stations per domain
    const countByDomain: Record<string, number> = {};
    stationCounts?.forEach(s => {
        countByDomain[s.domain_id] = (countByDomain[s.domain_id] || 0) + 1;
    });

    // Get user's completed sessions per domain if logged in
    const completedByDomain: Record<string, number> = {};
    if (userId) {
        const { data: sessions } = await supabase
            .from('clinical_sessions')
            .select('stations!inner(domain_id)')
            .eq('user_id', userId)
            .eq('status', 'completed');

        sessions?.forEach((s) => {
            const domainId = (s.stations as unknown as { domain_id: string }).domain_id;
            completedByDomain[domainId] = (completedByDomain[domainId] || 0) + 1;
        });
    }

    return domains.map(d => ({
        id: d.id,
        name: d.name,
        description: d.description,
        station_count: countByDomain[d.id] || 0,
        completed_count: completedByDomain[d.id] || 0,
    }));
}

/**
 * Fetch stations for a specific domain
 */
export async function getStationsForDomain(domainId: string, userId?: string): Promise<Station[]> {
    const supabase = createClient();

    // Fetch stations for domain
    const { data: stations, error } = await supabase
        .from('stations')
        .select('id, title, patient_name, domain_id, consultation_duration_seconds, difficulty, is_active')
        .eq('domain_id', domainId)
        .eq('is_active', true)
        .order('title');

    if (error) {
        console.error('Error fetching stations:', error.message, error.details, error.hint);
        return [];
    }

    if (!stations || stations.length === 0) {
        return [];
    }

    // Fetch domain name
    const { data: domain } = await supabase
        .from('domains')
        .select('name')
        .eq('id', domainId)
        .single();

    const domainName = domain?.name || 'Unknown';

    // Get user's sessions for each station if logged in
    // We track: the "display" session (most recent completed, else most recent any),
    // plus the full list of completed attempts.
    interface SessionInfo {
        id: string;
        status: string;
        overall_score: number | null;
        started_at: string;
        completed_at: string | null;
    }
    const latestByStation: Record<string, SessionInfo> = {};
    const attemptsByStation: Record<string, CompletedAttempt[]> = {};

    if (userId && stations.length > 0) {
        const { data: sessions } = await supabase
            .from('clinical_sessions')
            .select('id, station_id, status, overall_score, started_at, completed_at')
            .eq('user_id', userId)
            .in('station_id', stations.map(s => s.id))
            .order('started_at', { ascending: false });

        sessions?.forEach(session => {
            // Collect all completed attempts
            if (session.status === 'completed') {
                if (!attemptsByStation[session.station_id]) {
                    attemptsByStation[session.station_id] = [];
                }
                attemptsByStation[session.station_id].push({
                    sessionId: session.id,
                    score: session.overall_score,
                    completedAt: session.completed_at || session.started_at,
                });
            }

            // Pick the best display session: most recent completed wins
            const existing = latestByStation[session.station_id];
            if (!existing) {
                latestByStation[session.station_id] = session;
            } else if (session.status === 'completed' && existing.status !== 'completed') {
                latestByStation[session.station_id] = session;
            }
        });
    }

    return stations.map(s => {
        const session = latestByStation[s.id];
        const attempts = attemptsByStation[s.id] || [];
        let status: 'not-started' | 'in-progress' | 'completed' = 'not-started';
        if (session) {
            status = session.status === 'completed' ? 'completed' : 'in-progress';
        }

        // Use the most recent completed attempt for score display
        const latestCompleted = attempts.length > 0 ? attempts[0] : null;

        return {
            id: s.id,
            title: s.title,
            patient_name: s.patient_name,
            domain_id: s.domain_id,
            domain_name: domainName,
            consultation_duration_seconds: s.consultation_duration_seconds,
            difficulty: s.difficulty,
            is_active: s.is_active,
            status,
            score: latestCompleted?.score ?? undefined,
            sessionId: latestCompleted?.sessionId ?? session?.id,
            last_attempted: session?.started_at,
            attempts,
        };
    });
}

/**
 * Fetch all active stations (for random selection)
 */
export async function getAllStations(): Promise<Station[]> {
    const supabase = createClient();

    // Fetch stations
    const { data: stations, error } = await supabase
        .from('stations')
        .select('id, title, patient_name, domain_id, consultation_duration_seconds, difficulty, is_active')
        .eq('is_active', true)
        .order('title');

    if (error) {
        console.error('Error fetching all stations:', error.message, error.details, error.hint);
        return [];
    }

    if (!stations || stations.length === 0) {
        return [];
    }

    // Fetch domain names separately
    const domainIds = [...new Set(stations.map(s => s.domain_id))];
    const { data: domains } = await supabase
        .from('domains')
        .select('id, name')
        .in('id', domainIds);

    const domainMap: Record<string, string> = {};
    domains?.forEach(d => {
        domainMap[d.id] = d.name;
    });

    return stations.map(s => ({
        id: s.id,
        title: s.title,
        patient_name: s.patient_name,
        domain_id: s.domain_id,
        domain_name: domainMap[s.domain_id] || 'Unknown',
        consultation_duration_seconds: s.consultation_duration_seconds,
        difficulty: s.difficulty,
        is_active: s.is_active,
        status: 'not-started' as const,
        attempts: [],
    }));
}


/**
 * Get a random station (for "Start New" button)
 */
export async function getRandomStation(): Promise<Station | null> {
    const stations = await getAllStations();
    if (stations.length === 0) return null;

    const randomIndex = Math.floor(Math.random() * stations.length);
    return stations[randomIndex];
}
