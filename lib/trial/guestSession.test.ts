import { beforeEach, describe, expect, it, vi } from 'vitest'

/**
 * The compensating control for the one endpoint in the product that spends
 * money without authentication. Every rule in guestSession.ts's header is
 * pinned here, because a rule that quietly stops firing is an Azure bill.
 */

vi.mock('server-only', () => ({}))

process.env.TRIAL_GUEST_COOKIE_SECRET = 'test-secret'

const {
  GUEST_MINT_COOLDOWN_SECONDS,
  GUEST_SESSIONS_PER_DAY,
  canOpenGuestSession,
  guestMintRefusal,
  newGuestCookie,
  readGuestCookie,
  signGuestCookie,
  withGuestSession,
  withMint,
} = await import('./guestSession')

type GuestCookie = Awaited<ReturnType<typeof newGuestCookie>>

const NOW_MS = Date.UTC(2026, 8, 6, 12, 0, 0)
const NOW_S = Math.floor(NOW_MS / 1000)
const SESSION = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
const STATION = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'

/** A row created a minute ago, still on the brief. */
function row(overrides: Record<string, unknown> = {}) {
  return {
    user_id: null,
    status: 'reading',
    started_at: new Date(NOW_MS - 60_000).toISOString(),
    station_id: STATION,
    ...overrides,
  }
}

function cookieWith(sessionId = SESSION, openedSecondsAgo = 60): GuestCookie {
  return { g: 'guest-1', s: [{ i: sessionId, c: NOW_S - openedSecondsAgo }] }
}

function refuse(overrides: Record<string, unknown> = {}) {
  return guestMintRefusal({
    cookie: cookieWith(),
    sessionId: SESSION,
    session: row(),
    requestedStationId: STATION,
    nowMs: NOW_MS,
    ...overrides,
  })
}

beforeEach(() => {
  vi.spyOn(console, 'warn').mockImplementation(() => {})
})

describe('the signed cookie', () => {
  it('round-trips what it signed', () => {
    const payload = withGuestSession(newGuestCookie(), SESSION, NOW_S)
    const signed = signGuestCookie(payload)
    expect(signed).toBeTruthy()
    expect(readGuestCookie(signed)).toEqual(payload)
  })

  it('refuses a payload edited under the signature', () => {
    const signed = signGuestCookie(cookieWith())!
    const [body, signature] = signed.split('.')
    const forged = Buffer.from(
      JSON.stringify({ g: 'guest-1', s: [{ i: 'someone-elses-session', c: NOW_S }] }),
      'utf8',
    ).toString('base64url')

    expect(readGuestCookie(`${forged}.${signature}`)).toBeNull()
    expect(readGuestCookie(`${body}.not-the-signature`)).toBeNull()
    expect(readGuestCookie(body)).toBeNull()
    expect(readGuestCookie(undefined)).toBeNull()
  })

  it('drops entries older than the rolling day when it records a new one', () => {
    const stale: GuestCookie = { g: 'guest-1', s: [{ i: 'yesterday', c: NOW_S - 25 * 60 * 60 }] }
    expect(withGuestSession(stale, SESSION, NOW_S).s.map((e) => e.i)).toEqual([SESSION])
  })

  it('records a session it already holds only once', () => {
    const once = withGuestSession(null, SESSION, NOW_S)
    expect(withGuestSession(once, SESSION, NOW_S + 5).s).toHaveLength(1)
  })
})

describe('rule 3 — sessions per browser per day', () => {
  it('allows the first three and refuses the fourth', () => {
    let cookie = newGuestCookie()
    for (let i = 0; i < GUEST_SESSIONS_PER_DAY; i += 1) {
      expect(canOpenGuestSession(cookie, NOW_S)).toBe(true)
      cookie = withGuestSession(cookie, `session-${i}`, NOW_S)
    }
    expect(canOpenGuestSession(cookie, NOW_S)).toBe(false)
  })

  it('lets the allowance roll off after a day', () => {
    const yesterday: GuestCookie = {
      g: 'guest-1',
      s: [0, 1, 2].map((i) => ({ i: `session-${i}`, c: NOW_S - 25 * 60 * 60 })),
    }
    expect(canOpenGuestSession(yesterday, NOW_S)).toBe(true)
  })

  it('refuses a mint for a session beyond the cap even if a cookie carries it', () => {
    const overfull: GuestCookie = {
      g: 'guest-1',
      s: [0, 1, 2, 3].map((i) => ({ i: `session-${i}`, c: NOW_S - (10 - i) * 60 })),
    }
    const refusal = guestMintRefusal({
      cookie: overfull,
      sessionId: 'session-3',
      session: row(),
      requestedStationId: STATION,
      nowMs: NOW_MS,
    })
    expect(refusal?.code).toBe('guest_daily_limit')
    expect(refusal?.status).toBe(429)
  })
})

describe('guestMintRefusal', () => {
  it('mints when every rule holds', () => {
    expect(refuse()).toBeNull()
  })

  it('rule 1 — no cookie, no mint', () => {
    expect(refuse({ cookie: null })?.code).toBe('guest_cookie_missing')
  })

  it('rule 2 — a session this browser was never given', () => {
    const refusal = refuse({ cookie: cookieWith('another-session') })
    expect(refusal?.code).toBe('guest_session_unrecognised')
    expect(refusal?.status).toBe(403)
  })

  it('rule 4 — an id with no row is refused, never created', () => {
    expect(refuse({ session: null })?.code).toBe('guest_session_unknown')
  })

  it('rule 5 — a session that belongs to an account', () => {
    expect(refuse({ session: row({ user_id: 'user-1' }) })?.code).toBe('guest_session_owned')
  })

  it('rule 6 — a station other than the one the row was opened against', () => {
    expect(refuse({ requestedStationId: 'other-station' })?.code).toBe('guest_station_mismatch')
  })

  it('rule 7 — only reading and live can be started', () => {
    expect(refuse({ session: row({ status: 'live' }) })).toBeNull()
    for (const status of ['processing', 'completed', 'unmarkable', 'abandoned', 'error']) {
      expect(refuse({ session: row({ status }) })?.code).toBe('guest_session_not_startable')
    }
  })

  it('rule 8 — a session older than half an hour', () => {
    const old = new Date(NOW_MS - 31 * 60_000).toISOString()
    expect(refuse({ session: row({ started_at: old }) })?.code).toBe('guest_session_expired')
    const fresh = new Date(NOW_MS - 29 * 60_000).toISOString()
    expect(refuse({ session: row({ started_at: fresh }) })).toBeNull()
  })

  it('rule 8 — falls back to the cookie when the row has no timestamp', () => {
    const refusal = refuse({
      session: row({ started_at: null }),
      cookie: cookieWith(SESSION, 31 * 60),
    })
    expect(refusal?.code).toBe('guest_session_expired')
  })

  it('rule 9 — one mint per session per two minutes, with a retry hint', () => {
    const justMinted = withMint(cookieWith(), SESSION, NOW_S - 30)
    const refusal = refuse({ cookie: justMinted })
    expect(refusal?.code).toBe('guest_mint_cooldown')
    expect(refusal?.status).toBe(429)
    expect(refusal?.retryAfterSeconds).toBe(GUEST_MINT_COOLDOWN_SECONDS - 30)

    const cooled = withMint(cookieWith(), SESSION, NOW_S - GUEST_MINT_COOLDOWN_SECONDS)
    expect(refuse({ cookie: cooled })).toBeNull()
  })
})
