/**
 * Station Library queries for Supabase.
 *
 * Every library surface reads stations through here. Domain roll-ups are no
 * longer a separate query — they are reduced from the station array by
 * summariseDomains() in lib/stations/librarySearch.ts, so the index page and
 * the domain page can never report different totals for the same bank.
 *
 * Every list here is the PERSON'S case index, not the raw catalogue: every
 * live case, except that a live case replacing an old case this person keeps
 * is swapped for that old case (resolveCaseIndex in
 * lib/stations/caseVersions.ts). A keeper therefore sees their old case in its
 * slot, with its attempts, scores and pass untouched (all keyed by station id),
 * and never its replacement as well. Everyone else sees the live bank. Today
 * every station is live and nobody keeps anything, so the index IS the live
 * bank and nothing changes until a batch is switched on.
 *
 * Staged-preview widening (`visibleStationStates()`) is not used here: a
 * non-live row is now a draft or a replaced case, and only caseVersions decides
 * who sees those.
 */

import { createClient } from '@/lib/supabase/client';
import { resolveCaseIndex, type StationLifecycle } from '@/lib/stations/caseVersions';
import { loadKeptStationIds } from '@/lib/stations/caseVersionsData';
import { extractPresentingComplaint } from '@/lib/stations/presentingComplaint';
import {
    markAttempt,
    reduceStationPassMap,
    type AttemptMark,
    type StationAttemptRow,
    type StationPassState,
} from '@/lib/supabase/queries/passTracking';
import type { Verdict } from '@/lib/clinical-master/types';

export interface CompletedAttempt {
    sessionId: string;
    /**
     * Legacy `clinical_sessions.overall_score`, on either of two historical
     * scales. Kept only for stations whose attempts predate the marking engine;
     * anything that compares attempts reads `mark` instead.
     */
    score: number | null;
    completedAt: string;
    /**
     * What this attempt itself scored, from `session_results` — the library
     * prints a verdict per attempt, which the station-level best verdict cannot
     * answer. Unmarked and artefact rows come back with a null verdict.
     */
    mark: AttemptMark;
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
    'id, title, patient_name, domain_id, consultation_duration_seconds, difficulty, is_active, lifecycle, replaces_station_id, candidate_instructions';

/**
 * The same minus the brief, for the dashboard's random pick: it never searches,
 * and 200 briefs would triple the payload.
 */
const STATION_LITE_COLUMNS =
    'id, title, patient_name, domain_id, consultation_duration_seconds, difficulty, is_active, lifecycle, replaces_station_id';

/** A station row as every library query selects it (the brief is optional). */
interface StationLiteRow {
    id: string;
    title: string;
    patient_name: string;
    domain_id: string;
    consultation_duration_seconds: number;
    difficulty: string;
    is_active: boolean;
    lifecycle: StationLifecycle;
    replaces_station_id: string | null;
}

interface StationRow extends StationLiteRow {
    candidate_instructions: string | null;
}

type BrowserClient = ReturnType<typeof createClient>;

/**
 * The archived cases this person keeps, as full rows.
 *
 * Skipped outright, no query at all, when they keep nothing, which is every
 * person until a batch is switched on and most people after. RLS lets a person
 * read an archived case they have a MARKED consultation on (migration
 * 20261006), and every keeper has one: that is what makes them a keeper.
 * Fails closed to "keeps nothing" like loadKeptStationIds: the person then sees
 * the live catalogue, never worse than before case versions existed.
 */
async function fetchKeptRows<T extends StationLiteRow>(
    supabase: BrowserClient,
    keptIds: ReadonlySet<string>,
    columns: string,
): Promise<T[]> {
    if (keptIds.size === 0) return [];
    const { data, error } = await supabase
        .from('stations')
        .select(columns)
        .in('id', [...keptIds])
        .eq('lifecycle', 'archived')
        .order('title')
        .overrideTypes<T[], { merge: false }>();
    if (error) {
        console.error('Error fetching kept stations:', error.message, error.details, error.hint);
        return [];
    }
    return data ?? [];
}

/** Keeper ids, then their rows; nothing at all for a signed-out caller. */
async function fetchKeptRowsForUser<T extends StationLiteRow>(
    supabase: BrowserClient,
    userId: string | undefined,
    columns: string,
): Promise<T[]> {
    if (!userId) return [];
    const keptIds = await loadKeptStationIds(supabase, userId);
    return fetchKeptRows<T>(supabase, keptIds, columns);
}

/**
 * This person's whole case index, in title order. null when the live
 * catalogue itself could not be read (callers log and show nothing, as before).
 *
 * The live query and the keeper lookup run side by side, so a person who keeps
 * nothing pays one extra small parallel request and no extra latency.
 */
async function fetchIndexRows<T extends StationLiteRow>(
    supabase: BrowserClient,
    userId: string | undefined,
    columns: string,
    label: string,
): Promise<T[] | null> {
    const [live, kept] = await Promise.all([
        supabase
            .from('stations')
            .select(columns)
            .eq('lifecycle', 'live')
            .order('title')
            .overrideTypes<T[], { merge: false }>(),
        fetchKeptRowsForUser<T>(supabase, userId, columns),
    ]);

    if (live.error) {
        console.error(`Error fetching ${label}:`, live.error.message, live.error.details, live.error.hint);
        return null;
    }
    return resolveCaseIndex(live.data ?? [], kept);
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

interface SessionResultJoin {
    verdict: string | null;
    weighted_score: number | string | null;
    max_score: number | string | null;
}

/**
 * Flatten one `clinical_sessions → session_results` row.
 *
 * The join has a unique constraint on session_id so PostgREST returns a single
 * object, but tolerate the array shape rather than silently dropping every mark
 * if that constraint ever changes.
 */
function toAttemptRow(session: { station_id: string; session_results: unknown }): StationAttemptRow {
    const joined = session.session_results as SessionResultJoin | SessionResultJoin[] | null;
    const result = Array.isArray(joined) ? (joined[0] ?? null) : joined;

    return {
        station_id: session.station_id,
        verdict: result?.verdict ?? null,
        weighted_score: result?.weighted_score ?? null,
        max_score: result?.max_score ?? null,
    };
}

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
        (sessions ?? []).filter(s => s.status === 'completed').map(toAttemptRow),
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
                // Same row, same rule as the pass map above: an attempt can
                // never show a verdict the station's pass state didn't count.
                mark: markAttempt(toAttemptRow(session)),
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
 * One topic's cases, as this person sees them.
 *
 * The index is resolved and THEN filtered by domain, so a kept old case shows
 * under its own topic even if its replacement was filed under another one, and
 * a replacement never shows to the person who keeps the case it replaced.
 *
 * Only this domain's live rows are fetched, not the whole bank with its 200
 * briefs: resolving against every kept case and then filtering gives exactly
 * the set a full-bank resolve would. The one difference is order: a kept case
 * whose replacement sits under another topic lands at the end of this list
 * rather than at that replacement's alphabetical slot, which in a list of this
 * topic's cases is the more sensible place anyway.
 */
export async function getStationsForDomain(domainId: string, userId?: string): Promise<Station[]> {
    const supabase = createClient();

    const [live, kept, domain] = await Promise.all([
        supabase
            .from('stations')
            .select(STATION_COLUMNS)
            .eq('domain_id', domainId)
            .eq('lifecycle', 'live')
            .order('title')
            .overrideTypes<StationRow[]>(),
        fetchKeptRowsForUser<StationRow>(supabase, userId, STATION_COLUMNS),
        supabase.from('domains').select('name').eq('id', domainId).single(),
    ]);

    if (live.error) {
        console.error('Error fetching stations:', live.error.message, live.error.details, live.error.hint);
        return [];
    }

    const stations = resolveCaseIndex(live.data ?? [], kept).filter(s => s.domain_id === domainId);
    if (stations.length === 0) {
        return [];
    }

    const domainName = domain.data?.name || 'Unknown';

    // Narrowed to the resolved ids, so a kept old case brings its own history.
    const progress = userId
        ? await fetchUserStationProgress(userId, stations.map(s => s.id))
        : EMPTY_PROGRESS;

    return stations.map(s => toStation(s, domainName, progress));
}

/**
 * Every station in this person's index, flat, with their progress on each.
 *
 * The library's only way in used to be 29 domain folders, so finding "the
 * chest pain one" meant guessing which folder it lived in. Search needs the
 * whole bank in one array; 200 rows is small enough to filter in the browser
 * and avoids a debounced query per keystroke on a phone.
 *
 * The dashboard's guarantee line counts passes off this same array, so a
 * keeper's pass on an old case counts for its slot and every person's
 * denominator is exactly the live count.
 */
export async function getStationIndex(userId?: string): Promise<Station[]> {
    const supabase = createClient();

    // Progress is fetched unnarrowed (filtering by 200 ids would build a URL
    // longer than the answer), so it needs nothing from the station rows and
    // runs alongside them.
    const [stations, domains, progress] = await Promise.all([
        fetchIndexRows<StationRow>(supabase, userId, STATION_COLUMNS, 'station index'),
        supabase.from('domains').select('id, name'),
        userId ? fetchUserStationProgress(userId) : Promise.resolve(EMPTY_PROGRESS),
    ]);

    if (!stations || stations.length === 0) {
        return [];
    }

    const domainNames: Record<string, string> = {};
    domains.data?.forEach(d => {
        domainNames[d.id] = d.name;
    });

    return stations.map(s => toStation(s, domainNames[s.domain_id] || 'Unknown', progress));
}

/**
 * Every station in this person's index, without progress (for random
 * selection). Resolved exactly like getStationIndex, so a keeper is never
 * offered the replacement of a case they keep.
 */
export async function getAllStations(userId?: string): Promise<Station[]> {
    const supabase = createClient();

    const stations = await fetchIndexRows<StationLiteRow>(
        supabase,
        userId,
        STATION_LITE_COLUMNS,
        'all stations',
    );

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
 * Get a random station from this person's index (for "Start New" button)
 */
export async function getRandomStation(userId?: string): Promise<Station | null> {
    const stations = await getAllStations(userId);
    if (stations.length === 0) return null;

    const randomIndex = Math.floor(Math.random() * stations.length);
    return stations[randomIndex];
}
