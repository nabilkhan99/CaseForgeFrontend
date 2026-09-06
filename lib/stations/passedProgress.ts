/**
 * One sitting's worth of progress, for the guest reveal page.
 *
 * The offer this feeds is now five stations over five days in a real account,
 * and this module is emphatically NOT how that allowance is counted — spend
 * against the grant is derived from `session_results` rows server-side
 * (lib/commerce/trialAccess.ts). What survives here is the narrower thing the
 * reveal needs: a guest, at the end of one consultation, with no account yet
 * and therefore no dashboard to read progress from. One sitting, one square
 * against the guarantee's two hundred, which is the argument the page makes.
 *
 * Signed-in progress is NOT computed here — the dashboard already tracks it
 * through `lib/supabase/queries/passTracking`, which reduces attempts to one
 * pass state per station and absorbs two landmines this could not: legacy
 * `weighted_score <= 0` artefacts carrying a 'Fail' verdict for consultations
 * that never happened, and staged stations landing in a numerator whose
 * denominator excludes them.
 */
import { isPassingVerdict } from '@/lib/clinical-master/scoring';

/**
 * The denominator the guarantee names, in words, on the landing page and the
 * pricing page. It is a promise, not a row count — if the bank ever grows past
 * 200 this must not silently follow it, because the sentence people bought on
 * says two hundred.
 */
export const GUARANTEE_STATION_COUNT = 200;

export interface StationsPassed {
  /** Distinct stations with at least one genuinely-scored passing attempt. */
  passed: number;
  /** Distinct stations sat at all, passed or not. */
  attempted: number;
  /** Always {@link GUARANTEE_STATION_COUNT}. */
  total: number;
  /** `passed / total` as 0–100, clamped. */
  percent: number;
}

function progress(passed: number, attempted: number): StationsPassed {
  const capped = Math.min(passed, GUARANTEE_STATION_COUNT);
  return {
    passed,
    attempted,
    total: GUARANTEE_STATION_COUNT,
    percent: (capped / GUARANTEE_STATION_COUNT) * 100,
  };
}

/**
 * The progress a guest has after the consultation they have just sat: one
 * pass, or none.
 *
 * Takes the score as well as the verdict for the same reason `passTracking`
 * does — a marked-but-empty transcript can carry a verdict without being a real
 * consultation, and only a positive score makes it one.
 */
export function trialStationsPassed(
  verdict: string | null | undefined,
  weightedScore: number | null | undefined,
): StationsPassed {
  const scored = typeof weightedScore === 'number' && Number.isFinite(weightedScore) && weightedScore > 0;
  return progress(scored && isPassingVerdict(verdict) ? 1 : 0, 1);
}
