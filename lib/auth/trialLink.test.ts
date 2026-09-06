import { createHmac } from 'node:crypto'
import { afterEach, describe, expect, it } from 'vitest'
import {
  TRIAL_LINK_TTL_MS,
  mintTrialLink,
  trialLinkUrl,
  trialSignInUrl,
  verifyTrialLink,
} from './trialLink'

/**
 * The link is a BEARER CREDENTIAL: whoever holds it becomes that account. So
 * the tests here are not about the happy path — they are about the four ways a
 * token could be trusted when it should not be, each of which is an account
 * takeover:
 *
 *   1. an edited payload still verifying (tamper),
 *   2. a token signed with a different secret verifying (cross-environment),
 *   3. an old token verifying (expiry),
 *   4. minting at all with no secret configured (a signature over nothing).
 *
 * The round trip is tested only so the failures above are known to be failures
 * of the check rather than of the format.
 */

const SECRET = 'test-secret-not-the-real-one'

afterEach(() => {
  delete process.env.TRIAL_LINK_SECRET
})

describe('minting', () => {
  it('round-trips the address, the door and the expiry', () => {
    const now = new Date('2026-09-06T10:00:00Z')
    const token = mintTrialLink({ email: 'Sarah@NHS.net', source: 'link', secret: SECRET, now })

    const result = verifyTrialLink(token, { secret: SECRET, now })
    expect(result.ok).toBe(true)
    if (!result.ok) return

    // Lower-cased on the way in, because every email match in this codebase is
    // case-insensitive and a link is compared against `trial_leads`.
    expect(result.payload.email).toBe('sarah@nhs.net')
    expect(result.payload.source).toBe('link')
    expect(result.payload.expiresAt).toBe(now.getTime() + TRIAL_LINK_TTL_MS)
  })

  it('carries the cohort door distinctly from the plain link door', () => {
    const token = mintTrialLink({ email: 'a@b.com', source: 'cohort', secret: SECRET })
    const result = verifyTrialLink(token, { secret: SECRET })
    expect(result.ok && result.payload.source).toBe('cohort')
  })

  it('reads TRIAL_LINK_SECRET from the environment when none is passed', () => {
    process.env.TRIAL_LINK_SECRET = SECRET
    const token = mintTrialLink({ email: 'a@b.com', source: 'link' })
    expect(verifyTrialLink(token).ok).toBe(true)
  })

  it('refuses to mint without a secret, rather than signing with an empty key', () => {
    expect(mintTrialLink({ email: 'a@b.com', source: 'link', secret: '' })).toBeNull()
    // Whitespace is not a secret either.
    expect(mintTrialLink({ email: 'a@b.com', source: 'link', secret: '   ' })).toBeNull()
  })

  it('refuses an empty address', () => {
    expect(mintTrialLink({ email: '   ', source: 'link', secret: SECRET })).toBeNull()
  })
})

describe('expiry', () => {
  it('accepts a token one millisecond before it expires', () => {
    const now = new Date('2026-09-06T10:00:00Z')
    const token = mintTrialLink({ email: 'a@b.com', source: 'link', secret: SECRET, now })!
    const justBefore = new Date(now.getTime() + TRIAL_LINK_TTL_MS - 1)
    expect(verifyTrialLink(token, { secret: SECRET, now: justBefore }).ok).toBe(true)
  })

  it('refuses it at the instant it expires, not a moment later', () => {
    const now = new Date('2026-09-06T10:00:00Z')
    const token = mintTrialLink({ email: 'a@b.com', source: 'link', secret: SECRET, now })!
    const atExpiry = new Date(now.getTime() + TRIAL_LINK_TTL_MS)
    const result = verifyTrialLink(token, { secret: SECRET, now: atExpiry })
    expect(result).toEqual({ ok: false, reason: 'expired' })
  })

  it('honours a shorter ttl', () => {
    const now = new Date('2026-09-06T10:00:00Z')
    const token = mintTrialLink({
      email: 'a@b.com',
      source: 'link',
      secret: SECRET,
      ttlMs: 60_000,
      now,
    })!
    const later = new Date(now.getTime() + 61_000)
    expect(verifyTrialLink(token, { secret: SECRET, now: later })).toEqual({
      ok: false,
      reason: 'expired',
    })
  })
})

describe('tampering', () => {
  /** The payload half of a token, decoded. */
  function payloadOf(token: string): Record<string, unknown> {
    const body = token.split('.')[0].replace(/-/g, '+').replace(/_/g, '/')
    return JSON.parse(Buffer.from(body, 'base64').toString('utf8'))
  }

  /** Re-encode a payload WITHOUT re-signing — an attacker with no secret. */
  function repack(payload: Record<string, unknown>, mac: string): string {
    const body = Buffer.from(JSON.stringify(payload), 'utf8')
      .toString('base64')
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=+$/, '')
    return `${body}.${mac}`
  }

  it('refuses a token whose address was swapped', () => {
    const token = mintTrialLink({ email: 'victim@nhs.net', source: 'link', secret: SECRET })!
    const [, mac] = token.split('.')
    const forged = repack({ ...payloadOf(token), e: 'attacker@example.com' }, mac)

    expect(verifyTrialLink(forged, { secret: SECRET })).toEqual({
      ok: false,
      reason: 'bad_signature',
    })
  })

  it('refuses a token whose expiry was pushed out', () => {
    const now = new Date('2026-09-06T10:00:00Z')
    const token = mintTrialLink({ email: 'a@b.com', source: 'link', secret: SECRET, now })!
    const [, mac] = token.split('.')
    const forged = repack({ ...payloadOf(token), x: now.getTime() + 10 * TRIAL_LINK_TTL_MS }, mac)

    expect(verifyTrialLink(forged, { secret: SECRET, now }).ok).toBe(false)
  })

  it('refuses a token minted with another secret', () => {
    const token = mintTrialLink({ email: 'a@b.com', source: 'link', secret: 'someone-elses' })!
    expect(verifyTrialLink(token, { secret: SECRET })).toEqual({
      ok: false,
      reason: 'bad_signature',
    })
  })

  it('refuses an unknown door, so a widened CHECK cannot be pre-empted', () => {
    const token = mintTrialLink({ email: 'a@b.com', source: 'link', secret: SECRET })!
    // Signed properly this time — the payload itself is the problem.
    const body = Buffer.from(JSON.stringify({ ...payloadOf(token), s: 'signup' }), 'utf8')
      .toString('base64')
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=+$/, '')
    const mac = createHmac('sha256', SECRET)
      .update(body)
      .digest('base64')
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=+$/, '')

    expect(verifyTrialLink(`${body}.${mac}`, { secret: SECRET })).toEqual({
      ok: false,
      reason: 'malformed',
    })
  })
})

describe('malformed input', () => {
  it.each([
    ['empty', ''],
    ['no separator', 'abcdef'],
    ['empty payload', '.abc'],
    ['empty signature', 'abc.'],
    ['three segments', 'a.b.c'],
    ['not base64 json', 'zzzz.zzzz'],
  ])('refuses %s without throwing', (_label, token) => {
    const result = verifyTrialLink(token, { secret: SECRET })
    expect(result.ok).toBe(false)
  })

  it('refuses null and undefined', () => {
    expect(verifyTrialLink(null, { secret: SECRET }).ok).toBe(false)
    expect(verifyTrialLink(undefined, { secret: SECRET }).ok).toBe(false)
  })

  it('says no_secret rather than bad_signature when the key is missing', () => {
    // The distinction matters operationally: one is an attack, the other is a
    // deploy that forgot an env var and has broken every link in flight.
    expect(verifyTrialLink('anything.atall')).toEqual({ ok: false, reason: 'no_secret' })
  })
})

describe('urls', () => {
  it('puts a signed token on /auth/start', () => {
    const token = mintTrialLink({ email: 'a@b.com', source: 'link', secret: SECRET })!
    const url = new URL(trialLinkUrl('https://www.fourteenfisherman.com', token))
    expect(url.pathname).toBe('/auth/start')
    expect(url.searchParams.get('token')).toBe(token)
  })

  it('puts a GoTrue recovery hash on the same page', () => {
    const url = new URL(trialSignInUrl('https://www.fourteenfisherman.com', 'abc123', 'a@b.com'))
    expect(url.pathname).toBe('/auth/start')
    expect(url.searchParams.get('token_hash')).toBe('abc123')
    expect(url.searchParams.get('email')).toBe('a@b.com')
  })
})
