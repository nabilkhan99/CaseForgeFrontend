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
 * What /api/subscription tells a trial account about itself.
 *
 * This one response feeds every surface that has to agree with the two server
 * chokepoints: the dashboard panel, the library board's locks, the topic pages
 * and the brief page. If `freeStationIds` here ever disagreed with what
 * create-session enforces, a trainee would read a brief and then be refused by
 * the API — so the shape is pinned, not reviewed.
 */

const getServerEntitlement = vi.fn()
const getSupabaseAdmin = vi.fn()

vi.mock('@/lib/commerce/serverEntitlement', () => ({
  getServerEntitlement: () => getServerEntitlement(),
}))
vi.mock('@/lib/supabase/admin', () => ({
  getSupabaseAdmin: () => getSupabaseAdmin(),
}))

const { GET } = await import('./route')

const DAY = 86_400_000
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
    createdAt: new Date(Date.now() - 2 * DAY),
    ...over,
  }
}

function signedIn(opts: {
  trial?: TrialAccess
  entitlement?: Entitlement
  allowed?: boolean
  bypass?: boolean
  trialOnly?: boolean
}) {
  getServerEntitlement.mockResolvedValue({
    supabase: {},
    user: { id: 'user-1', email: 'gp@example.com' },
    entitlement: opts.entitlement ?? { state: 'none', hasLectures: false },
    bypass: opts.bypass ?? false,
    cohort: null,
    cohortOnly: false,
    trial: opts.trial ?? NO_TRIAL,
    trialOnly: opts.trialOnly ?? opts.trial?.state === 'trial',
    failedOpen: false,
    allowed: opts.allowed ?? opts.trial?.state === 'trial',
  })
}

/** `trial_leads`, for the exam hint the two-plan offer picks its pair from. */
function stubLeads(sitting: string | null) {
  const maybeSingle = vi.fn().mockResolvedValue({ data: sitting ? { sca_sitting: sitting } : null, error: null })
  const limit = vi.fn(() => ({ maybeSingle }))
  const order = vi.fn(() => ({ limit }))
  const ilike = vi.fn(() => ({ order }))
  const select = vi.fn(() => ({ ilike }))
  return { from: vi.fn(() => ({ select })), select }
}

async function body() {
  return (await GET()).json()
}

beforeEach(() => {
  vi.clearAllMocks()
  getSupabaseAdmin.mockReturnValue(stubLeads(null))
})

describe('the trial block', () => {
  it('carries the five, the progress and the attempts', async () => {
    const startedAt = new Date(Date.now() - DAY)
    signedIn({
      trial: computeTrialAccess(
        grant({ startedAt, expiresAt: new Date(startedAt.getTime() + 5 * DAY) }),
        { casesTried: 2, attemptsByStation: { 'st-1': 3, 'st-2': 1 } },
        FIVE,
      ),
    })

    expect((await body()).trial).toMatchObject({
      state: 'trial',
      freeStationIds: FIVE,
      casesTried: 2,
      attemptsByStation: { 'st-1': 3, 'st-2': 1 },
      attemptsUnlimited: true,
      allowance: 5,
      remaining: 3,
    })
  })

  it('says nothing runs out but the days', async () => {
    // `attemptsUnlimited` is stated rather than assumed: a client rendering a
    // count without checking it would be describing last month's product.
    const startedAt = new Date(Date.now() - DAY)
    signedIn({
      trial: computeTrialAccess(
        grant({ startedAt, expiresAt: new Date(startedAt.getTime() + 5 * DAY) }),
        { casesTried: 5, attemptsByStation: { 'st-1': 20 } },
        FIVE,
      ),
    })
    const trial = (await body()).trial
    expect(trial.state).toBe('trial')
    expect(trial.reason).toBeNull()
  })

  it('reports daysLeft as null while the clock has not started', async () => {
    // The five days run from the first consultation, and the panel renders this
    // null as "your five days start with your first consultation".
    signedIn({ trial: computeTrialAccess(grant(), NO_USAGE, FIVE) })
    const trial = (await body()).trial
    expect(trial.daysLeft).toBeNull()
    expect(trial.startedAt).toBeNull()
    expect(trial.expiresAt).toBeNull()
  })

  it('rounds daysLeft up, so an afternoon is never zero days', async () => {
    const startedAt = new Date(Date.now() - 4.7 * DAY)
    signedIn({
      trial: computeTrialAccess(
        grant({ startedAt, expiresAt: new Date(startedAt.getTime() + 5 * DAY) }),
        NO_USAGE,
        FIVE,
      ),
    })
    expect((await body()).trial.daysLeft).toBe(1)
  })

  it('floors daysLeft at zero once the window has closed', async () => {
    const startedAt = new Date(Date.now() - 6 * DAY)
    signedIn({
      trial: computeTrialAccess(
        grant({ startedAt, expiresAt: new Date(startedAt.getTime() + 5 * DAY) }),
        NO_USAGE,
        FIVE,
      ),
      allowed: false,
      trialOnly: false,
    })
    const trial = (await body()).trial
    expect(trial.state).toBe('trial_ended')
    expect(trial.daysLeft).toBe(0)
    expect(trial.reason).toBe('expiry')
  })

  it('reports an empty allowlist as empty, not as "no limit"', async () => {
    // FAIL CLOSED reaches the client intact. The library reads an empty list as
    // "everything is locked", which is what the server is enforcing.
    signedIn({ trial: computeTrialAccess(grant(), NO_USAGE, []) })
    expect((await body()).trial.freeStationIds).toEqual([])
  })

  it('resolves the exam hint for a LIVE trial, not only at the wall', async () => {
    // The two-plan offer moved forward onto the dashboard, so the date it turns
    // on has to be known from day one.
    getSupabaseAdmin.mockReturnValue(stubLeads('oct_2026'))
    signedIn({ trial: computeTrialAccess(grant(), NO_USAGE, FIVE) })
    expect((await body()).trial.examHint).toBe('2026-10-15')
  })

  it('tells a buyer nothing about a trial they are not using', async () => {
    // Drawing a countdown over a plan somebody paid for would be a lie about
    // what they own.
    signedIn({
      trial: computeTrialAccess(grant(), NO_USAGE, FIVE),
      entitlement: { state: 'active', plan: 'self_study', hasLectures: false },
      allowed: true,
      trialOnly: false,
    })
    const response = await body()
    expect(response.trial).toBeNull()
    expect(response.plan).toBe('self_study')
  })

  it('is null for an account that never had a grant', async () => {
    signedIn({ trial: NO_TRIAL, allowed: false })
    expect((await body()).trial).toBeNull()
  })
})
