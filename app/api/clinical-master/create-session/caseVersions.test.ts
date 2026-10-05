import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { NO_TRIAL } from '@/lib/commerce/trialAccess'
import { fakeDb, type FakeDb } from '@/lib/stations/caseVersionsFakeDb'

/**
 * Which VERSION of a case a session may be opened on.
 *
 * Once a batch of cases is replaced, the keeper of an old case runs the old
 * case and never its replacement, everyone else runs the replacement, and
 * drafts are admins only. The library and brief only show the right version;
 * this is where it holds, because the station id arrives in the request body.
 * It runs AFTER the plan, cohort and trial checks (trialGating.test.ts) and
 * never in place of them, and it 404s an id that names no case at all.
 */

const getServerEntitlement = vi.fn()
let bank: FakeDb

vi.mock('@/lib/commerce/serverEntitlement', () => ({
  getServerEntitlement: () => getServerEntitlement(),
}))
vi.mock('@/lib/supabase/admin', () => ({
  getSupabaseAdmin: () => bank.client,
}))
vi.mock('@/lib/commerce/trialAccess', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/commerce/trialAccess')>()),
  startTrialWindowFor: async () => undefined,
}))

const { POST } = await import('./route')

const ORIGINAL_ADMIN_EMAILS = process.env.ADMIN_EMAILS
afterAll(() => {
  process.env.ADMIN_EMAILS = ORIGINAL_ADMIN_EMAILS
})

// PLAIN: today's shape. OLD → NEW: a switched pair. GONE: archived, its
// replacement not live. DRAFT: unreleased.
const STATIONS = [
  { id: 'PLAIN', lifecycle: 'live', replaces_station_id: null },
  { id: 'OLD', lifecycle: 'archived', replaces_station_id: null },
  { id: 'NEW', lifecycle: 'live', replaces_station_id: 'OLD' },
  { id: 'GONE', lifecycle: 'archived', replaces_station_id: null },
  { id: 'DRAFT', lifecycle: 'draft', replaces_station_id: null },
]

/** The user-scoped client: an empty clinical_sessions the route inserts into. */
let sessions: FakeDb

function signedIn(email = 'gp@example.com', userId = 'user-1') {
  getServerEntitlement.mockResolvedValue({
    supabase: sessions.client,
    user: { id: userId, email },
    entitlement: { state: 'active', hasLectures: false },
    bypass: false,
    cohort: null,
    cohortOnly: false,
    trial: NO_TRIAL,
    trialOnly: false,
    failedOpen: false,
    allowed: true,
  })
}

async function start(stationId: string) {
  const res = await POST({ json: async () => ({ sessionId: 'sess-1', stationId }) } as never)
  return { status: res.status, body: await res.json() }
}

beforeEach(() => {
  vi.clearAllMocks()
  vi.spyOn(console, 'error').mockImplementation(() => {})
  process.env.ADMIN_EMAILS = 'boss@example.com'
  bank = fakeDb({ stations: STATIONS, case_keepers: [{ user_id: 'keeper', station_id: 'OLD' }] })
  sessions = fakeDb({ clinical_sessions: [] })
  signedIn()
})

describe('create-session and the case-version rule', () => {
  it('opens a live case that replaces nothing (every case, today)', async () => {
    expect(await start('PLAIN')).toEqual({ status: 200, body: { status: 'created', sessionId: 'sess-1' } })
    expect(sessions.inserts).toHaveLength(1)
  })

  it('refuses a keeper the replacement, forwarding to the case they keep', async () => {
    signedIn('keeper@example.com', 'keeper')
    const { status, body } = await start('NEW')
    expect(status).toBe(403)
    expect(body).toEqual({
      error: 'You have the earlier version of this case in your library.',
      code: 'case_version_refused',
      reason: 'replaced_for_keeper',
      redirectStationId: 'OLD',
    })
    expect(sessions.inserts).toHaveLength(0)
  })

  it('opens the replacement for a non-keeper', async () => {
    expect((await start('NEW')).status).toBe(200)
  })

  it('lets a keeper re-run the archived case they keep', async () => {
    signedIn('keeper@example.com', 'keeper')
    expect((await start('OLD')).status).toBe(200)
    expect(sessions.inserts[0].row).toMatchObject({ station_id: 'OLD', user_id: 'keeper' })
  })

  it('refuses an archived case to a non-keeper, forwarding to its replacement', async () => {
    const { status, body } = await start('OLD')
    expect(status).toBe(403)
    expect(body).toMatchObject({ code: 'case_version_refused', reason: 'archived_not_kept', redirectStationId: 'NEW' })
    expect(sessions.inserts).toHaveLength(0)
  })

  it('refuses an archived case with no live replacement, with the sentence and no forward', async () => {
    const { status, body } = await start('GONE')
    expect(status).toBe(403)
    expect(body.error).toBe('This case has been replaced by a newer version in your library.')
    expect(body).not.toHaveProperty('redirectStationId')
  })

  it('refuses a draft to a non-admin', async () => {
    const { status, body } = await start('DRAFT')
    expect(status).toBe(403)
    expect(body).toMatchObject({ code: 'case_version_refused', reason: 'draft', error: 'This case is not available yet.' })
    expect(sessions.inserts).toHaveLength(0)
  })

  it('opens a draft to an ADMIN_EMAILS admin', async () => {
    signedIn('Boss@Example.com', 'admin')
    expect((await start('DRAFT')).status).toBe(200)
  })

  it('404s an id that names no case, instead of inserting a row for it', async () => {
    const { status, body } = await start('no-such-case')
    expect(status).toBe(404)
    expect(body).toMatchObject({ code: 'station_not_found' })
    expect(sessions.inserts).toHaveLength(0)
  })

  it('answers a failed station read with a 500, never a row', async () => {
    bank.failing.add('stations')
    expect((await start('PLAIN')).status).toBe(500)
    expect(sessions.inserts).toHaveLength(0)
  })

  it('still answers no_active_plan first: the version rule never replaces the plan check', async () => {
    getServerEntitlement.mockResolvedValue({
      supabase: sessions.client,
      user: { id: 'user-1', email: 'gp@example.com' },
      entitlement: { state: 'none', hasLectures: false },
      cohort: null,
      cohortOnly: false,
      trial: NO_TRIAL,
      trialOnly: false,
      allowed: false,
    })
    const { status, body } = await start('DRAFT')
    expect(status).toBe(403)
    expect(body).toMatchObject({ error: 'no_active_plan' })
    expect(bank.reads).toEqual([])
  })
})
