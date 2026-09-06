import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NO_TRIAL, computeTrialAccess, type TrialAccess, type TrialGrant } from '@/lib/commerce/trialAccess'
import type { Entitlement } from '@/lib/commerce/entitlements'

/**
 * The refusal that costs money.
 *
 * create-session writes a row; this endpoint mints an Azure ephemeral key and
 * starts spending realtime minutes, and a session row for a sixth consultation
 * can already exist by the time it is called — created before the fifth mark
 * landed, or by a client that skipped create-session entirely. So the cap is
 * only as good as the check here, and these pin it.
 */

const getServerEntitlement = vi.fn()
const getSupabaseAdmin = vi.fn()
const mintEphemeralKey = vi.fn()
const countOpenTrialSessions = vi.fn()
const startTrialWindowFor = vi.fn()

vi.mock('@/lib/commerce/serverEntitlement', () => ({
  getServerEntitlement: () => getServerEntitlement(),
}))
vi.mock('@/lib/supabase/admin', () => ({
  getSupabaseAdmin: () => getSupabaseAdmin(),
}))
vi.mock('@/lib/commerce/trialAccess', async (importOriginal) => {
  // The refusal rules themselves stay real — only the two IO helpers are stubbed.
  const actual = await importOriginal<typeof import('@/lib/commerce/trialAccess')>()
  return {
    ...actual,
    countOpenTrialSessions: (...args: unknown[]) => countOpenTrialSessions(...args),
    startTrialWindowFor: (...args: unknown[]) => startTrialWindowFor(...args),
  }
})
vi.mock('@/lib/clinical-master/realtimeToken', () => ({
  mintEphemeralKey: (...args: unknown[]) => mintEphemeralKey(...args),
  unreliableEchoCancellation: () => false,
}))

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
    source: 'guest_reveal',
    startedAt: new Date(NOW.getTime() - DAY),
    expiresAt: new Date(NOW.getTime() + 4 * DAY),
    createdAt: new Date('2026-09-08T09:00:00Z'),
    ...over,
  }
}

/**
 * `stations` and `clinical_sessions`, both reachable through one `from`. Only
 * touched by requests that get past the entitlement gate — which is the point
 * of most of these tests.
 */
function stubAdmin() {
  const station = {
    id: 'st-1',
    consultation_duration_seconds: 720,
    voice_gender: 'female',
  }
  const stationChain = {
    select: () => stationChain,
    eq: () => stationChain,
    in: () => stationChain,
    maybeSingle: async () => ({ data: station, error: null }),
  }
  const update = vi.fn(() => ({ eq: vi.fn().mockResolvedValue({ error: null }) }))
  const insert = vi.fn().mockResolvedValue({ error: null })
  const sessionChain = {
    select: () => sessionChain,
    eq: () => sessionChain,
    maybeSingle: async () => ({ data: null }),
    update,
    insert,
  }
  return {
    from: vi.fn((table: string) => (table === 'stations' ? stationChain : sessionChain)),
    insert,
  }
}

function signedIn(opts: { trial?: TrialAccess; allowed?: boolean; entitlement?: Entitlement }) {
  getServerEntitlement.mockResolvedValue({
    supabase: {},
    user: { id: 'user-1', email: 'gp@example.com' },
    entitlement: opts.entitlement ?? { state: 'none', hasLectures: false },
    bypass: false,
    cohort: null,
    cohortOnly: false,
    trial: opts.trial ?? NO_TRIAL,
    trialOnly: opts.trial?.state === 'trial',
    failedOpen: false,
    allowed: opts.allowed ?? false,
  })
}

function request() {
  return {
    json: async () => ({ sessionId: 'sess-1', stationId: 'st-1' }),
    headers: { get: () => null },
  } as never
}

beforeEach(() => {
  vi.clearAllMocks()
  getSupabaseAdmin.mockReturnValue(stubAdmin())
  mintEphemeralKey.mockResolvedValue({ key: 'ek_test', origin: 'primary', lane: 'lane-a' })
  countOpenTrialSessions.mockResolvedValue(0)
  startTrialWindowFor.mockResolvedValue(undefined)
})

describe('the realtime mint and a spent trial', () => {
  it('refuses a sixth consultation without minting a key', async () => {
    signedIn({ trial: computeTrialAccess(grant(), 5, NOW), allowed: false })
    const res = await POST(request())
    expect(res.status).toBe(403)
    expect(await res.json()).toMatchObject({ error: 'trial_allowance_used', trial: true })
    // The whole point: no Azure minutes are spent on a refused request.
    expect(mintEphemeralKey).not.toHaveBeenCalled()
  })

  it('refuses once the five days are up, with a distinct code', async () => {
    const expired = grant({
      startedAt: new Date(NOW.getTime() - 6 * DAY),
      expiresAt: new Date(NOW.getTime() - DAY),
    })
    signedIn({ trial: computeTrialAccess(expired, 1, NOW), allowed: false })
    const res = await POST(request())
    expect(await res.json()).toMatchObject({ error: 'trial_expired', reason: 'expiry' })
    expect(mintEphemeralKey).not.toHaveBeenCalled()
  })

  it('mints for a live trial with stations left', async () => {
    signedIn({ trial: computeTrialAccess(grant(), 3, NOW), allowed: true })
    const res = await POST(request())
    expect(res.status).toBe(200)
    expect(await res.json()).toMatchObject({ key: 'ek_test', durationSeconds: 720 })
  })

  it('leaves the existing refusal alone for an account with no grant', async () => {
    signedIn({ trial: NO_TRIAL, allowed: false })
    expect(await (await POST(request())).json()).toMatchObject({ error: 'no_active_plan' })
  })

  it('mints for a buyer whose old grant is long dead', async () => {
    signedIn({
      trial: computeTrialAccess(grant(), 5, NOW),
      allowed: true,
      entitlement: { state: 'active', hasLectures: false },
    })
    expect((await POST(request())).status).toBe(200)
  })
})

describe('one consultation at a time', () => {
  /**
   * The cap is enforced from a DERIVED count of marked sessions, and a mark
   * lands ~90 seconds after a consultation that runs up to 12 minutes. For that
   * quarter of an hour a started consultation is invisible to the count, so
   * without this check N parallel mints all read the same low `used` and all
   * succeed — five stations enforced sequentially and unbounded in parallel,
   * each spending real Azure minutes.
   */
  it('refuses a second consultation while one is already running', async () => {
    signedIn({ trial: computeTrialAccess(grant(), 1, NOW), allowed: true })
    countOpenTrialSessions.mockResolvedValue(1)

    const res = await POST(request())

    expect(res.status).toBe(409)
    expect(await res.json()).toMatchObject({ error: 'trial_session_in_progress', trial: true })
    expect(mintEphemeralKey).not.toHaveBeenCalled()
  })

  it('excludes this session, so a reconnect is never refused as a second one', async () => {
    signedIn({ trial: computeTrialAccess(grant(), 1, NOW), allowed: true })
    await POST(request())
    // The browser re-mints for the SAME consultation after a dropped
    // connection; counting its own row would make every reconnect a 409.
    expect(countOpenTrialSessions.mock.calls[0][2]).toBe('sess-1')
  })

  it('does not cap somebody who has bought', async () => {
    // The cap protects a free grant from parallel abuse. A customer paid for
    // the bank and may run whatever they like.
    signedIn({
      trial: NO_TRIAL,
      allowed: true,
      entitlement: { state: 'active', hasLectures: false },
    })
    countOpenTrialSessions.mockResolvedValue(3)

    expect((await POST(request())).status).toBe(200)
    expect(countOpenTrialSessions).not.toHaveBeenCalled()
  })
})

describe('starting the five-day window', () => {
  it('stamps it here too, for a client that skipped create-session', async () => {
    // This endpoint inserts a session row of its own when it finds none, so a
    // client that only ever called it would spend Azure minutes against a grant
    // whose window never opened — and a window that never opens never ends.
    signedIn({ trial: computeTrialAccess(grant({ startedAt: null, expiresAt: null }), 0, NOW), allowed: true })

    await POST(request())

    expect(startTrialWindowFor).toHaveBeenCalledTimes(1)
    expect(startTrialWindowFor.mock.calls[0][1]).toBe(true)
  })

  it('does not stamp when the mint failed', async () => {
    // No consultation happened, so no clock should start.
    signedIn({ trial: computeTrialAccess(grant(), 0, NOW), allowed: true })
    mintEphemeralKey.mockRejectedValue(new Error('azure down'))

    expect((await POST(request())).status).toBe(500)
    expect(startTrialWindowFor).not.toHaveBeenCalled()
  })
})
