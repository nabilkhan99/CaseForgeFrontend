import { beforeEach, describe, expect, it, vi } from 'vitest'

/**
 * The one-click door. What it has to get right is which case it opens and what
 * it leaves behind: a guest row nobody owns, and a signed cookie binding this
 * browser to it — without which the Azure mint refuses.
 */

process.env.TRIAL_GUEST_COOKIE_SECRET = 'test-secret'

const mocks = vi.hoisted(() => ({
  signedIn: false,
  /** Rows the fake `stations` table answers with, per query shape. */
  requested: null as { id: string } | null,
  recommended: [] as { id: string }[],
  recommendedError: null as { code?: string } | null,
  active: [] as { id: string }[],
  inserted: [] as Record<string, unknown>[],
  insertError: null as unknown,
}))

vi.mock('server-only', () => ({}))

vi.mock('@/lib/trial/guestOnly', () => ({
  rejectIfSignedIn: async () => (mocks.signedIn ? { status: 403 } : null),
}))

/**
 * A stand-in for the PostgREST builder: every filter returns the builder and
 * records itself, and the terminal call answers from what the test set up.
 */
function stations() {
  const state = { filters: {} as Record<string, unknown>, orders: [] as string[] }
  const builder = {
    select: () => builder,
    eq: (column: string, value: unknown) => {
      state.filters[column] = value
      return builder
    },
    order: (column: string) => {
      state.orders.push(column)
      return builder
    },
    maybeSingle: async () => ({ data: mocks.requested, error: null }),
    limit: async () => {
      if ('is_free_trial' in state.filters) {
        if (mocks.recommendedError && state.orders.includes('free_trial_order')) {
          return { data: null, error: mocks.recommendedError }
        }
        return { data: mocks.recommended, error: null }
      }
      return { data: mocks.active, error: null }
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

const STATION = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'
const RECOMMENDED = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc'
const ANY_ACTIVE = 'dddddddd-dddd-4ddd-8ddd-dddddddddddd'

beforeEach(() => {
  vi.spyOn(console, 'warn').mockImplementation(() => {})
  vi.spyOn(console, 'error').mockImplementation(() => {})
  mocks.signedIn = false
  mocks.requested = null
  mocks.recommended = [{ id: RECOMMENDED }]
  mocks.recommendedError = null
  mocks.active = [{ id: ANY_ACTIVE }]
  mocks.inserted = []
  mocks.insertError = null
})

describe('which station it opens', () => {
  it('uses the one asked for when it is active', async () => {
    mocks.requested = { id: STATION }
    const { status, location } = await talk(`?station=${STATION}`)
    expect(status).toBe(307)
    expect(location).toMatch(/\/try\/session\/[0-9a-f-]{36}$/)
    expect(mocks.inserted[0]).toMatchObject({ station_id: STATION, user_id: null, status: 'reading' })
  })

  it('falls back to the first "Start here" case with no station asked for', async () => {
    await talk()
    expect(mocks.inserted[0]).toMatchObject({ station_id: RECOMMENDED })
  })

  it('falls back to "Start here" when the station asked for is retired', async () => {
    mocks.requested = null
    await talk(`?station=${STATION}`)
    expect(mocks.inserted[0]).toMatchObject({ station_id: RECOMMENDED })
  })

  it('ignores a station id that is not a uuid rather than asking PostgREST about it', async () => {
    await talk('?station=not-a-uuid')
    expect(mocks.inserted[0]).toMatchObject({ station_id: RECOMMENDED })
  })

  it('falls back to any active case when nothing is flagged "Start here"', async () => {
    mocks.recommended = []
    await talk()
    expect(mocks.inserted[0]).toMatchObject({ station_id: ANY_ACTIVE })
  })

  it('survives free_trial_order not existing yet', async () => {
    mocks.recommendedError = { code: '42703' }
    await talk()
    expect(mocks.inserted[0]).toMatchObject({ station_id: RECOMMENDED })
    expect(console.error).not.toHaveBeenCalled()
  })

  it('sends the visitor to the deliberate door when the bank is empty', async () => {
    mocks.recommended = []
    mocks.active = []
    const { location } = await talk()
    expect(location).toContain('/free?guest=unavailable')
    expect(mocks.inserted).toHaveLength(0)
  })
})

describe('what it leaves behind', () => {
  it('signs the new session into a httpOnly guest cookie', async () => {
    const { setCookie } = await talk()
    expect(setCookie).toMatch(/^ff_guest=/)
    expect(setCookie).toContain('HttpOnly')
    expect(setCookie).toContain('SameSite=lax')
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
