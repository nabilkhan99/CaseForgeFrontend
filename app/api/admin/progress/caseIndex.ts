/**
 * Admin progress, counted over each person's case index.
 *
 * The same rule as the library (lib/stations/caseVersions.ts): a person's bank
 * is every live case, with the old cases they keep in place of those cases'
 * replacements. So an attempt counts if it is on a live case, or on an archived
 * case that person keeps. An attempt on a replaced case they do not keep, or on
 * a draft an admin tried, is not progress through their bank.
 *
 * Lives beside the route rather than in it because a Next route file may only
 * export its handlers.
 */

import type { SupabaseClient } from '@supabase/supabase-js';

/** The parts of a session row the rule reads. */
export interface IndexedSession {
  user_id: string | null;
  station_id: string | null;
  stations: { lifecycle: string | null } | null;
}

/** One keeper pair, as a set key. */
export function keptPairKey(userId: string | null, stationId: string | null): string {
  return `${userId}:${stationId}`;
}

/**
 * Every (person, case) keeper pair on the given archived cases, in one query.
 *
 * Narrowed by station rather than by user: keeper rows only matter for
 * archived cases somebody actually attempted (at most the replaced cases),
 * whereas a list of every user id would build a URL longer than the answer.
 * Skipped entirely while nothing is archived. Fails closed to "nobody keeps
 * anything", as lib/stations/caseVersionsData.ts does: old-case passes then
 * drop out of the count rather than the page failing.
 */
export async function loadKeptPairs(
  supabase: SupabaseClient,
  archivedStationIds: readonly string[],
): Promise<Set<string>> {
  if (archivedStationIds.length === 0) return new Set();
  const { data, error } = await supabase
    .from('case_keepers')
    .select('user_id, station_id')
    .in('station_id', [...archivedStationIds]);
  if (error) {
    console.error('[admin-progress] keeper lookup failed', error);
    return new Set();
  }
  return new Set(
    ((data ?? []) as { user_id: string; station_id: string }[]).map((row) =>
      keptPairKey(row.user_id, row.station_id),
    ),
  );
}

/** Archived case ids that appear in these sessions: the only ones keepers matter for. */
export function archivedStationIds(sessions: readonly IndexedSession[]): string[] {
  const ids = new Set<string>();
  for (const session of sessions) {
    if (session.stations?.lifecycle === 'archived' && session.station_id) ids.add(session.station_id);
  }
  return [...ids];
}

/** Is this attempt on a case in its person's index? */
export function countsTowardsIndex(session: IndexedSession, kept: ReadonlySet<string>): boolean {
  const lifecycle = session.stations?.lifecycle;
  if (lifecycle === 'live') return true;
  if (lifecycle === 'archived') return kept.has(keptPairKey(session.user_id, session.station_id));
  return false;
}
