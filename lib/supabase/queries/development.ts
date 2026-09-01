/**
 * Queries behind the Development page.
 *
 * Two jobs, both of which exist so the page never has to trust the trend model
 * for a fact the database already holds: the per-domain grade series under the
 * averages row, and the station titles behind the evidence case ids.
 */

import { createClient } from '@/lib/supabase/client';
import type { DomainCasePoints } from '@/lib/development/domainAverages';
import { pointsFromResult } from '@/lib/development/domainPoints';

/**
 * How many marked cases the averages row describes, at most. Matches the report
 * window (MAX_TREND_CASES on the engine side): the window IS the candidate's
 * whole marked history until they outgrow this cap, so the picture starts
 * holistic and stays bounded.
 */
export const DOMAIN_WINDOW = 20;

/**
 * How many completed sessions to ask for to fill that window.
 *
 * Completed does not mean marked — a session whose marking failed, or one from
 * before the engine existed, is completed with nothing to average. Fetching
 * double the window and filtering here beats filtering on the embedded resource
 * server-side, which ties the query to PostgREST's embedded-filter behaviour
 * for the sake of a dozen rows.
 */
const FETCH_MULTIPLE = 2;

interface MarkedSessionRow {
  id: string;
  started_at: string | null;
  completed_at: string | null;
  session_results: { domains: unknown; weighted_score: number | string | null } | null;
}

/**
 * The user's most recent marked cases, oldest → newest.
 *
 * A result whose weighted score is zero is dropped, matching the rule the
 * dashboard's domain dials already apply: those rows are the engine having
 * marked an empty pre-engine transcript, and counting their CF grades would
 * drag every average down for consultations that never really happened.
 *
 * Ordered by `started_at` rather than `completed_at` — `completed_at` is
 * stamped when the *result* is written, so a slow marking run can reorder two
 * consultations relative to when they were actually sat.
 */
export async function getDomainCaseSeries(
  userId: string,
  window: number = DOMAIN_WINDOW,
): Promise<DomainCasePoints[]> {
  const supabase = createClient();

  const response = await supabase
    .from('clinical_sessions')
    .select(
      `
            id,
            started_at,
            completed_at,
            session_results (
                domains,
                weighted_score
            )
        `,
    )
    .eq('user_id', userId)
    .eq('status', 'completed')
    .order('started_at', { ascending: false })
    .limit(window * FETCH_MULTIPLE);

  const rows = response.data as unknown as MarkedSessionRow[] | null;
  if (!rows) return [];

  return rows
    .filter((row) => Number(row.session_results?.weighted_score ?? 0) > 0)
    .slice(0, window)
    .map((row) => ({
      sessionId: row.id,
      points: pointsFromResult(row.session_results?.domains),
    }))
    .filter((entry) => Object.keys(entry.points).length > 0)
    .reverse();
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
