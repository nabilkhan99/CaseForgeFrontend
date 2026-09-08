import { trackEvent } from '@/lib/analytics'
import type { TrialSource } from '@/lib/commerce/trialAccess'

/**
 * The free trial's analytics vocabulary, in one place.
 *
 * Event names are strings that have to match between the code that fires them
 * and the PostHog insight that reads them, and they are fired from surfaces
 * owned by three different workstreams (the doors, the marking reveal, the
 * wall). A typo in any one of them is a funnel step that silently reports zero
 * rather than an error anybody sees, so the names live here as constants and
 * the payloads are typed.
 *
 * `trackEvent` swallows its own failures and is a no-op without a PostHog key
 * (see lib/analytics.ts), so nothing here can break a page.
 */

/** An account was created through one of the three doors and given the grant. */
export const TRIAL_ACCOUNT_CREATED = 'trial_account_created'

/** One of the five was genuinely marked. */
export const TRIAL_STATION_COMPLETED = 'trial_station_completed'

/** The five days ran out and the two-plan wall was shown. */
export const TRIAL_WALL_HIT = 'trial_wall_hit'

/**
 * Which door an account came through, in the ANALYTICS vocabulary.
 *
 * ⚠️ Deliberately not the same strings as `trial_grants.source`
 * (`TrialSource` in lib/commerce/trialAccess.ts). The two were specified
 * separately — the event property by the handoff's analytics table, the column
 * by the build plan's data contract — and both are now fixed: the column has a
 * CHECK constraint and the event name is what the PostHog insight will filter
 * on. Use {@link doorForSource} to cross between them rather than passing one
 * where the other belongs.
 */
export type TrialDoor = 'free' | 'guest' | 'invite' | 'cohort'

/** The analytics door for a `trial_grants.source`. The one place the two vocabularies meet. */
export function doorForSource(source: TrialSource): TrialDoor {
  switch (source) {
    case 'signup':
      return 'free'
    case 'guest_reveal':
      return 'guest'
    case 'link':
      return 'invite'
    case 'cohort':
      return 'cohort'
  }
}

/**
 * Why the trial ended. Mirrors TrialAccess.reason.
 *
 * ONE VALUE since 7 September 2026. Attempts are unlimited, so there is no
 * allowance to exhaust and expiry is the only way to reach the wall. Kept as a
 * property rather than dropped from the event: the PostHog insight already
 * filters on it, and a funnel that silently stops carrying a dimension is
 * harder to read than one that carries a constant.
 */
export type TrialWallReason = 'expiry'

export function trackTrialAccountCreated(door: TrialDoor): Promise<void> {
  return trackEvent(TRIAL_ACCOUNT_CREATED, { door })
}

/**
 * @param index How many of the five cases they have now tried, 1-based — so
 *   "did people get past the second case" is one filter on this property.
 * @param verdict The band it reached, as `session_results.verdict` records it.
 * @param attempt Which go at THIS case, 1-based. New with unlimited attempts,
 *   and the property that answers the question the whole offer turns on: does
 *   a second run at the same case score better than the first. Without it a
 *   repeat is indistinguishable from a first sitting.
 */
export function trackTrialStationCompleted(
  index: number,
  verdict: string,
  attempt: number,
): Promise<void> {
  return trackEvent(TRIAL_STATION_COMPLETED, { index, verdict, attempt })
}

export function trackTrialWallHit(reason: TrialWallReason = 'expiry'): Promise<void> {
  return trackEvent(TRIAL_WALL_HIT, { reason })
}

/**
 * Storage key for "this session's completion has already been reported".
 *
 * The event fires when a marked result LANDS on the report, and a report is a
 * page somebody refreshes, comes back to from the board, and opens again from
 * an email. Without a per-session guard, `trial_station_completed` would count
 * readings of a result rather than completions of a station, and `index` — the
 * whole point of the event — would repeat. `sessionStorage`, like
 * PurchaseTracker's guard on `purchase`, because a per-tab memory is the honest
 * scope for "did this browser already report this".
 */
const REPORTED_KEY = (sessionId: string) => `ff_trial_station_${sessionId}`

/** True if this browser has not yet reported this session, and marks it as reported. */
function claimReport(sessionId: string): boolean {
  try {
    if (window.sessionStorage.getItem(REPORTED_KEY(sessionId))) return false
    window.sessionStorage.setItem(REPORTED_KEY(sessionId), '1')
    return true
  } catch {
    // Storage unavailable (private mode, storage disabled). Report anyway: a
    // duplicate is a smaller loss than a missing funnel step.
    return true
  }
}

/**
 * Report that a trial account has just had one of its five marked.
 *
 * Call it when a result lands on the feedback report. It answers "is this a
 * trial account, which of the five was that, and which go at it" ITSELF, from
 * `/api/subscription`, rather than making every caller thread trial state
 * through — the report is rendered in three places and only one of them knows
 * anything about the trial.
 *
 * BOTH NUMBERS COME FROM THE SERVER, in the one request this already made.
 * `index` is the distinct cases tried and `attempt` is the runs at this
 * station, both derived from `clinical_sessions` (see
 * lib/commerce/trialAccess.ts#countTrialUsage) — and both already include the
 * consultation that has just been marked, because its row is `completed` by the
 * time there is a result to show. Counting either in the browser would produce
 * a number that disagrees with the dashboard the trainee is about to open.
 *
 * Floored at 1: a station whose usage row could not be read still happened, and
 * an "attempt 0" is a nonsense row in a funnel.
 *
 * Silent for everybody who is not on a trial (`/api/subscription` sends `trial`
 * only when the grant is what decides access), and silent on any failure: this
 * is instrumentation hanging off the screen a candidate reads their result on.
 */
export async function reportTrialStationCompleted(
  sessionId: string,
  verdict: string,
  /** The case that was just sat, so the attempt number can be looked up. */
  stationId?: string | null,
): Promise<void> {
  if (typeof window === 'undefined') return
  if (!claimReport(sessionId)) return

  try {
    const res = await fetch('/api/subscription')
    if (!res.ok) return
    const data = (await res.json()) as {
      trial?: { casesTried?: number; attemptsByStation?: Record<string, number> } | null
    }
    const trial = data?.trial
    if (!trial || typeof trial.casesTried !== 'number') return
    const attempts = stationId ? trial.attemptsByStation?.[stationId] : undefined
    await trackTrialStationCompleted(
      Math.max(1, trial.casesTried),
      verdict,
      Math.max(1, typeof attempts === 'number' ? attempts : 1),
    )
  } catch {
    // No event rather than a broken report.
  }
}
