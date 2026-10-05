/**
 * Case versions and ALLOWLISTS: the trial's five cases and a cohort's assigned
 * cases are lists of station ids, written before any case was replaced. Once a
 * batch is switched on, an id on such a list may name the old version of a
 * slot or the new one, and which of the two a person can actually run depends
 * on whether they keep the old case (lib/stations/caseVersions.ts). So
 * membership has to be read per person, by SLOT, not by raw id.
 *
 * For one person, an allowlisted id X also covers:
 *   (a) the archived case X replaced, when this person keeps it: a keeper of
 *       the old case only ever sees the old version, so a list naming the
 *       replacement must still open the old case for them;
 *   (b) the live replacement of X, when X is archived and this person does
 *       NOT keep it: everyone else is sent to the replacement, so a list naming
 *       the old case must open the replacement for them.
 * X itself always stays on the list; the version rule (decideCanRun) still
 * refuses the version of a slot this person does not see, and forwards them.
 *
 * This is the ONE place that widening is written. The server applies it once,
 * when it loads the person's entitlement (lib/commerce/serverEntitlement.ts),
 * so create-session, realtime-token, /api/subscription and every client lock
 * drawn from /api/subscription read the same per-person list.
 *
 * One hop only: a replacement of a replacement is not followed. Every batch
 * replaces an original case, so chains do not occur in this bank.
 *
 * Today every case is live and replaces nothing, so the personal list IS the
 * allowlist, unchanged.
 */

import type { VersionedStation } from '@/lib/stations/caseVersions';

/** What the widening needs to know about the allowlisted ids' slots. */
export interface AllowlistSlots {
    /** The allowlisted stations' own version columns (ids not found are simply absent). */
    stations: readonly VersionedStation[];
    /** Old (archived) case id → the LIVE case replacing it. */
    replacementOf: ReadonlyMap<string, string>;
}

/**
 * This person's allowlist: every allowlisted id, each followed by the other
 * version of its slot that (a) or (b) above opens for them. Order kept (the
 * trial's five are in `free_trial_order`), duplicates dropped.
 */
export function personalAllowlist(
    allowed: readonly string[],
    slots: AllowlistSlots,
    keptIds: ReadonlySet<string>,
): string[] {
    const byId = new Map(slots.stations.map((station) => [station.id, station]));
    const out: string[] = [];
    const seen = new Set<string>();
    const add = (id: string) => {
        if (seen.has(id)) return;
        seen.add(id);
        out.push(id);
    };

    for (const id of allowed) {
        add(id);
        const station = byId.get(id);
        if (!station) continue;
        // (a) X replaces a case this person keeps: open the kept old case.
        const replaced = station.replaces_station_id;
        if (replaced && keptIds.has(replaced)) add(replaced);
        // (b) X is archived and not kept: open its live replacement.
        if (station.lifecycle === 'archived' && !keptIds.has(id)) {
            const replacement = slots.replacementOf.get(id);
            if (replacement) add(replacement);
        }
    }
    return out;
}

/**
 * True when any allowlisted slot has another version at all, i.e. when keeper
 * rows could change the answer. False for today's bank, which lets a caller
 * skip the keeper read entirely.
 */
export function slotsHaveVersions(slots: AllowlistSlots): boolean {
    return slots.replacementOf.size > 0 || slots.stations.some((station) => station.replaces_station_id !== null);
}

/**
 * The trial panel's cases: for each allowlisted SLOT, the one version of it in
 * this person's case index. `personalIds` is the personal allowlist (above),
 * `index` the person's resolved index (resolveCaseIndex), which holds exactly
 * one version of every slot, so each slot shows once whichever id the list
 * named. Ordered by the list.
 */
export function stationsForAllowlist<T extends { id: string }>(personalIds: readonly string[], index: readonly T[]): T[] {
    const byId = new Map(index.map((station) => [station.id, station]));
    const out: T[] = [];
    const seen = new Set<string>();
    for (const id of personalIds) {
        const station = byId.get(id);
        if (!station || seen.has(station.id)) continue;
        seen.add(station.id);
        out.push(station);
    }
    return out;
}
