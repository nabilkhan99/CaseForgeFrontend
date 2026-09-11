import { beforeEach, describe, expect, it, vi } from 'vitest'

/**
 * The read-the-brief path's half of the guest lane.
 *
 * Two things are pinned here rather than left to a diff, because both are
 * product decisions a future tidy-up could quietly undo in opposite directions:
 * the 409 that told a returning lead they had used their free mock must NOT
 * come back, and the `is_free_trial` allowlist (contract C2) must NOT go away
 * again — it is what keeps an endpoint that spends Azure minutes with no
 * account behind it pointed at five cases instead of two hundred.
 */

process.env.TRIAL_GUEST_COOKIE_SECRET = 'test-secret'

const mocks = vi.hoisted(() => ({
  signedIn: false,
  /** The free active station the fake table holds, if any. */
  station: null as { id: string } | null,
  /** Every set of filters a `stations` query applied. */
  stationFilters: [] as Record<string, unknown>[],
  existing: null as { id: string; user_id: string | null } | null,
  inserted: [] as Record<string, unknown>[],
  insertError: null as { message: string } | null,
  leadLookups: 0,
}))

vi.mock('server-only', () => ({}))

vi.mock('@/lib/trial/guestOnly', () => ({
  rejectIfSignedIn: async () =>
    mocks.signedIn ? new Response(null, { status: 403 }) : null,
}))

vi.mock('@/lib/supabase/admin', () => ({
  getSupabaseAdmin: () => ({
    from: (table: string) => {
      if (table === 'trial_leads') mocks.leadLookups += 1
      const filters: Record<string, unknown> = {}
      if (table === 'stations') mocks.stationFilters.push(filters)
      const builder = {
        select: () => builder,
        eq: (column: string, value: unknown) => {
          filters[column] = value
          return builder
        },
        ilike: () => builder,
        maybeSingle: async () => ({
          data: table === 'stations' ? mocks.station : mocks.existing,
          error: null,
        }),
        insert: async (row: Record<string, unknown>) => {
          mocks.inserted.push(row)
          return { error: mocks.insertError }
        },
      }
      return builder
    },
  }),
}))

const { POST } = await import('./route')

const SESSION = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
const STATION = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'

async function post(body: Record<string, unknown> = {}, cookie?: string) {
  const response = await POST({
    json: async () => ({ sessionId: SESSION, stationId: STATION, ...body }),
    cookies: { get: (name: string) => (cookie && name === 'ff_guest' ? { value: cookie } : undefined) },
  } as never)
  return {
    status: response.status,
    body: await response.json().catch(() => ({})),
    setCookie: response.headers.get('set-cookie') ?? '',
  }
}

beforeEach(() => {
  vi.spyOn(console, 'warn').mockImplementation(() => {})
  mocks.signedIn = false
  mocks.station = { id: STATION }
  mocks.stationFilters = []
  mocks.existing = null
  mocks.inserted = []
  mocks.insertError = null
  mocks.leadLookups = 0
})

describe('create-session', () => {
  it('opens a guest row on a free active station', async () => {
    const { status, body } = await post()
    expect(status).toBe(200)
    expect(body).toMatchObject({ status: 'created', sessionId: SESSION })
    expect(mocks.inserted[0]).toMatchObject({
      id: SESSION,
      user_id: null,
      station_id: STATION,
      status: 'reading',
    })
  })

  it('no longer refuses a returning lead their second consultation', async () => {
    const { status, body } = await post({ knownEmail: 'someone@nhs.net' })
    expect(status).toBe(200)
    expect(body.code).toBeUndefined()
    // The 409 read trial_leads to decide. Nothing looks there any more.
    expect(mocks.leadLookups).toBe(0)
  })

  it('binds the browser to the session with a signed httpOnly cookie', async () => {
    const { setCookie } = await post()
    expect(setCookie).toMatch(/^ff_guest=/)
    expect(setCookie).toContain('HttpOnly')

    const { readGuestCookie } = await import('@/lib/trial/guestSession')
    const value = decodeURIComponent(setCookie.split(';')[0].replace('ff_guest=', ''))
    expect(readGuestCookie(value)?.s.map((entry) => entry.i)).toContain(SESSION)
  })

  it('is idempotent, and re-signs the cookie for a session it already has', async () => {
    mocks.existing = { id: SESSION, user_id: null }
    const { status, body, setCookie } = await post()
    expect(status).toBe(200)
    expect(body.status).toBe('exists')
    expect(mocks.inserted).toHaveLength(0)
    expect(setCookie).toMatch(/^ff_guest=/)
  })

  it('asks for BOTH C2 filters, never is_active alone', async () => {
    await post()
    expect(mocks.stationFilters).not.toHaveLength(0)
    for (const filters of mocks.stationFilters) {
      expect(filters.is_free_trial, 'C2: the free flag is never optional').toBe(true)
      expect(filters.is_active, 'C2: a staged station is never reachable').toBe(true)
    }
  })

  it('refuses a station outside the five rather than swapping in one inside it', async () => {
    // /try/talk substitutes, because it chose the case itself. This route was
    // handed an explicit id by a page already showing that brief, so a silent
    // swap would open a session the very next call refuses as a mismatch.
    mocks.station = null
    const { status, body } = await post()
    expect(status).toBe(400)
    expect(body.error).toBe('This case is not available')
    expect(mocks.inserted).toHaveLength(0)
  })

  it('refuses a session that belongs to an account', async () => {
    mocks.existing = { id: SESSION, user_id: 'user-1' }
    expect((await post()).status).toBe(403)
  })

  it('refuses a fourth consultation from the same browser in a day', async () => {
    const { signGuestCookie, withGuestSession } = await import('@/lib/trial/guestSession')
    const now = Math.floor(Date.now() / 1000)
    let cookie = withGuestSession(null, 'a', now)
    cookie = withGuestSession(cookie, 'b', now)
    cookie = withGuestSession(cookie, 'c', now)

    const { status, body } = await post({}, signGuestCookie(cookie)!)
    expect(status).toBe(429)
    expect(body.code).toBe('guest_daily_limit')
    expect(mocks.inserted).toHaveLength(0)
  })

  it('still says no to a signed-in caller', async () => {
    mocks.signedIn = true
    expect((await post()).status).toBe(403)
  })

  it('needs both ids', async () => {
    expect((await post({ stationId: null })).status).toBe(400)
  })
})
