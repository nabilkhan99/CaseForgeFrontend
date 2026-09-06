import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest'
import type { Entitlement } from '@/lib/commerce/entitlements'

/**
 * `GET /api/checkout` — the trial context the buy-path events are tagged with.
 *
 * Three properties are pinned here, and each one is a way the number could be
 * quietly wrong in a report nobody would think to doubt:
 *
 *   1. consumption is the DERIVED one (a `weighted_score` of 0 is not a
 *      station, and two result rows on one session are not two stations), the
 *      same rule the wall enforces — an event that counted differently from
 *      the product would make "how many stations before they bought"
 *      unanswerable;
 *   2. a grant is still reported AFTER a purchase, which is exactly where this
 *      differs from /api/subscription: the purchase event is the one that most
 *      needs the trial's numbers;
 *   3. it never fails. This route is on the path to Stripe.
 */

const mocks = vi.hoisted(() => ({
  user: null as { id: string; email: string } | null,
  entitlement: { state: 'none', hasLectures: false } as Entitlement,
  grant: null as Record<string, unknown> | null,
  grantError: null as unknown,
  sessions: [] as Array<Record<string, unknown>>,
  sessionsError: null as unknown,
}))

vi.mock('server-only', () => ({}))
vi.mock('next/headers', () => ({ cookies: async () => ({ get: () => undefined }) }))
vi.mock('@/lib/commerce/stripe', () => ({
  getStripe: () => {
    throw new Error('Stripe must not be touched by the GET handler')
  },
}))

vi.mock('@/lib/commerce/serverEntitlement', () => ({
  getServerEntitlement: async () => ({
    user: mocks.user,
    entitlement: mocks.entitlement,
    supabase: { from: () => ({ select: () => ({ ilike: () => ({ order: async () => ({ data: [], error: null }) }) }) }) },
    failedOpen: false,
  }),
}))

/**
 * The service-role client, shaped exactly as `loadTrialGrant` and
 * `countTrialConsumption` call it — the real implementations run against this,
 * so the derived-consumption rule is genuinely under test rather than mocked
 * away.
 */
vi.mock('@/lib/supabase/admin', () => ({
  getSupabaseAdmin: () => ({
    from: (table: string) => {
      if (table === 'trial_grants') {
        return {
          select: () => ({
            eq: () => ({
              maybeSingle: async () => ({ data: mocks.grant, error: mocks.grantError }),
            }),
          }),
        }
      }
      if (table === 'clinical_sessions') {
        return {
          select: () => ({
            eq: () => ({
              gte: async () => ({ data: mocks.sessions, error: mocks.sessionsError }),
            }),
          }),
        }
      }
      throw new Error(`unexpected table ${table}`)
    },
  }),
}))

const { GET } = await import('./route')

const NOW = new Date('2026-09-06T12:00:00Z')

async function get(): Promise<{
  trial: { trial_stations_used: number; days_since_first_station: number | null } | null
}> {
  const response = await GET()
  return response.json()
}

function grantStartedAt(startedAt: string | null): Record<string, unknown> {
  return {
    id: 'grant-1',
    user_id: 'user-1',
    email: 'trainee@nhs.net',
    allowance: 5,
    window_days: 5,
    source: 'signup',
    started_at: startedAt,
    expires_at: startedAt ? '2026-09-08T12:00:00Z' : null,
    created_at: '2026-09-01T09:00:00Z',
  }
}

/** A session with one mark on it, as PostgREST returns the embed. */
function marked(id: string, score: number | string | null) {
  return { id, session_results: { weighted_score: score } }
}

beforeEach(() => {
  vi.useFakeTimers()
  vi.setSystemTime(NOW)
  mocks.user = { id: 'user-1', email: 'trainee@nhs.net' }
  mocks.entitlement = { state: 'none', hasLectures: false }
  mocks.grant = null
  mocks.grantError = null
  mocks.sessions = []
  mocks.sessionsError = null
})

afterEach(() => {
  vi.useRealTimers()
})

describe('GET /api/checkout — trial funnel properties', () => {
  it('reports nothing for a signed-out buyer', async () => {
    mocks.user = null
    expect(await get()).toEqual({ trial: null })
  })

  it('reports nothing for a signed-in buyer with no grant', async () => {
    expect(await get()).toEqual({ trial: null })
  })

  it('counts only genuinely-scored sessions, and each one once', async () => {
    mocks.grant = grantStartedAt('2026-09-03T12:00:00Z')
    mocks.sessions = [
      marked('a', 6.2),
      // A string is what PostgREST can hand back for a numeric column.
      marked('b', '7.0'),
      // Zero is the empty-transcript artefact: not a station, and it must not
      // spend one.
      marked('c', 0),
      { id: 'd', session_results: null },
      // Two result rows on one consultation are still one station.
      { id: 'a', session_results: [{ weighted_score: 6.2 }] },
    ]

    expect(await get()).toEqual({
      trial: { trial_stations_used: 2, days_since_first_station: 3 },
    })
  })

  it('reports a null day count while the window has not opened', async () => {
    mocks.grant = grantStartedAt(null)
    expect(await get()).toEqual({
      trial: { trial_stations_used: 0, days_since_first_station: null },
    })
  })

  it('still reports the grant after the buyer has a live purchase', async () => {
    // /api/subscription deliberately hides the trial here. This route must not:
    // the `purchase` event is precisely where the trial numbers are needed.
    mocks.entitlement = { state: 'active', plan: 'complete', hasLectures: true }
    mocks.grant = grantStartedAt('2026-09-02T12:00:00Z')
    mocks.sessions = [marked('a', 5.5)]

    expect(await get()).toEqual({
      trial: { trial_stations_used: 1, days_since_first_station: 4 },
    })
  })

  it('degrades to no properties rather than failing the route', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    mocks.grant = grantStartedAt('2026-09-03T12:00:00Z')
    mocks.sessionsError = { message: 'boom' }

    expect(await get()).toEqual({ trial: null })
  })
})
