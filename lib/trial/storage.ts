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
 *
 * `ff_trial_claimed` is the same kind of thing and the same kind of harmless:
 * it says whether the consultation ever became an account, so the navbar can
 * tell "See your feedback" from "Finish your free account". Never a gate
 * either — the report page decides who may read what.
 */
export const TRIAL_EMAIL_KEY = 'ff_trial_email'
export const TRIAL_USED_KEY = 'ff_trial_used'
export const TRIAL_FEEDBACK_URL_KEY = 'ff_trial_feedback_url'

/**
 * The account was made and this consultation is on it.
 *
 * Written when the sign-up succeeds, not when the consultation starts — which
 * is the difference `ff_trial_used` cannot express. Without it the navbar
 * offered "See your feedback" to somebody who had only ever abandoned a run,
 * and the link led to the sign-up form: a promise of a report, answered by a
 * form. Same href either way; the word on the button is what changes.
 */
export const TRIAL_CLAIMED_KEY = 'ff_trial_claimed'

export function getTrialState(): {
  email: string | null
  /** Has this browser run a consultation before? A deep-link hint, never a gate. */
  used: boolean
  feedbackUrl: string | null
  /** Was an account made for it? False on a run that was abandoned or left. */
  claimed: boolean
} {
  try {
    return {
      email: window.localStorage.getItem(TRIAL_EMAIL_KEY),
      used: window.localStorage.getItem(TRIAL_USED_KEY) === '1',
      feedbackUrl: window.localStorage.getItem(TRIAL_FEEDBACK_URL_KEY),
      claimed: window.localStorage.getItem(TRIAL_CLAIMED_KEY) === '1',
    }
  } catch {
    return { email: null, used: false, feedbackUrl: null, claimed: false }
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
    // A NEW consultation has no account on it yet, whatever the last one had.
    // Left set, the navbar would offer a report for a run that was abandoned.
    window.localStorage.removeItem(TRIAL_CLAIMED_KEY)
  } catch {
    // Storage unavailable — the deep link simply is not offered.
  }
}

/**
 * The account exists and this consultation belongs to it.
 *
 * Called where the account is made (components/try/SignUpWhileMarking), on the
 * far side of a verified code. Read only by the landing navbar, to tell "your
 * report is waiting" from "your sign-up is unfinished".
 */
export function markTrialClaimed(): void {
  try {
    window.localStorage.setItem(TRIAL_CLAIMED_KEY, '1')
  } catch {
    // Storage unavailable — the navbar keeps the more cautious label.
  }
}
