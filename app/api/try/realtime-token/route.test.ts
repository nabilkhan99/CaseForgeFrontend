import { beforeEach, describe, expect, it, vi } from 'vitest'

/**
 * The anonymous mint, rule by rule.
 *
 * guestSession.test.ts pins the decision function; this pins the route around
 * it — that it reads the row rather than trusting the body, that it never
 * inserts a session it does not recognise (the behaviour this replaces), that
 * a mint stamps the cooldown while a failed mint does not, and that the station
 * it finally reads is checked against BOTH C2 filters, which is the last gate
 * before Azure is charged.
 */

process.env.TRIAL_GUEST_COOKIE_SECRET = 'test-secret'

const mocks = vi.hoisted(() => ({
  signedIn: false,
  session: null as Record<string, unknown> | null,
  station: null as Record<string, unknown> | null,
  mintThrows: false,
  /** Every set of filters a `stations` query applied. */
  stationFilters: [] as Record<string, unknown>[],
  updates: [] as Record<string, unknown>[],
  inserts: [] as Record<string, unknown>[],
}))

vi.mock('server-only', () => ({}))

vi.mock('@/lib/trial/guestOnly', () => ({
  rejectIfSignedIn: async () => (mocks.signedIn ? new Response(null, { status: 403 }) : null),
}))

vi.mock('@/lib/clinical-master/realtimeToken', () => ({
  mintEphemeralKey: async () => {
    if (mocks.mintThrows) throw new Error('Azure said no')
    return { ephemeralKey: 'ek', callsUrl: 'https://azure/calls', model: 'm', voice: 'v', origin: 'primary', lane: 'lane' }
  },
  unreliableEchoCancellation: () => false,
}))

vi.mock('@/lib/clinical-master/realtimeSession', () => ({ voiceForStation: () => 'voice' }))

vi.mock('@/lib/supabase/admin', () => ({
  getSupabaseAdmin: () => ({
    from: (table: string) => {
      const filters: Record<string, unknown> = {}
      if (table === 'stations') mocks.stationFilters.push(filters)
      const builder = {
        select: () => builder,
        eq: (column: string, value: unknown) => {
          filters[column] = value
          return builder
        },
        maybeSingle: async () => ({
          data: table === 'stations' ? mocks.station : mocks.session,
          error: null,
        }),
        update: (patch: Record<string, unknown>) => {
          mocks.updates.push(patch)
          return { eq: async () => ({ error: null }) }
        },
        insert: async (row: Record<string, unknown>) => {
          mocks.inserts.push(row)
          return { error: null }
        },
      }
      return builder
    },
  }),
}))

const { POST } = await import('./route')
const { signGuestCookie, withGuestSession, withMint } = await import('@/lib/trial/guestSession')

const SESSION = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
const STATION = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'
const NOW_S = Math.floor(Date.now() / 1000)

/** A cookie that legitimately carries this session, opened a minute ago. */
function boundCookie(sessionId = SESSION, openedSecondsAgo = 60) {
  return signGuestCookie(withGuestSession(null, sessionId, NOW_S - openedSecondsAgo))!
}

/** Every call gets its own client address, so the per-IP brake never crosses tests. */
let addresses = 0

async function mint(
  cookie: string | undefined,
  body: Record<string, unknown> = {},
  ip?: string,
) {
  addresses += 1
  const address = ip ?? `203.0.113.${addresses}`
  const response = await POST({
    json: async () => ({ sessionId: SESSION, stationId: STATION, ...body }),
    cookies: { get: (name: string) => (cookie && name === 'ff_guest' ? { value: cookie } : undefined) },
    headers: { get: (name: string) => (name === 'x-forwarded-for' ? address : null) },
  } as never)
  return {
    status: response.status,
    body: await response.json().catch(() => ({})),
    setCookie: response.headers.get('set-cookie') ?? '',
  }
}

beforeEach(async () => {
  vi.spyOn(console, 'warn').mockImplementation(() => {})
  const { resetGuestRateLimits } = await import('@/lib/trial/guestRateLimit')
  resetGuestRateLimits()
  mocks.signedIn = false
  mocks.mintThrows = false
  mocks.stationFilters = []
  mocks.updates = []
  mocks.inserts = []
  mocks.station = { id: STATION, consultation_duration_seconds: 720 }
  mocks.session = {
    user_id: null,
    status: 'reading',
    started_at: new Date(Date.now() - 60_000).toISOString(),
    station_id: STATION,
  }
})

describe('the mint that spends money', () => {
  it('mints for a session this browser was given', async () => {
    const { status, body } = await mint(boundCookie())
    expect(status).toBe(200)
    expect(body).toMatchObject({ ephemeralKey: 'ek', durationSeconds: 720 })
    expect(mocks.updates).toEqual([{ status: 'live' }])
  })

  it('refuses with no cookie at all, and never invents a session row', async () => {
    const { status, body } = await mint(undefined)
    expect(status).toBe(403)
    expect(body.code).toBe('guest_cookie_missing')
    expect(mocks.inserts).toHaveLength(0)
  })

  it('refuses a session id this browser was never given', async () => {
    const { status, body } = await mint(boundCookie('some-other-session'))
    expect(status).toBe(403)
    expect(body.code).toBe('guest_session_unrecognised')
  })

  it('refuses an id with no row rather than creating one', async () => {
    mocks.session = null
    const { status, body } = await mint(boundCookie())
    expect(status).toBe(404)
    expect(body.code).toBe('guest_session_unknown')
    expect(mocks.inserts).toHaveLength(0)
  })

  it('refuses a session older than half an hour', async () => {
    mocks.session = { ...mocks.session, started_at: new Date(Date.now() - 31 * 60_000).toISOString() }
    const { status, body } = await mint(boundCookie())
    expect(status).toBe(403)
    expect(body.code).toBe('guest_session_expired')
  })

  it('refuses a session that is no longer startable', async () => {
    mocks.session = { ...mocks.session, status: 'completed' }
    expect((await mint(boundCookie())).body.code).toBe('guest_session_not_startable')
  })

  it('refuses a second mint inside the cooldown, with a retry hint', async () => {
    const justMinted = signGuestCookie(
      withMint(withGuestSession(null, SESSION, NOW_S - 60), SESSION, NOW_S - 30),
    )!
    const { status, body } = await mint(justMinted)
    expect(status).toBe(429)
    expect(body.code).toBe('guest_mint_cooldown')
    expect(body.retryAfterSeconds).toBeGreaterThan(0)
    expect(mocks.updates).toHaveLength(0)
  })

  it('refuses a fourth session from the same browser in a day', async () => {
    let cookie = withGuestSession(null, 'a', NOW_S - 400)
    cookie = withGuestSession(cookie, 'b', NOW_S - 300)
    cookie = withGuestSession(cookie, 'c', NOW_S - 200)
    cookie = withGuestSession(cookie, SESSION, NOW_S - 100)
    const { status, body } = await mint(signGuestCookie(cookie)!)
    expect(status).toBe(429)
    expect(body.code).toBe('guest_daily_limit')
  })

  it('refuses a station other than the one the row was opened against', async () => {
    const { status, body } = await mint(boundCookie(), { stationId: 'a-different-station' })
    expect(status).toBe(403)
    expect(body.code).toBe('guest_station_mismatch')
  })

  it('refuses a session that belongs to an account', async () => {
    mocks.session = { ...mocks.session, user_id: 'user-1' }
    expect((await mint(boundCookie())).body.code).toBe('guest_session_owned')
  })

  it('refuses a retired station', async () => {
    mocks.station = null
    expect((await mint(boundCookie())).status).toBe(403)
  })

  it('asks for BOTH C2 filters before it spends anything', async () => {
    // The mint is the last gate before Azure is charged, and `is_active` alone
    // is what made all 200 paid stations reachable in September.
    await mint(boundCookie())
    expect(mocks.stationFilters).not.toHaveLength(0)
    for (const filters of mocks.stationFilters) {
      expect(filters.is_free_trial, 'C2: the free flag is never optional').toBe(true)
      expect(filters.is_active, 'C2: a staged station is never reachable').toBe(true)
    }
  })

  it('refuses a case that is no longer one of the five, and mints nothing', async () => {
    mocks.station = null
    const { status, body } = await mint(boundCookie())
    expect(status).toBe(403)
    expect(body.error).toBe('This case is not available')
    expect(mocks.updates).toHaveLength(0)
  })

  it('never answers 410 — the lane is open again', async () => {
    // Between 7 and 11 September this route was a 410 stub. A regression to it
    // would stop the funnel silently: the call screen simply never connects.
    const { status, body } = await mint(boundCookie())
    expect(status).toBe(200)
    expect(body.error).toBeUndefined()
  })

  it('starts the cooldown only when a key was actually minted', async () => {
    const minted = await mint(boundCookie())
    expect(minted.setCookie).toMatch(/^ff_guest=/)

    mocks.mintThrows = true
    const failed = await mint(boundCookie())
    expect(failed.status).toBe(500)
    expect(failed.setCookie).toBe('')
  })

  it('still says no to a signed-in caller', async () => {
    mocks.signedIn = true
    expect((await mint(boundCookie())).status).toBe(403)
  })
})

describe('the per-IP brake', () => {
  it('stops one client minting key after key, whatever its cookies say', async () => {
    // The nine cookie rules are all per-browser; a client that keeps no cookie
    // jar gets a fresh set of them on every request, and this is the endpoint
    // that charges Azure.
    const { GUEST_MINTS_PER_IP_PER_HOUR } = await import('@/lib/trial/guestRateLimit')
    const ip = '198.51.100.21'

    for (let attempt = 0; attempt < GUEST_MINTS_PER_IP_PER_HOUR; attempt += 1) {
      // A fresh cookie each time, so the two-minute per-session cooldown never
      // fires and the per-IP budget is what is being measured.
      expect((await mint(boundCookie(`session-${attempt}`), { sessionId: `session-${attempt}` }, ip)).status).toBe(200)
    }

    const { status, body } = await mint(boundCookie(), {}, ip)
    expect(status).toBe(429)
    expect(body.code).toBe('guest_ip_limit')
  })

  it('leaves a different client alone', async () => {
    const { GUEST_MINTS_PER_IP_PER_HOUR } = await import('@/lib/trial/guestRateLimit')
    const ip = '198.51.100.22'
    for (let attempt = 0; attempt <= GUEST_MINTS_PER_IP_PER_HOUR; attempt += 1) {
      await mint(boundCookie(`s-${attempt}`), { sessionId: `s-${attempt}` }, ip)
    }

    expect((await mint(boundCookie(), {}, '198.51.100.23')).status).toBe(200)
  })
})
