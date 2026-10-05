/**
 * The two reads every case-version decision needs, shared by the browser
 * library and the server gates so they can never disagree.
 *
 * Takes any Supabase client:
 *  - the browser/user client: RLS returns only the person's own keeper rows
 *    (policy "users read their own kept cases") and only archived stations they
 *    have a consultation on (policy "signed-in users can read archived cases
 *    they have used"), which covers every case they keep;
 *  - the service-role client on the server: reads everything, so callers MUST
 *    pass the right userId.
 *
 * Both functions fail CLOSED to "keeps nothing", logging the error: a person
 * then sees the live catalogue, which is never worse than today's behaviour.
 */

import type { SupabaseClient } from '@supabase/supabase-js';

/** Ids of the old cases this person keeps. */
export async function loadKeptStationIds(supabase: SupabaseClient, userId: string): Promise<Set<string>> {
    const { data, error } = await supabase.from('case_keepers').select('station_id').eq('user_id', userId);
    if (error) {
        console.error('[caseVersions] keeper lookup failed', error);
        return new Set();
    }
    return new Set((data ?? []).map((row) => (row as { station_id: string }).station_id));
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
