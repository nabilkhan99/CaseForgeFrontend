/**
 * The reads behind lib/stations/caseVersionsAllowlist.ts: an allowlist's
 * slots and this person's keeper rows, then the per-person list.
 *
 * Takes the SERVICE-ROLE client: an archived case on (or replaced by
 * something on) an allowlist is invisible under RLS to anyone not marked on
 * it, and a non-keeper is exactly the person who needs it followed to its
 * replacement. `userId` scopes the keeper read and must be the signed-in
 * user's own.
 *
 * Edge-safe on purpose (no next/headers, no server client): the trial module
 * that calls it is also imported by the middleware.
 *
 * Cost today: one small read for a cohort's list, none for the trial's (its
 * flagged read already carries the version columns). The replacement read
 * happens only when a listed case is archived, the keeper read only when a
 * slot actually has another version.
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import { isStationLifecycle, type VersionedStation } from '@/lib/stations/caseVersions';
import { personalAllowlist, slotsHaveVersions, type AllowlistSlots } from '@/lib/stations/caseVersionsAllowlist';
import { loadKeptStationIdsOrThrow } from '@/lib/stations/caseVersionsData';

interface SlotRow {
    id: string;
    lifecycle: unknown;
    replaces_station_id: unknown;
}

/** A station row's version columns, narrowed; an unknown lifecycle reads as draft (opens nothing extra). */
export function toSlotStation(row: SlotRow): VersionedStation {
    return {
        id: row.id,
        lifecycle: isStationLifecycle(row.lifecycle) ? row.lifecycle : 'draft',
        replaces_station_id: typeof row.replaces_station_id === 'string' ? row.replaces_station_id : null,
    };
}

/** Old (archived) id → its LIVE replacement. Throws on a failed read. */
async function loadLiveReplacements(service: SupabaseClient, oldIds: readonly string[]): Promise<Map<string, string>> {
    const map = new Map<string, string>();
    if (oldIds.length === 0) return map;
    const { data, error } = await service
        .from('stations')
        .select('id, replaces_station_id')
        .eq('lifecycle', 'live')
        .in('replaces_station_id', [...oldIds]);
    if (error) throw new Error(`allowlist replacements read failed: ${error.message}`);
    for (const row of (data ?? []) as { id: string; replaces_station_id: string | null }[]) {
        if (row.replaces_station_id) map.set(row.replaces_station_id, row.id);
    }
    return map;
}

/**
 * This person's allowlist, when the allowlisted stations' own version columns
 * are already in hand (the trial's flagged read carries them). Reads the live
 * replacements only when an allowlisted case is archived, and the keeper rows
 * only when some slot has another version: nothing at all today.
 *
 * Fails closed to the list as written; see personaliseAllowlist.
 */
export async function personaliseKnownAllowlist(
    service: SupabaseClient,
    allowed: readonly string[],
    stations: readonly VersionedStation[],
    userId: string,
): Promise<string[]> {
    try {
        const archived = stations.filter((station) => station.lifecycle === 'archived').map((station) => station.id);
        const slots: AllowlistSlots = { stations, replacementOf: await loadLiveReplacements(service, archived) };
        if (!slotsHaveVersions(slots)) return [...allowed];
        const keptIds = await loadKeptStationIdsOrThrow(service, userId);
        return personalAllowlist(allowed, slots, keptIds);
    } catch (error: unknown) {
        console.error('[caseVersions] allowlist personalisation failed; using the list as written', error);
        return [...allowed];
    }
}

/**
 * This person's allowlist (see caseVersionsAllowlist.ts), or the allowlist
 * exactly as written when any read fails.
 *
 * FAILS CLOSED: the written list is a subset of the personal one, so a failed
 * read can only ever open less, never more. A keeper whose old case is reached
 * only through its replacement's id is refused for as long as the read is
 * down, and told so by the trial/cohort lock, which is recoverable.
 *
 * One read today (the listed stations' version columns).
 */
export async function personaliseAllowlist(
    service: SupabaseClient,
    allowed: readonly string[],
    userId: string,
): Promise<string[]> {
    if (allowed.length === 0) return [];
    const { data, error } = await service
        .from('stations')
        .select('id, lifecycle, replaces_station_id')
        .in('id', [...allowed]);
    if (error) {
        console.error('[caseVersions] allowlist stations read failed; using the list as written', error);
        return [...allowed];
    }
    return personaliseKnownAllowlist(service, allowed, ((data ?? []) as SlotRow[]).map(toSlotStation), userId);
}
