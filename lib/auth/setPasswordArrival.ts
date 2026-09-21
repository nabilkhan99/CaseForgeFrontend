/**
 * What /auth/set-password does with whoever has just arrived, and with the
 * answer GoTrue gives once they press Continue.
 *
 * Pulled out of the page because vitest runs in `node` here and cannot render a
 * client component, and these are the two decisions on that page that must not
 * regress.
 *
 * THE RULE: opening the page never spends the link. The emailed link carries a
 * single-use recovery token, and the page used to verify it the moment it
 * mounted. A mail scanner that renders links does that too (Safe Links in
 * Microsoft Defender, which every nhs.net inbox sits behind), so the scanner
 * spent the token and its owner was told a brand new link had expired. Supabase
 * documents this as "Email prefetching" and the remedy is the one here: a
 * scanner runs a mount effect exactly as a browser does, but it does not press
 * buttons. So an arrival with a token answers `confirm`, never "verify".
 */

export type SetPasswordArrival = 'form' | 'confirm' | 'expired'

export function decideSetPasswordArrival(input: {
  hasSession: boolean
  tokenHash: string | null | undefined
}): SetPasswordArrival {
  // Already signed in: straight to the form, token or no token. This covers a
  // link opened twice AND the middleware's redirect of a `password_pending`
  // account, which arrives with no query at all. Checked before the token, so a
  // stale `token_hash` on a live session is never spent or failed on.
  if (input.hasSession) return 'form'
  // No session and no token: nothing to verify and nothing to update.
  if (!input.tokenHash) return 'expired'
  return 'confirm'
}

export type SetPasswordVerifyOutcome = 'form' | 'retry' | 'expired'

export function decideAfterVerify(input: {
  verifyFailed: boolean
  /** The request never got an answer (offline, a proxy dropped it). */
  retryable: boolean
  hasSessionAfter: boolean
}): SetPasswordVerifyOutcome {
  if (!input.verifyFailed) return 'form'
  // The token is single-use, and a double click fires two verifies: the second
  // fails on a token the first just spent. If that left a session, this is a
  // signed-in person and the link is not expired at all.
  if (input.hasSessionAfter) return 'form'
  // Nothing was spent, so the link is still good. Saying "expired" here would
  // push someone to request a fresh link, which is what invalidates this one.
  if (input.retryable) return 'retry'
  return 'expired'
}
