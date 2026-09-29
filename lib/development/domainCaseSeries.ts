/**
 * The per-domain grade series under the Development page's averages row: which
 * sessions to read, and how the rows become points.
 *
 * Lifted out of lib/supabase/queries/development.ts when the trainer view of a
 * student's Development page needed the same series server-side. That module
 * imports the BROWSER Supabase client, so a route handler cannot use it; the
 * window, the columns and the row filtering live here instead, and both callers
 * run the same query shape through the same mapping. A coach seeing a different
 * average from the one their student sees for the same cases would be exactly
 * the drift domainPoints.ts was split out to prevent.
 *
 * Pure: no client, no I/O, safe in every runtime.
 */

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
 * How many completed sessions to ask for per case in the window.
 *
 * Completed does not mean marked — a session whose marking failed, or one from
 * before the engine existed, is completed with nothing to average. Fetching
 * double the window and filtering here beats filtering on the embedded resource
 * server-side, which ties the query to PostgREST's embedded-filter behaviour
 * for the sake of a dozen rows.
 */
export const DOMAIN_FETCH_MULTIPLE = 2;

/**
 * The `clinical_sessions` columns the series reads. Callers filter on
 * `user_id` and `status = 'completed'`, order by `started_at` descending and
 * cap at `window * DOMAIN_FETCH_MULTIPLE`.
 *
 * Ordered by `started_at` rather than `completed_at` — `completed_at` is
 * stamped when the *result* is written, so a slow marking run can reorder two
 * consultations relative to when they were actually sat.
 */
export const MARKED_SESSION_COLUMNS =
  'id, started_at, completed_at, session_results(domains, weighted_score)';

export interface MarkedSessionRow {
  id: string;
  started_at: string | null;
  completed_at: string | null;
  session_results: { domains: unknown; weighted_score: number | string | null } | null;
}

/**
 * Newest-first session rows → the most recent marked cases, oldest → newest.
 *
 * A result whose weighted score is zero is dropped, matching the rule the
 * dashboard's domain dials already apply: those rows are the engine having
 * marked an empty pre-engine transcript, and counting their CF grades would
 * drag every average down for consultations that never really happened.
 */
export function domainCaseSeriesFromRows(
  rows: readonly MarkedSessionRow[],
  window: number = DOMAIN_WINDOW,
): DomainCasePoints[] {
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
