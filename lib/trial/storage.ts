/**
 * What the browser remembers about a guest consultation.
 *
 * All three keys predate the five-station trial, when the offer was one
 * anonymous mock station and this was how "you have had yours" was enforced on
 * the client. That enforcement is gone: the offer is five stations in a real
 * account, an old mock is history that does not count against it, and the
 * server-side 409 it paired with has been removed from
 * `/api/try/create-session`.
 *
 * ⚠️ `ff_trial_used` therefore GATES NOTHING. It survives only as the flag the
 * landing navbar reads to decide whether to deep-link its CTA at a report the
 * visitor already has (`components/landing/LandingNavbar.tsx`), which is a
 * courtesy and not a wall. Nothing in the funnel may start blocking on it
 * again; the real limits are server-side, in lib/trial/guestSession.ts.
 */
export const TRIAL_EMAIL_KEY = 'ff_trial_email'
export const TRIAL_USED_KEY = 'ff_trial_used'
export const TRIAL_FEEDBACK_URL_KEY = 'ff_trial_feedback_url'

export function getTrialState(): {
  email: string | null
  /** Has this browser run a consultation before? A deep-link hint, never a gate. */
  used: boolean
  feedbackUrl: string | null
} {
  try {
    return {
      email: window.localStorage.getItem(TRIAL_EMAIL_KEY),
      used: window.localStorage.getItem(TRIAL_USED_KEY) === '1',
      feedbackUrl: window.localStorage.getItem(TRIAL_FEEDBACK_URL_KEY),
    }
  } catch {
    return { email: null, used: false, feedbackUrl: null }
  }
}

/**
 * Remember where this consultation's report will live.
 *
 * Called from the call screen rather than only from the reading page: the
 * one-click door never passes through a "Begin" button, and without this the
 * navbar would have no report to point a returning visitor at.
 */
export function markTrialSessionStarted(sessionId: string): void {
  try {
    window.localStorage.setItem(TRIAL_USED_KEY, '1')
    window.localStorage.setItem(TRIAL_FEEDBACK_URL_KEY, `/try/feedback/${sessionId}`)
  } catch {
    // Storage unavailable — the deep link simply is not offered.
  }
}
