/**
 * Case versions: which version of a case each person sees, and may run.
 *
 * 121 of the 200 cases are being replaced (Ishaq's case bank update, Oct
 * 2026). The rule, agreed 5 Oct 2026:
 *
 *  - A person with a MARKED consultation on an old case is its "keeper". They
 *    keep the old case exactly as it was, in its slot, and see ONLY the old
 *    version there: never its replacement as well.
 *  - Everyone else sees the replacement in its place.
 *  - Catalogue and public surfaces show only live cases.
 *
 * Who keeps what is a snapshot written once per batch at switch-on
 * (public.case_keepers, filled by snapshot_case_keepers()). Nothing here works
 * keepers out from session history: callers pass the snapshot in.
 *
 * Database vocabulary (migration 20261005_case_versions.sql):
 *   stations.lifecycle            draft | live | archived
 *   stations.is_active            mirrors lifecycle = 'live' (check constraint)
 *   stations.replaces_station_id  on a new case, the old case it replaces
 *
 * Every surface that lists or starts cases for a signed-in person goes through
 * this module, so the rule lives in exactly one place. Everything here is pure:
 * the queries live with their callers.
 */

export type StationLifecycle = 'draft' | 'live' | 'archived';

export const STATION_LIFECYCLES: readonly StationLifecycle[] = ['draft', 'live', 'archived'];

/** The columns this module reasons about. Callers' rows may carry more. */
export interface VersionedStation {
    id: string;
    lifecycle: StationLifecycle;
    replaces_station_id: string | null;
}

export function isStationLifecycle(value: unknown): value is StationLifecycle {
    return typeof value === 'string' && (STATION_LIFECYCLES as readonly string[]).includes(value);
}

/**
 * One person's case index: every live case, except that a live case replacing
 * an old case this person keeps is swapped for that old case, in its position.
 *
 * `live` is the catalogue in display order. `kept` is the archived cases this
 * person keeps (rows they can read: RLS lets a person read an archived case
 * they have a MARKED consultation on, and every keeper has one).
 *
 * A kept case whose replacement is not live (not switched on yet, or never
 * written) is appended at the end, so a keeper never loses a case they did. In
 * a consistent bank that never happens: the switch-on archives an old case in
 * the same transaction its replacement goes live.
 *
 * Anything in `live` that is not actually live, and anything in `kept` that is
 * not archived, is ignored: the lists are trusted for membership, not state.
 */
export function resolveCaseIndex<T extends VersionedStation>(live: readonly T[], kept: readonly T[]): T[] {
    const keptById = new Map<string, T>();
    for (const station of kept) {
        if (station.lifecycle === 'archived') keptById.set(station.id, station);
    }

    const placed = new Set<string>();
    const index: T[] = [];
    for (const station of live) {
        if (station.lifecycle !== 'live') continue;
        const replaced = station.replaces_station_id;
        const keptOld = replaced ? keptById.get(replaced) : undefined;
        if (keptOld) {
            if (!placed.has(keptOld.id)) {
                index.push(keptOld);
                placed.add(keptOld.id);
            }
            continue;
        }
        index.push(station);
    }

    for (const station of keptById.values()) {
        if (!placed.has(station.id)) index.push(station);
    }
    return index;
}

export type RunRefusal =
    | 'draft' // unreleased, and the person is not an admin
    | 'archived_not_kept' // replaced, and this person is not a keeper
    | 'replaced_for_keeper'; // live, but it replaces a case this person keeps

export type RunDecision = { allowed: true } | { allowed: false; reason: RunRefusal };

/**
 * May this person start a consultation on this case?
 *
 * Only the version rule: entitlement, cohort and trial checks stay where they
 * are and run as well. Admins may run anything, so Ishaq can try a draft before
 * approving it. A keeper may not run the replacement of the case they keep:
 * they see only the old version, by decision.
 */
export function decideCanRun(
    station: VersionedStation,
    viewer: { keptIds: ReadonlySet<string>; isAdmin: boolean },
): RunDecision {
    if (viewer.isAdmin) return { allowed: true };
    if (station.lifecycle === 'draft') return { allowed: false, reason: 'draft' };
    if (station.lifecycle === 'archived') {
        return viewer.keptIds.has(station.id) ? { allowed: true } : { allowed: false, reason: 'archived_not_kept' };
    }
    if (station.replaces_station_id && viewer.keptIds.has(station.replaces_station_id)) {
        return { allowed: false, reason: 'replaced_for_keeper' };
    }
    return { allowed: true };
}

/** A person-facing sentence for a refusal. No ids, no jargon. */
export function runRefusalMessage(reason: RunRefusal): string {
    switch (reason) {
        case 'draft':
            return 'This case is not available yet.';
        case 'archived_not_kept':
            return 'This case has been replaced by a newer version in your library.';
        case 'replaced_for_keeper':
            return 'You have the earlier version of this case in your library.';
    }
}

/**
 * Where to send someone who asks for a case they cannot run: the version of
 * that slot they DO see, or null if there is nothing better to offer.
 *
 * `replacementOf` maps an old case id to the live case replacing it.
 */
export function redirectTargetFor(
    station: VersionedStation,
    reason: RunRefusal,
    replacementOf: ReadonlyMap<string, string>,
): string | null {
    if (reason === 'archived_not_kept') return replacementOf.get(station.id) ?? null;
    if (reason === 'replaced_for_keeper') return station.replaces_station_id;
    return null;
}
