import { describe, expect, it } from 'vitest'
import { decideAfterVerify, decideSetPasswordArrival } from './setPasswordArrival'

/**
 * What /auth/set-password does with whoever has just arrived.
 *
 * The emailed link carries a single-use recovery token, and the page used to
 * verify it the moment it mounted. A mail scanner that renders links (Safe
 * Links in Microsoft Defender, which every nhs.net inbox sits behind) would
 * then spend the token before its owner ever clicked, and the owner was told
 * their brand new link had expired. Supabase documents this under "Email
 * prefetching" and the remedy is the one pinned here: arriving is never
 * enough, a person has to press a button.
 */

describe('decideSetPasswordArrival', () => {
  it('shows the form to anyone already signed in, token or no token', () => {
    // The middleware sends a `password_pending` account here with no query at
    // all, and a link clicked twice arrives with a token that is already spent.
    expect(decideSetPasswordArrival({ hasSession: true, tokenHash: null })).toBe('form')
    expect(decideSetPasswordArrival({ hasSession: true, tokenHash: 'abc123' })).toBe('form')
  })

  it('waits for a click when the link is all there is', () => {
    expect(decideSetPasswordArrival({ hasSession: false, tokenHash: 'abc123' })).toBe('confirm')
  })

  it('reads a tokenless, signed-out arrival as an expired link', () => {
    expect(decideSetPasswordArrival({ hasSession: false, tokenHash: null })).toBe('expired')
    expect(decideSetPasswordArrival({ hasSession: false, tokenHash: undefined })).toBe('expired')
    expect(decideSetPasswordArrival({ hasSession: false, tokenHash: '' })).toBe('expired')
  })

  it('has no answer that means "verify now"', () => {
    // The whole point: whatever arrives, the page is never told to spend the
    // token on its own. Verifying is something only the click handler does.
    const answers = [
      decideSetPasswordArrival({ hasSession: true, tokenHash: 'abc123' }),
      decideSetPasswordArrival({ hasSession: false, tokenHash: 'abc123' }),
      decideSetPasswordArrival({ hasSession: false, tokenHash: null }),
    ]
    expect(new Set(answers)).toEqual(new Set(['form', 'confirm', 'expired']))
  })
})

describe('decideAfterVerify', () => {
  it('shows the form when the token verified', () => {
    expect(decideAfterVerify({ verifyFailed: false, retryable: false, hasSessionAfter: true })).toBe('form')
  })

  it('shows the form when a sibling call spent the token and left a session', () => {
    // A double click fires two verifies; the second fails on a token the first
    // just used. That is a signed-in person, not an expired link.
    expect(decideAfterVerify({ verifyFailed: true, retryable: false, hasSessionAfter: true })).toBe('form')
  })

  it('asks for another try when the request never reached the server', () => {
    // A dropped connection spends nothing, so the link is still good. Calling
    // it expired would send someone to "email me a fresh link", and minting a
    // fresh link is the one thing that kills the working one in their inbox.
    expect(decideAfterVerify({ verifyFailed: true, retryable: true, hasSessionAfter: false })).toBe('retry')
  })

  it('reads as expired when the token was refused and nobody is signed in', () => {
    expect(decideAfterVerify({ verifyFailed: true, retryable: false, hasSessionAfter: false })).toBe('expired')
  })

  it('prefers a live session over any reading of the error', () => {
    expect(decideAfterVerify({ verifyFailed: true, retryable: true, hasSessionAfter: true })).toBe('form')
  })
})
