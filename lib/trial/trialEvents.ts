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
