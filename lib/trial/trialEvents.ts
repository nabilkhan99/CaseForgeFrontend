import { trackEvent } from '@/lib/analytics'

/**
 * The five-station trial's analytics vocabulary, in one place.
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

/** The trial ended and the two-plan wall was shown. */
export const TRIAL_WALL_HIT = 'trial_wall_hit'

/** Which door an account came through. Mirrors `trial_grants.source`. */
export type TrialDoor = 'free' | 'guest' | 'invite' | 'cohort'

/** Why the trial ended. Mirrors TrialAccess.reason. */
export type TrialWallReason = 'allowance' | 'expiry'

export function trackTrialAccountCreated(door: TrialDoor): Promise<void> {
  return trackEvent(TRIAL_ACCOUNT_CREATED, { door })
}

/**
 * @param index Which of the five this was, 1-based.
 * @param verdict The band it reached, as `session_results.verdict` records it.
 */
export function trackTrialStationCompleted(index: number, verdict: string): Promise<void> {
  return trackEvent(TRIAL_STATION_COMPLETED, { index, verdict })
}

export function trackTrialWallHit(reason: TrialWallReason): Promise<void> {
  return trackEvent(TRIAL_WALL_HIT, { reason })
}
