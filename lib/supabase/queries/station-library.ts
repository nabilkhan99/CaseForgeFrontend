/**
 * Station Library queries for Supabase.
 *
 * Every library surface reads stations through here. Domain roll-ups are no
 * longer a separate query — they are reduced from the station array by
 * summariseDomains() in lib/stations/librarySearch.ts, so the index page and
 * the domain page can never report different totals for the same bank.
 */

import { createClient } from '@/lib/supabase/client';
import { visibleStationStates } from '@/lib/stations/visibility';
import { extractPresentingComplaint } from '@/lib/stations/presentingComplaint';
import {
    reduceStationPassMap,
    type StationAttemptRow,
    type StationPassState,
} from '@/lib/supabase/queries/passTracking';
import type { Verdict } from '@/lib/clinical-master/types';

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
    /**
     * The "Reason for Encounter" sentence from the candidate brief. Not a
     * column — see lib/stations/presentingComplaint.ts. Empty when the brief
     * doesn't carry one.
     */
    presenting_complaint: string;
    // User-specific data (from clinical_sessions)
    status: 'not-started' | 'in-progress' | 'completed';
    score?: number;
    sessionId?: string;
    last_attempted?: string;
    attempts: CompletedAttempt[];
    // Pass state, from session_results across every attempt (see passTracking.ts)
    /** Best attempt reached a passing verdict — a later fail never revokes it. */
    passed: boolean;
    /** Best verdict band achieved; null when nothing was genuinely marked. */
    bestVerdict: Verdict | null;
    /** Score of that same best attempt; null when nothing was genuinely marked. */
    bestScore: number | null;
    /** Denominator that attempt was marked out of; null when unknown. */
    bestMaxScore: number | null;
}

/**
 * The station columns every library surface needs, including the brief the
 * presenting complaint is parsed out of. Kept in one place so the domain page
 * and the flat index can never drift into fetching different shapes.
 */
const STATION_COLUMNS =
    'id, title, patient_name, domain_id, consultation_duration_seconds, difficulty, is_active, candidate_instructions';

interface StationRow {
    id: string;
    title: string;
    patient_name: string;
    domain_id: string;
    consultation_duration_seconds: number;
    difficulty: string;
    is_active: boolean;
    candidate_instructions: string | null;
}

interface SessionInfo {
    id: string;
    status: string;
    overall_score: number | null;
    started_at: string;
    completed_at: string | null;
}

interface UserStationProgress {
    /** Most recent completed session per station, else the most recent of any status. */
    latestByStation: Record<string, SessionInfo>;
    attemptsByStation: Record<string, CompletedAttempt[]>;
    passMap: Map<string, StationPassState>;
}

const EMPTY_PROGRESS: UserStationProgress = {
    latestByStation: {},
    attemptsByStation: {},
    passMap: new Map(),
};

/**
 * One user's attempt history, shaped for the library.
 *
 * `stationIds` narrows the query to a single domain; omit it for the flat
 * index, where filtering by 200 ids would build a URL longer than the answer.
 */
async function fetchUserStationProgress(
    userId: string,
    stationIds?: string[],
): Promise<UserStationProgress> {
    const supabase = createClient();

    // session_results rides along on the same query — the pass badge must not
    // cost the library page a second round trip. max_score comes with it so
    // the score denominator matches the feedback report for the same session.
    let query = supabase
        .from('clinical_sessions')
        .select('id, station_id, status, overall_score, started_at, completed_at, session_results(verdict, weighted_score, max_score)')
        .eq('user_id', userId);

    if (stationIds) {
        if (stationIds.length === 0) return EMPTY_PROGRESS;
        query = query.in('station_id', stationIds);
    }

    const { data: sessions } = await query.order('started_at', { ascending: false });

    // Only completed sessions carry a mark; an in-progress row would count
    // as an attempt it hasn't earned.
    const passMap = reduceStationPassMap(
        (sessions ?? [])
            .filter(s => s.status === 'completed')
            .map(s => {
                const result = s.session_results as unknown as {
                    verdict: string | null;
                    weighted_score: number | string | null;
                    max_score: number | string | null;
                } | null;
                return {
                    station_id: s.station_id,
                    verdict: result?.verdict ?? null,
                    weighted_score: result?.weighted_score ?? null,
                    max_score: result?.max_score ?? null,
                } satisfies StationAttemptRow;
            }),
    );

    const latestByStation: Record<string, SessionInfo> = {};
    const attemptsByStation: Record<string, CompletedAttempt[]> = {};

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

    return { latestByStation, attemptsByStation, passMap };
}

function toStation(row: StationRow, domainName: string, progress: UserStationProgress): Station {
    const session = progress.latestByStation[row.id];
    const attempts = progress.attemptsByStation[row.id] || [];
    let status: 'not-started' | 'in-progress' | 'completed' = 'not-started';
    if (session) {
        status = session.status === 'completed' ? 'completed' : 'in-progress';
    }

    // Use the most recent completed attempt for score display
    const latestCompleted = attempts.length > 0 ? attempts[0] : null;
    const passState = progress.passMap.get(row.id);

    return {
        id: row.id,
        title: row.title,
        patient_name: row.patient_name,
        domain_id: row.domain_id,
        domain_name: domainName,
        consultation_duration_seconds: row.consultation_duration_seconds,
        difficulty: row.difficulty,
        is_active: row.is_active,
        presenting_complaint: extractPresentingComplaint(row.candidate_instructions),
        status,
        score: latestCompleted?.score ?? undefined,
        sessionId: latestCompleted?.sessionId ?? session?.id,
        last_attempted: session?.started_at,
        attempts,
        passed: passState?.passed ?? false,
        bestVerdict: passState?.bestVerdict ?? null,
        bestScore: passState?.bestScore ?? null,
        bestMaxScore: passState?.bestMaxScore ?? null,
    };
}

/**
 * Fetch stations for a specific domain
 */
export async function getStationsForDomain(domainId: string, userId?: string): Promise<Station[]> {
    const supabase = createClient();

    // Fetch stations for domain
    const { data: stations, error } = await supabase
        .from('stations')
        .select(STATION_COLUMNS)
        .eq('domain_id', domainId)
        .in('is_active', visibleStationStates())
        .order('title')
        .overrideTypes<StationRow[]>();

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

    const progress = userId
        ? await fetchUserStationProgress(userId, stations.map(s => s.id))
        : EMPTY_PROGRESS;

    return stations.map(s => toStation(s, domainName, progress));
}

/**
 * Every visible station, flat, with the current user's progress on each.
 *
 * The library's only way in used to be 29 domain folders, so finding "the
 * chest pain one" meant guessing which folder it lived in. Search needs the
 * whole bank in one array; 200 rows is small enough to filter in the browser
 * and avoids a debounced query per keystroke on a phone.
 */
export async function getStationIndex(userId?: string): Promise<Station[]> {
    const supabase = createClient();

    const { data: stations, error } = await supabase
        .from('stations')
        .select(STATION_COLUMNS)
        .in('is_active', visibleStationStates())
        .order('title')
        .overrideTypes<StationRow[]>();

    if (error) {
        console.error('Error fetching station index:', error.message, error.details, error.hint);
        return [];
    }

    if (!stations || stations.length === 0) {
        return [];
    }

    const { data: domains } = await supabase.from('domains').select('id, name');
    const domainNames: Record<string, string> = {};
    domains?.forEach(d => {
        domainNames[d.id] = d.name;
    });

    const progress = userId ? await fetchUserStationProgress(userId) : EMPTY_PROGRESS;

    return stations.map(s => toStation(s, domainNames[s.domain_id] || 'Unknown', progress));
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
        .in('is_active', visibleStationStates())
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
        // Deliberately not parsed here: this feeds the dashboard's random pick,
        // which never searches, and the briefs would triple the payload.
        presenting_complaint: '',
        status: 'not-started' as const,
        attempts: [],
        passed: false,
        bestVerdict: null,
        bestScore: null,
        bestMaxScore: null,
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
