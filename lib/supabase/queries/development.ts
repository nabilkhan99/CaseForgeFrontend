/**
 * Queries behind the Development page.
 *
 * Two jobs, both of which exist so the page never has to trust the trend model
 * for a fact the database already holds: the per-domain grade series under the
 * averages row, and the station titles behind the evidence case ids.
 */

import { createClient } from '@/lib/supabase/client';
import type { DomainCasePoints } from '@/lib/development/domainAverages';
import {
  DOMAIN_FETCH_MULTIPLE,
  DOMAIN_WINDOW,
  MARKED_SESSION_COLUMNS,
  domainCaseSeriesFromRows,
  type MarkedSessionRow,
} from '@/lib/development/domainCaseSeries';

export { DOMAIN_WINDOW };

/**
 * The user's most recent marked cases, oldest → newest.
 *
 * The window, the columns and the row → points mapping live in
 * lib/development/domainCaseSeries.ts, shared with the trainer route that shows
 * a coach this same series for one of their students — see there for why
 * zero-score results are dropped and why the order is `started_at`.
 */
export async function getDomainCaseSeries(
  userId: string,
  window: number = DOMAIN_WINDOW,
): Promise<DomainCasePoints[]> {
  const supabase = createClient();

  const response = await supabase
    .from('clinical_sessions')
    .select(MARKED_SESSION_COLUMNS)
    .eq('user_id', userId)
    .eq('status', 'completed')
    .order('started_at', { ascending: false })
    .limit(window * DOMAIN_FETCH_MULTIPLE);

  const rows = response.data as unknown as MarkedSessionRow[] | null;
  if (!rows) return [];

  return domainCaseSeriesFromRows(rows, window);
}

interface CaseTitleRow {
  id: string;
  title: string | null;
}

/**
 * Titles for a set of evidence `case_id`s, which are STATION ids.
 *
 * The trend engine's input carries the station id as each case's id and the
 * model copies it verbatim, so this is a straight lookup — the first build of
 * this page assumed session ids and resolved nothing, which is exactly the
 * kind of silent contract drift this comment exists to stop. Ids that resolve
 * to nothing are simply absent from the map; the caller drops those rows
 * rather than showing a placeholder or a raw uuid.
 */
export async function getCaseTitles(stationIds: readonly string[]): Promise<Map<string, string>> {
  if (stationIds.length === 0) return new Map();

  const supabase = createClient();
  const response = await supabase
    .from('stations')
    .select('id, title')
    .in('id', [...stationIds]);

  const rows = response.data as unknown as CaseTitleRow[] | null;
  if (!rows) return new Map();

  return rows.reduce((titles, row) => {
    if (row.title) titles.set(row.id, row.title);
    return titles;
  }, new Map<string, string>());
}
