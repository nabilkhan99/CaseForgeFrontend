import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  NO_TRIAL,
  computeTrialAccess,
  type TrialAccess,
  type TrialGrant,
} from '@/lib/commerce/trialAccess'
import type { Entitlement } from '@/lib/commerce/entitlements'

/**
 * The authed chokepoint for the five-station cap.
 *
 * The middleware guards page navigations only, so this is the refusal that
 * actually holds — and, on the way in, the one place the five-day clock is
 * started. Both are pinned here because both are things a client cannot be
 * trusted to do for itself.
 */

const getServerEntitlement = vi.fn()
const getSupabaseAdmin = vi.fn()
const loadTrialGrant = vi.fn()
const startTrialWindow = vi.fn()

vi.mock('@/lib/commerce/serverEntitlement', () => ({
  getServerEntitlement: () => getServerEntitlement(),
}))
vi.mock('@/lib/supabase/admin', () => ({
  getSupabaseAdmin: () => getSupabaseAdmin(),
}))
vi.mock('@/lib/commerce/trialAccess', async (importOriginal) => {
  // The pure parts are the real ones — the point is to test the route against
  // the real refusal rules, not against a restatement of them.
  const actual = await importOriginal<typeof import('@/lib/commerce/trialAccess')>()
  return {
    ...actual,
    loadTrialGrant: (...args: unknown[]) => loadTrialGrant(...args),
    startTrialWindow: (...args: unknown[]) => startTrialWindow(...args),
  }
})

const { POST } = await import('./route')

const NOW = new Date('2026-09-10T12:00:00Z')
const DAY = 86_400_000

function grant(over: Partial<TrialGrant> = {}): TrialGrant {
  return {
    id: 'grant-1',
    userId: 'user-1',
    email: 'gp@example.com',
    allowance: 5,
    windowDays: 5,
    source: 'signup',
    startedAt: null,
    expiresAt: null,
    createdAt: new Date('2026-09-08T09:00:00Z'),
    ...over,
  }
}

/** A `clinical_sessions` stub whose `single()` reports no existing row. */
function stubSessions(existing: unknown = null, insertError: unknown = null) {
  const insert = vi.fn().mockResolvedValue({ error: insertError })
  const single = vi.fn().mockResolvedValue({ data: existing })
  const eq = vi.fn(() => ({ single }))
  const select = vi.fn(() => ({ eq }))
  return { from: vi.fn(() => ({ select, insert })), insert }
}

function signedIn(opts: {
  trial?: TrialAccess
  allowed?: boolean
  trialOnly?: boolean
  entitlement?: Entitlement
  sessions?: ReturnType<typeof stubSessions>
}) {
  const sessions = opts.sessions ?? stubSessions()
  getServerEntitlement.mockResolvedValue({
    supabase: sessions,
    user: { id: 'user-1', email: 'gp@example.com' },
    entitlement: opts.entitlement ?? { state: 'none', hasLectures: false },
    bypass: false,
    cohort: null,
    cohortOnly: false,
    trial: opts.trial ?? NO_TRIAL,
    trialOnly: opts.trialOnly ?? false,
    failedOpen: false,
    allowed: opts.allowed ?? false,
  })
  return sessions
}

function request(body: unknown = { sessionId: 'sess-1', stationId: 'st-1' }) {
  return { json: async () => body } as never
}

beforeEach(() => {
  vi.clearAllMocks()
  getSupabaseAdmin.mockReturnValue({})
  loadTrialGrant.mockResolvedValue(null)
  startTrialWindow.mockResolvedValue(true)
})

describe('the five-station cap', () => {
  it('refuses a spent allowance with its own code, not no_active_plan', () => {
    // `no_active_plan` is true but useless: it sends the client to
    // renew-vs-buy, and somebody who has just used their fifth station needs
    // the two-plan wall instead.
    const spent = computeTrialAccess(
      grant({ startedAt: new Date(NOW.getTime() - DAY), expiresAt: new Date(NOW.getTime() + 4 * DAY) }),
      5,
      NOW,
    )
    signedIn({ trial: spent, allowed: false })
    return POST(request()).then(async (res) => {
      expect(res.status).toBe(403)
      expect(await res.json()).toMatchObject({
        error: 'trial_allowance_used',
        trial: true,
        used: 5,
        remaining: 0,
        reason: 'allowance',
      })
    })
  })

  it('refuses an expired window with a distinct code', async () => {
    const expired = computeTrialAccess(
      grant({
        startedAt: new Date(NOW.getTime() - 6 * DAY),
        expiresAt: new Date(NOW.getTime() - DAY),
      }),
      2,
      NOW,
    )
    signedIn({ trial: expired, allowed: false })
    const res = await POST(request())
    expect(res.status).toBe(403)
    expect(await res.json()).toMatchObject({ error: 'trial_expired', reason: 'expiry', remaining: 3 })
  })

  it('still answers no_active_plan for somebody who never had a trial', async () => {
    signedIn({ trial: NO_TRIAL, allowed: false })
    const res = await POST(request())
    expect(res.status).toBe(403)
    expect(await res.json()).toMatchObject({ error: 'no_active_plan' })
  })

  it('never refuses a live trial', async () => {
    signedIn({ trial: computeTrialAccess(grant(), 2, NOW), allowed: true, trialOnly: true })
    const res = await POST(request())
    expect(res.status).toBe(200)
    expect(await res.json()).toMatchObject({ status: 'created' })
  })

  it('does not let a spent grant refuse somebody who has bought', async () => {
    // The property the peer shape guarantees, at the chokepoint rather than in
    // the pure layer: `allowed` is true off the purchase, so the refusal never
    // fires however dead the grant is.
    const spent = computeTrialAccess(grant({ startedAt: new Date(NOW.getTime() - 9 * DAY), expiresAt: new Date(NOW.getTime() - 4 * DAY) }), 5, NOW)
    signedIn({ trial: spent, allowed: true, entitlement: { state: 'active', hasLectures: false } })
    expect((await POST(request())).status).toBe(200)
  })
})

describe('starting the five-day window', () => {
  it('stamps it on the first consultation', async () => {
    const unstarted = grant()
    loadTrialGrant.mockResolvedValue(unstarted)
    signedIn({ trial: computeTrialAccess(unstarted, 0, NOW), allowed: true, trialOnly: true })

    await POST(request())

    expect(startTrialWindow).toHaveBeenCalledTimes(1)
    expect(startTrialWindow.mock.calls[0][1]).toBe(unstarted)
  })

  it('does not re-stamp a window that is already open', async () => {
    // The compare-and-set in startTrialWindow is the real guarantee; this is
    // the cheap early-out that keeps every consultation after the first from
    // issuing a write that can only match zero rows.
    const open = grant({
      startedAt: new Date(NOW.getTime() - 2 * DAY),
      expiresAt: new Date(NOW.getTime() + 3 * DAY),
    })
    loadTrialGrant.mockResolvedValue(open)
    signedIn({ trial: computeTrialAccess(open, 2, NOW), allowed: true, trialOnly: true })

    await POST(request())

    expect(startTrialWindow).not.toHaveBeenCalled()
  })

  it('stamps on a retry that finds the session already there', async () => {
    // Otherwise a create-session that failed after its insert leaves a session
    // whose window never started — and an unstarted window never expires.
    const unstarted = grant()
    loadTrialGrant.mockResolvedValue(unstarted)
    signedIn({
      trial: computeTrialAccess(unstarted, 0, NOW),
      allowed: true,
      trialOnly: true,
      sessions: stubSessions({ id: 'sess-1' }),
    })

    const res = await POST(request())

    expect(await res.json()).toMatchObject({ status: 'exists' })
    expect(startTrialWindow).toHaveBeenCalledTimes(1)
  })

  it('does not start a clock for somebody who has bought', async () => {
    loadTrialGrant.mockResolvedValue(grant())
    signedIn({
      trial: computeTrialAccess(grant(), 0, NOW),
      allowed: true,
      // Not trial-only: the purchase is what grants access, so no grant is
      // being spent and no countdown belongs on their dashboard.
      trialOnly: false,
      entitlement: { state: 'active', hasLectures: false },
    })

    await POST(request())

    expect(loadTrialGrant).not.toHaveBeenCalled()
    expect(startTrialWindow).not.toHaveBeenCalled()
  })

  it('does not start the clock when the session could not be created', async () => {
    // The five days must run from a consultation that exists. A request that
    // fell over on the way in cannot burn a day.
    loadTrialGrant.mockResolvedValue(grant())
    signedIn({
      trial: computeTrialAccess(grant(), 0, NOW),
      allowed: true,
      trialOnly: true,
      sessions: stubSessions(null, { message: 'insert failed' }),
    })

    const res = await POST(request())

    expect(res.status).toBe(500)
    expect(startTrialWindow).not.toHaveBeenCalled()
  })

  it('starts the consultation even when the stamp itself fails', async () => {
    loadTrialGrant.mockRejectedValue(new Error('database down'))
    signedIn({ trial: computeTrialAccess(grant(), 0, NOW), allowed: true, trialOnly: true })
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {})

    expect((await POST(request())).status).toBe(200)
    spy.mockRestore()
  })
})

describe('a lapsed customer who also holds a spent grant', () => {
  it('is told to renew, not shown the trial wall', async () => {
    // The API must not name a different wall from the one a page navigation
    // would reach: the middleware sends this person to /pricing?renew=true.
    const spent = computeTrialAccess(
      grant({
        startedAt: new Date(NOW.getTime() - 9 * DAY),
        expiresAt: new Date(NOW.getTime() - 4 * DAY),
      }),
      5,
      NOW,
    )
    signedIn({
      trial: spent,
      allowed: false,
      entitlement: { state: 'read_only', plan: 'self_study', hasLectures: false },
    })
    expect(await (await POST(request())).json()).toMatchObject({
      error: 'no_active_plan',
      state: 'read_only',
    })
  })
})
