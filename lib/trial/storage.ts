/**
 * localStorage keys for the free mock station funnel. Client-side only —
 * honest-user enforcement of "3 choices, 1 station", paired with the
 * server-side email dedupe in /api/try/create-session.
 */
export const TRIAL_EMAIL_KEY = 'ff_trial_email'
export const TRIAL_USED_KEY = 'ff_trial_used'
export const TRIAL_FEEDBACK_URL_KEY = 'ff_trial_feedback_url'

export function getTrialState(): {
  email: string | null
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

export function markTrialSessionStarted(sessionId: string): void {
  try {
    window.localStorage.setItem(TRIAL_USED_KEY, '1')
    window.localStorage.setItem(TRIAL_FEEDBACK_URL_KEY, `/try/feedback/${sessionId}`)
  } catch {
    // Storage unavailable — enforcement degrades to server-side only.
  }
}
