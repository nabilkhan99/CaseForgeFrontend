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

vi.mock('@/lib/commerce/serverEntitlement', () => ({
  getServerEntitlement: () => getServerEntitlement(),
}))
vi.mock('@/lib/supabase/admin', () => ({
  getSupabaseAdmin: () => getSupabaseAdmin(),
}))
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
