/**
 * Ask the server, once per browser session, to attach any guest free mock this
 * account's verified email owns.
 *
 * Once per browser session rather than once per dashboard load: the answer is
 * "nothing to claim" for essentially every user on essentially every visit, and
 * the dashboard is the most-loaded page in the product. sessionStorage rather
 * than localStorage so signing in as somebody else, or coming back tomorrow
 * after a hand-provisioned account finally verifies its trial lead, gets one
 * more go without needing a cache-busting story.
 *
 * The flag is set BEFORE the request, not after: React StrictMode double-mounts
 * effects in development, and two claims in flight at once would race on the
 * same rows. Losing a claim to a failed request costs nothing — the next
 * browser session picks it up, as does the next purchase.
 */
export const TRIAL_CLAIM_KEY = 'ff_trial_claim_attempted'

/** True when a session was actually attached, so the caller can reload data. */
export async function claimTrialSessionsOnce(): Promise<boolean> {
  try {
    if (window.sessionStorage.getItem(TRIAL_CLAIM_KEY) === '1') return false
    window.sessionStorage.setItem(TRIAL_CLAIM_KEY, '1')
  } catch {
    // Storage unavailable (private mode, embedded webview). Skip rather than
    // claim on every single load.
    return false
  }

  try {
    const response = await fetch('/api/account/claim-trial', { method: 'POST' })
    if (!response.ok) return false
    const body = (await response.json()) as { claimed?: number }
    return (body?.claimed ?? 0) > 0
  } catch {
    return false
  }
}
