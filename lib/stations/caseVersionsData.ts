/**
 * The two reads every case-version decision needs, shared by the browser
 * library and the server gates so they can never disagree.
 *
 * Takes any Supabase client:
 *  - the browser/user client: RLS returns only the person's own keeper rows
 *    (policy "users read their own kept cases") and only archived stations they
 *    have a MARKED consultation on (policy "signed-in users can read archived
 *    cases they have been marked on", migration 20261006), which covers every
 *    case they keep, since a keeper is exactly someone marked on it;
 *  - the service-role client on the server: reads everything, so callers MUST
 *    pass the right userId.
 *
 * loadKeptStationIds and loadReplacementMap fail to EMPTY, logging the error:
 * in the browser library a person then sees the live catalogue, which is never
 * worse than today's behaviour. The server gates must not guess, so they use
 * loadKeptStationIdsOrThrow and answer "try again" on a failed read.
 */

import type { SupabaseClient } from '@supabase/supabase-js';

/**
 * Ids of the old cases this person keeps, THROWING when the read fails.
 *
 * For the server gates (caseVersionsServer.ts) and anything else that decides
 * who may run what: there, "keeps nothing" is not a safe guess. It would refuse
 * a keeper their own old case and hand them the replacement the rule says
 * they must never see, so a gate turns the throw into a "try again" instead.
 */
export async function loadKeptStationIdsOrThrow(supabase: SupabaseClient, userId: string): Promise<Set<string>> {
    const { data, error } = await supabase.from('case_keepers').select('station_id').eq('user_id', userId);
    if (error) throw new KeeperLookupError(error);
    return new Set((data ?? []).map((row) => (row as { station_id: string }).station_id));
}

/** The keeper read failed; carries the PostgREST error for the log. */
export class KeeperLookupError extends Error {
    readonly detail: unknown;
    constructor(detail: unknown) {
        super('case_keepers read failed');
        this.name = 'KeeperLookupError';
        this.detail = detail;
    }
}

/**
 * Ids of the old cases this person keeps, failing to EMPTY on a read error.
 *
 * For the browser library only, where an empty answer just shows the live
 * catalogue for one page load (never worse than before case versions). Server
 * gates use loadKeptStationIdsOrThrow.
 */
export async function loadKeptStationIds(supabase: SupabaseClient, userId: string): Promise<Set<string>> {
    try {
        return await loadKeptStationIdsOrThrow(supabase, userId);
    } catch (error: unknown) {
        console.error('[caseVersions] keeper lookup failed', error instanceof KeeperLookupError ? error.detail : error);
        return new Set();
    }
}

/**
 * Old case id → the live case replacing it. For forwarding a request for an
 * old case to the version this person sees.
 */
export async function loadReplacementMap(
    supabase: SupabaseClient,
    oldIds: readonly string[],
): Promise<Map<string, string>> {
    if (oldIds.length === 0) return new Map();
    const { data, error } = await supabase
        .from('stations')
        .select('id, replaces_station_id')
        .eq('lifecycle', 'live')
        .in('replaces_station_id', [...oldIds]);
    if (error) {
        console.error('[caseVersions] replacement lookup failed', error);
        return new Map();
    }
    const map = new Map<string, string>();
    for (const row of (data ?? []) as { id: string; replaces_station_id: string | null }[]) {
        if (row.replaces_station_id) map.set(row.replaces_station_id, row.id);
    }
    return map;
}
