import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  NO_TRIAL,
  NO_USAGE,
  computeTrialAccess,
  type TrialAccess,
  type TrialGrant,
} from '@/lib/commerce/trialAccess'
import type { Entitlement } from '@/lib/commerce/entitlements'

/**
 * The authed chokepoint for the five FIXED CASES.
 *
 * The middleware guards page navigations only, and the station id arrives in
 * the request body — so this is the refusal that actually decides which of the
 * two hundred a trial account may open, and there is nothing upstream of it
 * that has looked at the id at all. On the way in it is also where the five-day
 * clock starts, which since the September rewrite is the ONLY thing that ends a
 * trial. Both are pinned here because both are things a client cannot be
 * trusted to do for itself.
 */

const getServerEntitlement = vi.fn()
const getSupabaseAdmin = vi.fn()
const startTrialWindowFor = vi.fn()

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
    startTrialWindowFor: (...args: unknown[]) => startTrialWindowFor(...args),
  }
})

const { POST } = await import('./route')

const NOW = new Date('2026-09-10T12:00:00Z')
const DAY = 86_400_000

/** The five flagged cases, in `free_trial_order`. */
const FIVE = ['st-1', 'st-2', 'st-3', 'st-4', 'st-5']

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

/** A live trial on the five, with whatever attempts have already been run. */
function liveTrial(attempts: Record<string, number> = {}, stations = FIVE): TrialAccess {
  return computeTrialAccess(
    grant({ startedAt: new Date(NOW.getTime() - DAY), expiresAt: new Date(NOW.getTime() + 4 * DAY) }),
    { casesTried: Object.keys(attempts).length, attemptsByStation: attempts },
    stations,
    NOW,
  )
}

/** A trial whose five days ran out yesterday. */
function expiredTrial(): TrialAccess {
  return computeTrialAccess(
    grant({
      startedAt: new Date(NOW.getTime() - 6 * DAY),
      expiresAt: new Date(NOW.getTime() - DAY),
    }),
    NO_USAGE,
    FIVE,
    NOW,
  )
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
  startTrialWindowFor.mockResolvedValue(undefined)
})

describe('the five fixed cases', () => {
  it('opens one of the five', async () => {
    signedIn({ trial: liveTrial(), allowed: true, trialOnly: true })
    const res = await POST(request({ sessionId: 'sess-1', stationId: 'st-3' }))
    expect(res.status).toBe(200)
    expect(await res.json()).toMatchObject({ status: 'created' })
  })

  it('refuses a case outside the five, with its own code', async () => {
    // The refusal that replaced the allowance. `no_active_plan` would be wrong
    // here — this account has a live trial and four other cases it can open
    // right now — so the client needs to be able to tell the two apart.
    signedIn({ trial: liveTrial(), allowed: true, trialOnly: true })
    const res = await POST(request({ sessionId: 'sess-1', stationId: 'st-99' }))
    expect(res.status).toBe(403)
    expect(await res.json()).toMatchObject({
      error: 'trial_station_locked',
      trial: true,
      freeStationIds: FIVE,
    })
  })

  it('does not create the session row for a locked case', async () => {
    // The refusal has to land BEFORE the insert, or a locked case would leave
    // a `reading` row behind on every attempt.
    const sessions = stubSessions()
    signedIn({ trial: liveTrial(), allowed: true, trialOnly: true, sessions })
    await POST(request({ sessionId: 'sess-1', stationId: 'st-99' }))
    expect(sessions.insert).not.toHaveBeenCalled()
  })

  it('allows the same case again, and again', async () => {
    // UNLIMITED ATTEMPTS, at the endpoint rather than only in the copy. Twelve
    // previous goes at this case change nothing.
    signedIn({ trial: liveTrial({ 'st-2': 12 }), allowed: true, trialOnly: true })
    const res = await POST(request({ sessionId: 'sess-9', stationId: 'st-2' }))
    expect(res.status).toBe(200)
  })

  it('allows a sixth consultation once every case has been tried', async () => {
    // The behaviour that changed. Under the allowance this was the refusal.
    signedIn({
      trial: liveTrial({ 'st-1': 1, 'st-2': 1, 'st-3': 1, 'st-4': 1, 'st-5': 1 }),
      allowed: true,
      trialOnly: true,
    })
    expect((await POST(request({ sessionId: 'sess-6', stationId: 'st-1' }))).status).toBe(200)
  })

  it('refuses everything when nothing is flagged', async () => {
    // FAIL CLOSED. An unapplied migration or a failed station read both arrive
    // here as an empty list, and neither may be read as "the whole bank".
    signedIn({ trial: liveTrial({}, []), allowed: true, trialOnly: true })
    const res = await POST(request({ sessionId: 'sess-1', stationId: 'st-1' }))
    expect(res.status).toBe(403)
    expect(await res.json()).toMatchObject({ error: 'trial_station_locked' })
  })

  it('does not narrow somebody who has bought to five cases', async () => {
    // `trialOnly` is what gates the check, exactly as `cohortOnly` gates the
    // cohort one: a trialist who has since paid keeps the bank.
    signedIn({
      trial: liveTrial(),
      allowed: true,
      trialOnly: false,
      entitlement: { state: 'active', hasLectures: false },
    })
    expect((await POST(request({ sessionId: 'sess-1', stationId: 'st-99' }))).status).toBe(200)
  })
})

describe('the five days', () => {
  it('refuses an expired window with its own code', async () => {
    signedIn({ trial: expiredTrial(), allowed: false })
    const res = await POST(request())
    expect(res.status).toBe(403)
    expect(await res.json()).toMatchObject({
      error: 'trial_expired',
      trial: true,
      reason: 'expiry',
    })
  })

  it('answers expiry, not the station lock, for an expired trial on a locked case', async () => {
    // Order matters: the useful sentence is "your five days are up", and the
    // destination is the wall — not "that is not one of your five".
    signedIn({ trial: expiredTrial(), allowed: false })
    const res = await POST(request({ sessionId: 'sess-1', stationId: 'st-99' }))
    expect(await res.json()).toMatchObject({ error: 'trial_expired' })
  })

  it('still answers no_active_plan for somebody who never had a trial', async () => {
    signedIn({ trial: NO_TRIAL, allowed: false })
    const res = await POST(request())
    expect(res.status).toBe(403)
    expect(await res.json()).toMatchObject({ error: 'no_active_plan' })
  })

  it('does not let an expired grant refuse somebody who has bought', async () => {
    // The property the peer shape guarantees, at the chokepoint rather than in
    // the pure layer: `allowed` is true off the purchase, so the refusal never
    // fires however dead the grant is.
    signedIn({
      trial: expiredTrial(),
      allowed: true,
      entitlement: { state: 'active', hasLectures: false },
    })
    expect((await POST(request())).status).toBe(200)
  })
})

describe('starting the five-day window', () => {
  it('stamps it on the first consultation', async () => {
    signedIn({
      trial: computeTrialAccess(grant(), NO_USAGE, FIVE, NOW),
      allowed: true,
      trialOnly: true,
    })

    await POST(request())

    expect(startTrialWindowFor).toHaveBeenCalledTimes(1)
    // `trialOnly` is the gate the helper applies; the compare-and-set on
    // `started_at is null` is what makes a second call a no-op.
    expect(startTrialWindowFor.mock.calls[0][1]).toBe(true)
  })

  it('stamps on a retry that finds the session already there', async () => {
    // Otherwise a create-session that failed after its insert leaves a session
    // whose window never started — and an unstarted window never expires, which
    // is now the only way a trial can fail to end at all.
    signedIn({
      trial: computeTrialAccess(grant(), NO_USAGE, FIVE, NOW),
      allowed: true,
      trialOnly: true,
      sessions: stubSessions({ id: 'sess-1' }),
    })

    const res = await POST(request())

    expect(await res.json()).toMatchObject({ status: 'exists' })
    expect(startTrialWindowFor).toHaveBeenCalledTimes(1)
  })

  it('does not start a clock for somebody who has bought', async () => {
    signedIn({
      trial: computeTrialAccess(grant(), NO_USAGE, FIVE, NOW),
      allowed: true,
      // Not trial-only: the purchase is what grants access, so no grant is
      // being used and no countdown belongs on their dashboard.
      trialOnly: false,
      entitlement: { state: 'active', hasLectures: false },
    })

    await POST(request())

    expect(startTrialWindowFor.mock.calls[0][1]).toBe(false)
  })

  it('does not start the clock for a case the trial cannot open', async () => {
    // A locked case is refused before the insert, so it must not burn a day of
    // a window it never got to use.
    signedIn({ trial: liveTrial(), allowed: true, trialOnly: true })
    await POST(request({ sessionId: 'sess-1', stationId: 'st-99' }))
    expect(startTrialWindowFor).not.toHaveBeenCalled()
  })

  it('does not start the clock when the session could not be created', async () => {
    // The five days must run from a consultation that exists. A request that
    // fell over on the way in cannot burn a day.
    signedIn({
      trial: computeTrialAccess(grant(), NO_USAGE, FIVE, NOW),
      allowed: true,
      trialOnly: true,
      sessions: stubSessions(null, { message: 'insert failed' }),
    })

    const res = await POST(request())

    expect(res.status).toBe(500)
    expect(startTrialWindowFor).not.toHaveBeenCalled()
  })
})

describe('a lapsed customer who also holds an expired grant', () => {
  it('is told to renew, not shown the trial wall', async () => {
    // The API must not name a different wall from the one a page navigation
    // would reach: the middleware sends this person to /pricing?renew=true.
    signedIn({
      trial: expiredTrial(),
      allowed: false,
      entitlement: { state: 'read_only', plan: 'self_study', hasLectures: false },
    })
    expect(await (await POST(request())).json()).toMatchObject({
      error: 'no_active_plan',
      state: 'read_only',
    })
  })
})
