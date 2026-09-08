'use client'

import type { SubscriptionResponse } from '@/app/api/subscription/route'

/**
 * One `/api/subscription` request per page load, however many components ask.
 *
 * WHY IT EXISTS NOW. Two hooks read that route — `useCohortAllowlist` and
 * `useTrialStatus` — and the station brief page mounts both, so it made two
 * identical requests before every consultation. That was already wasteful and
 * became expensive with the five-case trial: for a trial account the route now
 * reads the grant, the flagged stations, the session history AND (service-role)
 * the questionnaire's exam hint, so the duplicate was four extra round trips on
 * the page a trainee opens immediately before spending Azure minutes.
 *
 * DEDUPES THE REQUEST, NOT THE ANSWER. Only the in-flight promise is shared;
 * the moment it settles the slot is cleared, so a later mount — after a
 * checkout, after a grant is stamped — fetches again and sees the new state.
 * A cached RESULT would be a different and much worse thing: this route decides
 * what somebody may open, and serving a stale copy of that for the life of a
 * tab is how a customer who has just paid keeps seeing a paywall.
 *
 * Never rejects: both callers treat "no answer" as "draw nothing special",
 * which is the safe default in a UI sense — the actual gate is server-side at
 * create-session / realtime-token regardless of what this returns.
 */
let inFlight: Promise<SubscriptionResponse | null> | null = null

export function fetchSubscriptionOnce(): Promise<SubscriptionResponse | null> {
  if (!inFlight) {
    inFlight = fetch('/api/subscription')
      .then((response) => (response.ok ? (response.json() as Promise<SubscriptionResponse>) : null))
      .catch(() => null)
      .finally(() => {
        inFlight = null
      })
  }
  return inFlight
}
