import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { fakeDb, type FakeDb } from './caseVersionsFakeDb'

/**
 * Trial and cohort allowlists at the two doors, read per person by SLOT
 * (lib/stations/caseVersionsAllowlist.ts), end to end: the real
 * getServerEntitlement, the real trial loader and the real routes, against one
 * in-memory bank.
 *
 * Once a case on a list is replaced:
 *  - a keeper of the old case can run it whether the list names the old case
 *    or its replacement, and is still forwarded away from the replacement;
 *  - everyone else can run the replacement whether the list names it or the
 *    old case;
 *  - nothing off the list opens.
 * Today (everything live, nothing replaced) the lists behave exactly as written.
 */

let db: FakeDb
const mintEphemeralKey = vi.fn()

const auth = vi.hoisted(() => ({ user: { id: 'user-1', email: 'gp@example.com' } as { id: string; email: string } }))

vi.mock('server-only', () => ({}))
vi.mock('@/lib/supabase/server', () => ({
  createClient: async () => ({
    ...(db.client as object),
    auth: { getUser: async () => ({ data: { user: auth.user } }) },
  }),
}))
vi.mock('@/lib/supabase/admin', () => ({ getSupabaseAdmin: () => db.client }))
vi.mock('@/lib/commerce/trialAccess', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/commerce/trialAccess')>()),
  countOpenTrialSessions: async () => 0,
  startTrialWindowFor: async () => undefined,
}))
vi.mock('@/lib/clinical-master/realtimeToken', () => ({
  mintEphemeralKey: (...args: unknown[]) => mintEphemeralKey(...args),
  unreliableEchoCancellation: () => false,
}))

const createSession = (await import('@/app/api/clinical-master/create-session/route')).POST
const realtimeToken = (await import('@/app/api/realtime-token/route')).POST

const ORIGINAL_ADMIN_EMAILS = process.env.ADMIN_EMAILS
afterAll(() => {
  process.env.ADMIN_EMAILS = ORIGINAL_ADMIN_EMAILS
})

const DAY = 86_400_000

function station(id: string, lifecycle: string, over: Record<string, unknown> = {}) {
  return {
    id,
    title: id,
    lifecycle,
    is_active: lifecycle === 'live',
    replaces_station_id: null,
    is_free_trial: false,
    free_trial_order: null,
    consultation_duration_seconds: 720,
    voice_gender: 'female',
    ...over,
  }
}

/**
 * PLAIN1/PLAIN2: today's shape. OLD → NEW: a switched pair. OTHER: a live case
 * on nobody's list. `flag` says which version of the OLD/NEW slot carries the
 * trial flag (and which id the cohort was assigned).
 */
function bank(flag: 'OLD' | 'NEW' | 'none', who: 'trial' | 'cohort') {
  const flagged = (id: string) =>
    who === 'trial' && (id === flag || id === 'PLAIN1') ? { is_free_trial: true, free_trial_order: id === 'PLAIN1' ? 1 : 2 } : {}
  const assigned = ['PLAIN1', ...(flag === 'none' ? [] : [flag])]
  db = fakeDb({
    stations: [
      station('PLAIN1', 'live', flagged('PLAIN1')),
      station('OLD', 'archived', flagged('OLD')),
      station('NEW', 'live', { replaces_station_id: 'OLD', ...flagged('NEW') }),
      station('OTHER', 'live'),
    ],
    case_keepers: [{ user_id: 'keeper', station_id: 'OLD' }],
    preorders: [],
    trial_grants:
      who === 'trial'
        ? ['user-1', 'keeper'].map((userId) => ({
            id: `grant-${userId}`,
            user_id: userId,
            email: `${userId}@example.com`,
            allowance: 5,
            window_days: 5,
            source: 'signup',
            started_at: new Date(Date.now() - DAY).toISOString(),
            expires_at: new Date(Date.now() + 4 * DAY).toISOString(),
            created_at: new Date(Date.now() - 2 * DAY).toISOString(),
          }))
        : [],
    cohort_members:
      who === 'cohort'
        ? ['user-1', 'keeper'].map((userId) => ({
            user_id: userId,
            cohorts: { id: 'c-1', station_ids: assigned, trainer_email: 'trainer@example.com' },
          }))
        : [],
    clinical_sessions: [],
  })
}

function as(userId: 'user-1' | 'keeper') {
  auth.user = { id: userId, email: `${userId}@example.com` }
}

async function start(stationId: string) {
  const res = await createSession({ json: async () => ({ sessionId: 'sess-1', stationId }) } as never)
  return { status: res.status, body: await res.json() }
}

async function mint(stationId: string) {
  const res = await realtimeToken({
    json: async () => ({ sessionId: 'sess-1', stationId }),
    headers: { get: () => null },
  } as never)
  return { status: res.status, body: await res.json() }
}

beforeEach(() => {
  vi.clearAllMocks()
  vi.spyOn(console, 'error').mockImplementation(() => {})
  process.env.ADMIN_EMAILS = 'boss@example.com'
  mintEphemeralKey.mockResolvedValue({ key: 'ek_test', origin: 'primary', lane: 'lane-a' })
  as('user-1')
})

describe.each(['trial', 'cohort'] as const)('a %s allowlist at create-session and realtime-token', (who) => {
  const locked = who === 'trial' ? 'trial_station_locked' : 'not_in_cohort'

  it('behaves exactly as written for today\'s bank', async () => {
    bank('none', who)
    expect((await start('PLAIN1')).status).toBe(200)
    expect((await mint('PLAIN1')).status).toBe(200)
    expect((await start('OTHER')).body.error).toBe(locked)
    expect((await mint('OTHER')).body.error).toBe(locked)
    expect(db.reads).not.toContain('case_keepers')
  })

  it('opens the replacement to a non-keeper when the list names the old case', async () => {
    bank('OLD', who)
    expect((await start('NEW')).status).toBe(200)
    expect((await mint('NEW')).status).toBe(200)
  })

  it('still forwards a non-keeper away from the old case the list names', async () => {
    bank('OLD', who)
    const { status, body } = await start('OLD')
    expect(status).toBe(403)
    expect(body).toMatchObject({ code: 'case_version_refused', redirectStationId: 'NEW' })
  })

  it('lets a keeper run their kept old case when the list names it', async () => {
    bank('OLD', who)
    as('keeper')
    expect((await start('OLD')).status).toBe(200)
    expect((await mint('OLD')).status).toBe(200)
  })

  it('lets a keeper run their kept old case when the list names its replacement', async () => {
    bank('NEW', who)
    as('keeper')
    expect((await start('OLD')).status).toBe(200)
    expect((await mint('OLD')).status).toBe(200)
  })

  it('still forwards a keeper away from the replacement the list names', async () => {
    bank('NEW', who)
    as('keeper')
    const { status, body } = await start('NEW')
    expect(status).toBe(403)
    expect(body).toMatchObject({ code: 'case_version_refused', redirectStationId: 'OLD' })
  })

  it('opens nothing off the list', async () => {
    bank('OLD', who)
    expect((await start('OTHER')).body.error).toBe(locked)
    expect((await mint('OTHER')).body.error).toBe(locked)
  })
})

describe('the trial picture after a replacement', () => {
  it('still counts the slot once, whichever version this person runs', async () => {
    const { getServerEntitlement } = await import('@/lib/commerce/serverEntitlement')
    bank('OLD', 'trial')
    const nonKeeper = await getServerEntitlement()
    expect(nonKeeper.trial?.freeStationIds).toEqual(['PLAIN1', 'OLD', 'NEW'])
    expect(nonKeeper.trial?.allowance).toBe(2)

    as('keeper')
    const keeper = await getServerEntitlement()
    expect(keeper.trial?.freeStationIds).toEqual(['PLAIN1', 'OLD'])
    expect(keeper.trial?.allowance).toBe(2)
  })
})
