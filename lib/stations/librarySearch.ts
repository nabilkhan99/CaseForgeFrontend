/**
 * Client-side search, filtering and the daily recommendation for the case
 * library.
 *
 * The bank is 200 rows and the library already loads all of a domain's
 * stations, so everything here is in-memory: no new endpoints, no debounced
 * round trips, and filtering stays instant while someone types on a phone.
 *
 * Structurally typed against `Station` from the Supabase query layer rather
 * than importing it, so this module (and its tests) stay free of Supabase.
 */

export interface LibraryStation {
    id: string;
    title: string;
    patient_name: string;
    domain_id: string;
    domain_name: string;
    difficulty?: string | null;
    presenting_complaint?: string;
    attempts: readonly unknown[];
    passed: boolean;
}

export type LibraryStatus = 'all' | 'not-started' | 'attempted' | 'passed';

export const LIBRARY_STATUSES: ReadonlyArray<{ value: LibraryStatus; label: string }> = [
    { value: 'all', label: 'All' },
    { value: 'not-started', label: 'Not started' },
    { value: 'attempted', label: 'Attempted' },
    { value: 'passed', label: 'Passed' },
];

/** Anything that isn't one of the four is treated as no filter at all. */
export function parseStatus(raw?: string | null): LibraryStatus {
    return LIBRARY_STATUSES.some(s => s.value === raw) ? (raw as LibraryStatus) : 'all';
}

/**
 * "Attempted" is deliberately a superset that includes passed stations — it is
 * labelled "Attempted", not "Not passed yet", and a filter that quietly hid
 * rows matching its own label would be a small lie.
 */
export function stationStatus(station: LibraryStation): Exclude<LibraryStatus, 'all'> {
    if (station.passed) return 'passed';
    return station.attempts.length > 0 ? 'attempted' : 'not-started';
}

function matchesStatus(station: LibraryStation, status: LibraryStatus): boolean {
    switch (status) {
        case 'all':
            return true;
        case 'passed':
            return station.passed;
        case 'attempted':
            return station.attempts.length > 0;
        case 'not-started':
            return station.attempts.length === 0;
    }
}

/**
 * Fold accents, drop apostrophes outright (so "fathers" finds "father's") and
 * reduce everything else to single-spaced lowercase words.
 */
export function normaliseText(value: string): string {
    return value
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase()
        .replace(/['’‘]/g, '')
        .replace(/[^a-z0-9]+/g, ' ')
        .trim();
}

export function stationHaystack(station: LibraryStation): string {
    return normaliseText(
        [station.title, station.patient_name, station.presenting_complaint, station.domain_name]
            .filter(Boolean)
            .join(' '),
    );
}

/**
 * Every word in the query must appear somewhere in the row, in any order —
 * "chest pain" and "pain chest" both find the same case, and "smith chest"
 * narrows by patient and symptom together. Substring rather than whole-word
 * matching so partial typing ("cardio", "diabet") is useful before the word is
 * finished.
 */
export function matchesQuery(station: LibraryStation, query: string): boolean {
    const tokens = normaliseText(query).split(' ').filter(Boolean);
    if (tokens.length === 0) return true;
    const haystack = stationHaystack(station);
    return tokens.every(token => haystack.includes(token));
}

export interface LibraryFilter {
    query?: string;
    status?: LibraryStatus;
    domainId?: string;
}

export function isFilterActive({ query, status, domainId }: LibraryFilter): boolean {
    return Boolean(query?.trim()) || (status !== undefined && status !== 'all') || Boolean(domainId);
}

export function filterStations<T extends LibraryStation>(
    stations: readonly T[],
    { query = '', status = 'all', domainId }: LibraryFilter,
): T[] {
    return stations.filter(
        station =>
            (!domainId || station.domain_id === domainId) &&
            matchesStatus(station, status) &&
            matchesQuery(station, query),
    );
}

export interface DomainSummary {
    id: string;
    name: string;
    station_count: number;
    /** Distinct stations in this domain the user has completed at least once. */
    completed_count: number;
    /** Distinct stations whose best attempt passed. */
    passed_count: number;
}

/**
 * Domain rows, rolled up from the same station array the search filters.
 *
 * Previously the index page counted stations with its own query while the
 * domain page counted them again from a different one, which is how the
 * library came to disagree with itself about how many cases exist. One fetch,
 * one reduction, no way for the two levels to drift.
 */
export function summariseDomains(stations: readonly LibraryStation[]): DomainSummary[] {
    const byDomain = new Map<string, DomainSummary>();

    for (const station of stations) {
        let summary = byDomain.get(station.domain_id);
        if (!summary) {
            summary = {
                id: station.domain_id,
                name: station.domain_name,
                station_count: 0,
                completed_count: 0,
                passed_count: 0,
            };
            byDomain.set(station.domain_id, summary);
        }
        summary.station_count += 1;
        if (station.attempts.length > 0) summary.completed_count += 1;
        if (station.passed) summary.passed_count += 1;
    }

    return [...byDomain.values()].sort((a, b) => a.name.localeCompare(b.name));
}

export interface DomainBoardRow<T extends LibraryStation = LibraryStation> {
    domainId: string;
    domainName: string;
    /** Every station in the domain, in the order it arrived. */
    stations: T[];
    passedCount: number;
    total: number;
}

/**
 * The same station array again, but grouped rather than counted.
 *
 * summariseDomains() throws the stations away once it has the totals, which is
 * exactly right for a list of folders and useless to anything that has to draw
 * one mark per case. This keeps them, so the board and the roll-up are still
 * two readings of one fetch rather than two queries that can disagree.
 *
 * Ordered by size, largest first: the board is a map of where the work is, and
 * opening it on the deepest topic area says more than opening it on whichever
 * domain happens to start with "A" — the roll-up underneath is already the
 * alphabetical view. Name breaks ties so two nine-case domains never swap
 * places between renders.
 *
 * Station order inside a row is the order the query returned, deliberately not
 * re-sorted by status: a square's position is how you find the same case again
 * tomorrow, and squares that rearrange themselves when you pass one would make
 * the board unreadable as a map.
 */
export function groupStationsByDomain<T extends LibraryStation>(
    stations: readonly T[],
): DomainBoardRow<T>[] {
    const byDomain = new Map<string, DomainBoardRow<T>>();

    for (const station of stations) {
        let row = byDomain.get(station.domain_id);
        if (!row) {
            row = {
                domainId: station.domain_id,
                domainName: station.domain_name,
                stations: [],
                passedCount: 0,
                total: 0,
            };
            byDomain.set(station.domain_id, row);
        }
        row.stations.push(station);
        row.total += 1;
        if (station.passed) row.passedCount += 1;
    }

    return [...byDomain.values()].sort(
        (a, b) => b.total - a.total || a.domainName.localeCompare(b.domainName),
    );
}

/** FNV-1a. Small, dependency-free, and stable across runs and machines. */
export function hashSeed(seed: string): number {
    let hash = 0x811c9dc5;
    for (let i = 0; i < seed.length; i++) {
        hash ^= seed.charCodeAt(i);
        hash = Math.imul(hash, 0x01000193) >>> 0;
    }
    return hash >>> 0;
}

/**
 * The seed the daily recommendation rotates on: local calendar date, so it
 * turns over at the user's midnight rather than UTC's, plus a salt (the user
 * id) so two trainees opening the library on the same evening aren't pushed at
 * the same case.
 */
export function dailySeed(date: Date = new Date(), salt = ''): string {
    const day = [
        date.getFullYear(),
        String(date.getMonth() + 1).padStart(2, '0'),
        String(date.getDate()).padStart(2, '0'),
    ].join('-');
    return `${day}:${salt}`;
}

/**
 * One case to start with, so the library doesn't open on a wall of 29 folders.
 *
 * Only ever a station the user has never attempted — a recommendation to redo
 * something is a different feature — and stable for the whole day, so closing
 * the tab and coming back doesn't reshuffle the suggestion mid-decision.
 * Sorted by id first so the pick depends on the seed alone and not on whatever
 * order the query happened to return.
 */
export function pickNextForYou<T extends LibraryStation>(
    stations: readonly T[],
    seed: string,
): T | null {
    const eligible = stations
        .filter(station => station.attempts.length === 0)
        .sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
    if (eligible.length === 0) return null;
    return eligible[hashSeed(seed) % eligible.length];
}
