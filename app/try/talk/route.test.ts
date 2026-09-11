import { beforeEach, describe, expect, it, vi } from 'vitest'

/**
 * The one-click door, reopened.
 *
 * Between 7 and 11 September this route was a redirect to /free/start: the
 * offer had become account-first, and nothing anonymous ran at all. It opens a
 * real consultation again, so what it has to get right is what it always had to
 * get right — which case it opens, and what it leaves behind: a
 * `clinical_sessions` row nobody owns, and a signed cookie binding this browser
 * to it, without which the Azure mint refuses.
 *
 * The station rule is contract C2 and lives in lib/trial/guestStation.ts, where
 * it has its own tests. What is pinned HERE is that the door uses it — that a
 * case outside the five never reaches the insert, and that an empty free list
 * ends at /free rather than in a paid station.
 */

process.env.TRIAL_GUEST_COOKIE_SECRET = 'test-secret'

const mocks = vi.hoisted(() => ({
  signedIn: false,
  /** The free active stations, in `free_trial_order`. */
  free: [] as { id: string }[],
  /** Set to make an `order('free_trial_order')` fail the way PostgREST does. */
  freeOrderError: null as { code?: string } | null,
  inserted: [] as Record<string, unknown>[],
  insertError: null as unknown,
}))

vi.mock('server-only', () => ({}))

vi.mock('@/lib/trial/guestOnly', () => ({
  rejectIfSignedIn: async () => (mocks.signedIn ? { status: 403 } : null),
}))

/**
 * A stand-in for the PostgREST builder over a `stations` table that holds only
 * the free active ones — which is exactly what C2's two filters select, so a
 * query missing a filter would find a row the real table would not, and the
 * filter assertion below is what catches that.
 */
function stations() {
  const filters: Record<string, unknown> = {}
  const orders: string[] = []
  const builder = {
    select: () => builder,
    eq: (column: string, value: unknown) => {
      filters[column] = value
      return builder
    },
    order: (column: string) => {
      orders.push(column)
      return builder
    },
    maybeSingle: async () => {
      expect(filters.is_free_trial, 'C2: the free flag is never optional').toBe(true)
      expect(filters.is_active, 'C2: a staged station is never reachable').toBe(true)
      return { data: mocks.free.find((row) => row.id === filters.id) ?? null, error: null }
    },
    limit: async () => {
      expect(filters.is_free_trial, 'C2: the free flag is never optional').toBe(true)
      expect(filters.is_active, 'C2: a staged station is never reachable').toBe(true)
      if (mocks.freeOrderError && orders.includes('free_trial_order')) {
        return { data: null, error: mocks.freeOrderError }
      }
      return { data: mocks.free.slice(0, 1), error: null }
    },
  }
  return builder
}

vi.mock('@/lib/supabase/admin', () => ({
  getSupabaseAdmin: () => ({
    from: (table: string) => {
      if (table === 'stations') return stations()
      return {
        insert: async (row: Record<string, unknown>) => {
          mocks.inserted.push(row)
          return { error: mocks.insertError }
        },
      }
    },
  }),
}))

const { GET } = await import('./route')

function request(search = '', cookie?: string, headers: Record<string, string> = {}, method = 'GET') {
  const url = `https://fourteenfisherman.com/try/talk${search}`
  return {
    url,
    method,
    nextUrl: new URL(url),
    headers: new Headers(headers),
    cookies: { get: (name: string) => (cookie && name === 'ff_guest' ? { value: cookie } : undefined) },
  } as never
}

async function talk(search = '', cookie?: string, headers?: Record<string, string>, method?: string) {
  const response = await GET(request(search, cookie, headers, method))
  return {
    status: response.status,
    location: response.headers.get('location') ?? '',
    setCookie: response.headers.get('set-cookie') ?? '',
  }
}

const FIRST_FREE = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
const OTHER_FREE = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'
const PAID = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc'

beforeEach(() => {
  vi.spyOn(console, 'warn').mockImplementation(() => {})
  vi.spyOn(console, 'error').mockImplementation(() => {})
  mocks.signedIn = false
  mocks.free = [{ id: FIRST_FREE }, { id: OTHER_FREE }]
  mocks.freeOrderError = null
  mocks.inserted = []
  mocks.insertError = null
})

describe('what one click opens', () => {
  it('opens a guest consultation and sends the visitor into the call', async () => {
    const { status, location } = await talk(`?station=${OTHER_FREE}`)
    expect(status).toBe(307)
    expect(location).toMatch(/\/try\/session\/[0-9a-f-]{36}$/)
    expect(mocks.inserted[0]).toMatchObject({
      station_id: OTHER_FREE,
      user_id: null,
      status: 'reading',
    })
  })

  it('opens the first free case when nothing is asked for', async () => {
    await talk()
    expect(mocks.inserted[0]).toMatchObject({ station_id: FIRST_FREE })
  })

  it('never opens a case outside the five, whatever the query says', async () => {
    // The rule that keeps 200 paid stations off an endpoint that spends Azure
    // minutes with no account behind them.
    await talk(`?station=${PAID}`)
    expect(mocks.inserted[0]).toMatchObject({ station_id: FIRST_FREE })
  })

  it('ignores a station id that is not a uuid', async () => {
    await talk('?station=not-a-uuid')
    expect(mocks.inserted[0]).toMatchObject({ station_id: FIRST_FREE })
  })

  it('survives free_trial_order not existing yet', async () => {
    mocks.freeOrderError = { code: '42703' }
    await talk()
    expect(mocks.inserted[0]).toMatchObject({ station_id: FIRST_FREE })
  })

  it('sends the visitor to /free when no case is free at all', async () => {
    mocks.free = []
    const { location } = await talk(`?station=${PAID}`)
    expect(location).toContain('/free?guest=unavailable')
    expect(mocks.inserted).toHaveLength(0)
  })

  it('sends the visitor to /free when the row cannot be written', async () => {
    mocks.insertError = { message: 'nope' }
    const { location } = await talk()
    expect(location).toContain('/free?guest=unavailable')
  })
})

describe('what it leaves behind', () => {
  it('signs the new session into a httpOnly guest cookie', async () => {
    const { setCookie } = await talk()
    expect(setCookie).toMatch(/^ff_guest=/)
    expect(setCookie).toContain('HttpOnly')
    expect(setCookie).toContain('SameSite=lax')
  })

  it('records the session the browser is being sent to, so the mint recognises it', async () => {
    const { location, setCookie } = await talk()
    const sessionId = location.split('/').pop()!
    const { readGuestCookie, cookieOwnsSession } = await import('@/lib/trial/guestSession')
    const value = decodeURIComponent(setCookie.split(';')[0].replace('ff_guest=', ''))
    expect(cookieOwnsSession(readGuestCookie(value), sessionId)).toBe(true)
  })

  it('refuses a fourth consultation from the same browser in a day', async () => {
    const { readGuestCookie, signGuestCookie, withGuestSession } = await import(
      '@/lib/trial/guestSession'
    )
    const now = Math.floor(Date.now() / 1000)
    let cookie = readGuestCookie(signGuestCookie({ g: 'guest-1', s: [] }))
    for (const id of ['a', 'b', 'c']) cookie = withGuestSession(cookie, id, now)

    const { location } = await talk('', signGuestCookie(cookie!)!)
    expect(location).toContain('/free?guest=limit')
    expect(mocks.inserted).toHaveLength(0)
  })

  it.each([
    ['a Next router prefetch', { 'next-router-prefetch': '1' }],
    ['a speculation-rules prefetch', { 'sec-purpose': 'prefetch;anonymous-client-ip' }],
    ['an older browser prefetch', { purpose: 'prefetch' }],
    ["Safari's link preview", { 'x-purpose': 'preview' }],
  ])('opens nothing for %s', async (_name, headers) => {
    // This route has a side effect and is reached by GET, so a link in the
    // viewport of a landing page would otherwise open a consultation for
    // everybody who scrolled past it.
    const { status } = await talk('', undefined, headers)
    expect(status).toBe(204)
    expect(mocks.inserted).toHaveLength(0)
  })

  it('opens nothing for a HEAD, which is how link unfurlers ask', async () => {
    const { status } = await talk('', undefined, {}, 'HEAD')
    expect(status).toBe(204)
    expect(mocks.inserted).toHaveLength(0)
  })

  it('sends a signed-in visitor to their dashboard instead', async () => {
    mocks.signedIn = true
    const { location } = await talk()
    expect(location).toContain('/dashboard')
    expect(mocks.inserted).toHaveLength(0)
  })
})
