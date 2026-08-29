/**
 * Queries behind the Development page.
 *
 * Two jobs, both of which exist so the page never has to trust the trend model
 * for a fact the database already holds: the per-domain grade series under the
 * averages row, and the station titles behind the evidence case ids.
 */

import { createClient } from '@/lib/supabase/client';
import type { DomainKey } from '@/lib/clinical-master/types';
import type { DomainCasePoints } from '@/lib/development/domainAverages';

/** How many marked cases the averages row describes. Matches the report window. */
export const DOMAIN_WINDOW = 12;

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

/** CP/P/F/CF as grade points; clinical management carries a 1.5x weight. */
const CLINICAL_MANAGEMENT_WEIGHT = 1.5;

const DOMAIN_KEYS: readonly DomainKey[] = [
  'data_gathering',
  'clinical_management',
  'relating_to_others',
];

/** One entry of `session_results.domains`, as much of it as we read. */
interface GradedDomain {
  domain?: unknown;
  grade_points?: unknown;
  weighted_points?: unknown;
}

interface MarkedSessionRow {
  id: string;
  started_at: string | null;
  completed_at: string | null;
  session_results: { domains: unknown; weighted_score: number | string | null } | null;
}

function isDomainKey(value: unknown): value is DomainKey {
  return typeof value === 'string' && (DOMAIN_KEYS as readonly string[]).includes(value);
}

/**
 * Weighted points for one graded domain.
 *
 * Prefers the engine's own `weighted_points` and falls back to applying the
 * weight here, the same way the feedback report does — older result rows
 * predate the field, and recomputing it is exact rather than approximate.
 */
function weightedPointsOf(entry: GradedDomain, domain: DomainKey): number | null {
  const stored = Number(entry.weighted_points);
  if (Number.isFinite(stored) && entry.weighted_points != null) return stored;

  const raw = Number(entry.grade_points);
  if (!Number.isFinite(raw) || entry.grade_points == null) return null;
  return domain === 'clinical_management' ? raw * CLINICAL_MANAGEMENT_WEIGHT : raw;
}

function pointsFromResult(domains: unknown): Partial<Record<DomainKey, number>> {
  if (!Array.isArray(domains)) return {};
  return domains.reduce<Partial<Record<DomainKey, number>>>((accumulated, entry) => {
    if (typeof entry !== 'object' || entry === null) return accumulated;
    const graded = entry as GradedDomain;
    if (!isDomainKey(graded.domain)) return accumulated;
    const points = weightedPointsOf(graded, graded.domain);
    if (points === null) return accumulated;
    return { ...accumulated, [graded.domain]: points };
  }, {});
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
  stations: { title: string | null } | null;
}

/**
 * Station titles for a set of `clinical_sessions.id`s.
 *
 * Only called for ids the page could not already name from the history it
 * loaded for the chart — evidence can reach back further than one page of
 * history, but usually doesn't, so the common case costs nothing. Ids that
 * resolve to nothing are simply absent from the map; the caller decides what to
 * say about them, and it is never the raw uuid.
 */
export async function getCaseTitles(sessionIds: readonly string[]): Promise<Map<string, string>> {
  if (sessionIds.length === 0) return new Map();

  const supabase = createClient();
  const response = await supabase
    .from('clinical_sessions')
    .select('id, stations (title)')
    .in('id', [...sessionIds]);

  const rows = response.data as unknown as CaseTitleRow[] | null;
  if (!rows) return new Map();

  return rows.reduce((titles, row) => {
    const title = row.stations?.title;
    if (title) titles.set(row.id, title);
    return titles;
  }, new Map<string, string>());
}
