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
 * Everything here is pure: callers run their own queries (the library's in
 * lib/supabase/queries/station-library.ts, the admin progress route's on the
 * server) and hand the rows in, so it is unit-tested without a database.
 */

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
  /**
   * The denominator this attempt was marked out of. Optional because callers
   * that only need pass counts have no reason to select it; every score
   * display falls back to MAX_WEIGHTED_SCORE when it is absent.
   */
  max_score?: number | string | null;
}

/** What a user has achieved at one station, across all their attempts. */
export interface StationPassState {
  /** Any attempt reached a passing verdict with a real (positive) score. */
  passed: boolean;
  /** Best verdict achieved across scored attempts; null if none were scored. */
  bestVerdict: Verdict | null;
  /**
   * Score of the attempt behind `bestVerdict` — NOT an independent maximum.
   * The two are carried together so the UI can never render one attempt's
   * verdict beside another attempt's score ("PASSED · best 6.0" from a Fail).
   * Within the winning band the higher score wins.
   */
  bestScore: number | null;
  /** Denominator that same attempt was marked out of; null when unknown. */
  bestMaxScore: number | null;
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

/** One attempt's own mark, after the artefact rule in landmine 1 above. */
export interface AttemptMark {
  /** The band this attempt reached; null when it was never genuinely marked. */
  verdict: Verdict | null;
  /** Score behind that verdict. Null exactly when `verdict` is. */
  weightedScore: number | null;
  /** Denominator it was marked out of; null when the row didn't carry one. */
  maxScore: number | null;
  /** This attempt alone reached a passing band. */
  passed: boolean;
}

const UNMARKED: AttemptMark = {
  verdict: null,
  weightedScore: null,
  maxScore: null,
  passed: false,
};

/**
 * What one attempt scored, or nothing.
 *
 * The library now prints a verdict per attempt rather than only the best one
 * across a station, so the "is this a real mark" rule has to be callable on a
 * single row. It lives here, next to the two landmines it exists to defuse, and
 * the station reducer below is its first caller — one rule, so an attempt can
 * never count towards a station's pass state while its own history line claims
 * it was never marked.
 */
export function markAttempt(
  row: Pick<StationAttemptRow, 'verdict' | 'weighted_score' | 'max_score'>,
): AttemptMark {
  const verdict = asVerdict(row.verdict);
  const score = row.weighted_score == null ? null : Number(row.weighted_score);

  // Landmine 1: a verdict with a non-positive score is the marking engine
  // scoring an empty transcript, not a fail the user earned.
  if (verdict === null || score === null || !Number.isFinite(score) || score <= 0) {
    return UNMARKED;
  }

  const rawMax = row.max_score == null ? null : Number(row.max_score);

  return {
    verdict,
    weightedScore: score,
    maxScore: rawMax !== null && Number.isFinite(rawMax) && rawMax > 0 ? rawMax : null,
    passed: PASSING_VERDICTS.includes(verdict),
  };
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
 *
 * `bestScore`/`bestMaxScore` belong to that same winning attempt. Ranking the
 * score independently would let the UI print "PASSED · best 6.0/10.5" where the
 * 6.0 came from a Fail, which the verdict is not guaranteed to be a monotone
 * function of (domain-level CF rules live in the marking engine, not here).
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
      bestMaxScore: null,
      attempts: 0,
    };

    const mark = markAttempt(row);

    let { passed, bestVerdict, bestScore, bestMaxScore } = current;

    if (mark.verdict !== null && mark.weightedScore !== null) {
      // Rank by band first; within the winning band the higher score wins. All
      // three move together, so the trio always describes one real attempt.
      const currentRank = bestVerdict === null ? -1 : VERDICT_RANK[bestVerdict];
      const rank = VERDICT_RANK[mark.verdict];
      if (
        rank > currentRank ||
        (rank === currentRank && mark.weightedScore > (bestScore ?? -Infinity))
      ) {
        bestVerdict = mark.verdict;
        bestScore = mark.weightedScore;
        bestMaxScore = mark.maxScore;
      }
      passed = passed || mark.passed;
    }

    byStation.set(row.station_id, {
      passed,
      bestVerdict,
      bestScore,
      bestMaxScore,
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
