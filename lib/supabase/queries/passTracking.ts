/**
 * Per-station pass tracking.
 *
 * "Passed" is a property of a STATION, not of a session: a user has passed a
 * station once any attempt at it reached a passing verdict. Best attempt wins,
 * so a fail after a pass never takes the pass away.
 *
 * Two data landmines this module exists to absorb:
 *
 *  1. `weighted_score <= 0` rows are legacy artefacts — the marking engine
 *     scoring an empty pre-engine transcript — not genuine fails. They carry a
 *     verdict (usually 'Fail'), so anything that trusts `verdict` alone paints
 *     red FAIL badges on consultations that never happened. Every aggregate
 *     here requires a verdict AND a positive weighted score.
 *  2. `clinical_sessions.overall_score` has two historical scales (old ~0-100,
 *     new 0-10.5) and is therefore useless for comparison. We read verdict and
 *     weighted_score off `session_results` only.
 *
 * The reducer is pure and exported separately so it can be unit-tested without
 * a database; the query wrapper is the only part that touches Supabase.
 */

import { createClient } from '@/lib/supabase/client';
import { PASSING_VERDICTS, type Verdict } from '@/lib/clinical-master/types';

/**
 * One completed attempt, flattened from the
 * clinical_sessions -> session_results join. `verdict`/`weighted_score` are
 * null for sessions that were never marked.
 */
export interface StationAttemptRow {
  station_id: string | null;
  verdict: string | null;
  weighted_score: number | string | null;
}

/** What a user has achieved at one station, across all their attempts. */
export interface StationPassState {
  /** Any attempt reached a passing verdict with a real (positive) score. */
  passed: boolean;
  /** Best verdict achieved across scored attempts; null if none were scored. */
  bestVerdict: Verdict | null;
  /** Highest weighted score across scored attempts; null if none were scored. */
  bestScore: number | null;
  /** Completed attempts, including unscored ones. */
  attempts: number;
}

/** Best-first, so a later attempt only replaces an earlier one by improving on it. */
const VERDICT_RANK: Record<Verdict, number> = {
  Pass: 3,
  'Bare Pass': 2,
  'Bare Fail': 1,
  Fail: 0,
};

function asVerdict(value: string | null): Verdict | null {
  return value !== null && value in VERDICT_RANK ? (value as Verdict) : null;
}

/**
 * Reduce completed attempts to one pass state per station.
 *
 * An attempt counts towards verdict/score only when it is genuinely scored
 * (known verdict AND weighted_score > 0 — see landmine 1 above); unscored and
 * artefact rows still count as attempts, because the user did sit them.
 *
 * `bestVerdict` is the best verdict ranked by band, not the verdict of the
 * highest-scoring attempt, which keeps it consistent with `passed`: a station
 * is passed exactly when its bestVerdict is a passing one.
 */
export function reduceStationPassMap(
  rows: readonly StationAttemptRow[],
): Map<string, StationPassState> {
  const byStation = new Map<string, StationPassState>();

  for (const row of rows) {
    if (!row.station_id) continue;

    const current = byStation.get(row.station_id) ?? {
      passed: false,
      bestVerdict: null,
      bestScore: null,
      attempts: 0,
    };

    const score = row.weighted_score === null ? null : Number(row.weighted_score);
    const verdict = asVerdict(row.verdict);
    const scored = verdict !== null && score !== null && Number.isFinite(score) && score > 0;

    const bestVerdict =
      scored &&
      (current.bestVerdict === null ||
        VERDICT_RANK[verdict] > VERDICT_RANK[current.bestVerdict])
        ? verdict
        : current.bestVerdict;

    byStation.set(row.station_id, {
      passed: current.passed || (scored && PASSING_VERDICTS.includes(verdict)),
      bestVerdict,
      bestScore: scored ? Math.max(current.bestScore ?? score, score) : current.bestScore,
      attempts: current.attempts + 1,
    });
  }

  return byStation;
}

/** Station ids the user has passed, from an already-reduced map. */
export function passedStationIds(passMap: Map<string, StationPassState>): Set<string> {
  const passed = new Set<string>();
  for (const [stationId, state] of passMap) {
    if (state.passed) passed.add(stationId);
  }
  return passed;
}

/**
 * Every station this user has attempted, with its pass state.
 *
 * One round trip: completed sessions joined to their (1:1) marking result.
 * Guest sessions never appear — they carry a null user_id and are filtered out
 * by the user_id match.
 */
export async function getStationPassMap(userId: string): Promise<Map<string, StationPassState>> {
  const supabase = createClient();

  const { data, error } = await supabase
    .from('clinical_sessions')
    .select('station_id, session_results(verdict, weighted_score)')
    .eq('user_id', userId)
    .eq('status', 'completed');

  if (error) {
    console.error('[passTracking] session query failed', error);
    return new Map();
  }

  return reduceStationPassMap(flattenSessionRows(data));
}

interface JoinedSessionRow {
  station_id: string | null;
  session_results: { verdict: string | null; weighted_score: number | string | null } | null;
}

/**
 * Flatten the PostgREST join shape. `session_results` has a unique constraint
 * on session_id, so it arrives as a single object (or null), not an array —
 * but tolerate the array shape rather than silently dropping every result if
 * that constraint ever changes.
 */
export function flattenSessionRows(rows: unknown): StationAttemptRow[] {
  if (!Array.isArray(rows)) return [];

  return (rows as JoinedSessionRow[]).map((row) => {
    const joined = row.session_results;
    const result = Array.isArray(joined) ? (joined[0] ?? null) : joined;
    return {
      station_id: row.station_id,
      verdict: result?.verdict ?? null,
      weighted_score: result?.weighted_score ?? null,
    };
  });
}
