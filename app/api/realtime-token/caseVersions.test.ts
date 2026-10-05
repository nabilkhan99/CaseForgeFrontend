import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { NO_TRIAL } from '@/lib/commerce/trialAccess'
import { fakeDb, type FakeDb } from '@/lib/stations/caseVersionsFakeDb'

/**
 * The version rule at the endpoint that spends.
 *
 * This used to load the station with `.in('is_active', visible)`, which would
 * 404 a keeper re-running the archived case they keep and let anyone mint any
 * live case. It now asks the version rule, before the mint, every time. And it
 * refuses a body station that is not the session row's station: every check
 * here reads the body's id, so without that a row for one case could be minted
 * against any other (the guest lane has always refused this).
 */

const getServerEntitlement = vi.fn()
const mintEphemeralKey = vi.fn()
let db: FakeDb

vi.mock('@/lib/commerce/serverEntitlement', () => ({
  getServerEntitlement: () => getServerEntitlement(),
}))
vi.mock('@/lib/supabase/admin', () => ({
  getSupabaseAdmin: () => db.client,
}))
vi.mock('@/lib/commerce/trialAccess', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/commerce/trialAccess')>()),
  countOpenTrialSessions: async () => 0,
  startTrialWindowFor: async () => undefined,
}))
vi.mock('@/lib/clinical-master/realtimeToken', () => ({
  mintEphemeralKey: (...args: unknown[]) => mintEphemeralKey(...args),
  unreliableEchoCancellation: () => false,
}))

const { POST } = await import('./route')

const ORIGINAL_ADMIN_EMAILS = process.env.ADMIN_EMAILS
afterAll(() => {
  process.env.ADMIN_EMAILS = ORIGINAL_ADMIN_EMAILS
})

const station = (id: string, lifecycle: string, replaces: string | null = null) => ({
  id,
  lifecycle,
  replaces_station_id: replaces,
  consultation_duration_seconds: 720,
  voice_gender: 'female',
})

const STATIONS = [
  station('PLAIN', 'live'),
  station('OLD', 'archived'),
  station('NEW', 'live', 'OLD'),
  station('DRAFT', 'draft'),
]

function signedIn(email = 'gp@example.com', userId = 'user-1') {
  getServerEntitlement.mockResolvedValue({
    supabase: {},
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

/** A `reading` row for `rowStation`, owned by `userId`. */
function sessionRow(rowStation: string, userId = 'user-1') {
  db.tables.clinical_sessions = [{ id: 'sess-1', user_id: userId, status: 'reading', station_id: rowStation }]
}

async function mint(stationId: string) {
  const res = await POST({
    json: async () => ({ sessionId: 'sess-1', stationId }),
    headers: { get: () => null },
  } as never)
  return { status: res.status, body: await res.json() }
}

beforeEach(() => {
  vi.clearAllMocks()
  process.env.ADMIN_EMAILS = 'boss@example.com'
  mintEphemeralKey.mockResolvedValue({ key: 'ek_test', origin: 'primary', lane: 'lane-a' })
  db = fakeDb({
    stations: STATIONS,
    case_keepers: [{ user_id: 'keeper', station_id: 'OLD' }],
    clinical_sessions: [],
  })
  signedIn()
})

describe('the realtime mint and the case-version rule', () => {
  it('mints a live case that replaces nothing (every case, today)', async () => {
    sessionRow('PLAIN')
    expect((await mint('PLAIN')).status).toBe(200)
    expect(mintEphemeralKey).toHaveBeenCalledTimes(1)
    // Today's bank costs no keeper read at the endpoint that spends.
    expect(db.reads).not.toContain('case_keepers')
  })

  it('refuses a keeper the replacement, before minting', async () => {
    signedIn('keeper@example.com', 'keeper')
    sessionRow('NEW', 'keeper')
    const { status, body } = await mint('NEW')
    expect(status).toBe(403)
    expect(body).toMatchObject({ code: 'case_version_refused', reason: 'replaced_for_keeper', redirectStationId: 'OLD' })
    expect(mintEphemeralKey).not.toHaveBeenCalled()
  })

  it('mints the replacement for a non-keeper', async () => {
    sessionRow('NEW')
    expect((await mint('NEW')).status).toBe(200)
  })

  it('mints a keeper\'s re-run of the archived case they keep', async () => {
    // The case an `is_active` filter used to 404.
    signedIn('keeper@example.com', 'keeper')
    sessionRow('OLD', 'keeper')
    const { status, body } = await mint('OLD')
    expect(status).toBe(200)
    expect(body).toMatchObject({ key: 'ek_test', durationSeconds: 720 })
    expect(mintEphemeralKey.mock.calls[0][0]).toMatchObject({ id: 'OLD' })
  })

  it('refuses an archived case to a non-keeper, even on a row that predates the switch', async () => {
    sessionRow('OLD')
    const { status, body } = await mint('OLD')
    expect(status).toBe(403)
    expect(body).toMatchObject({
      error: 'This case has been replaced by a newer version in your library.',
      code: 'case_version_refused',
      redirectStationId: 'NEW',
    })
    expect(mintEphemeralKey).not.toHaveBeenCalled()
    expect(db.updates).toHaveLength(0)
  })

  it('refuses a draft to a non-admin', async () => {
    sessionRow('DRAFT')
    const { status, body } = await mint('DRAFT')
    expect(status).toBe(403)
    expect(body).toMatchObject({ code: 'case_version_refused', reason: 'draft' })
    expect(mintEphemeralKey).not.toHaveBeenCalled()
  })

  it('mints a draft for an ADMIN_EMAILS admin, so a case can be tried before approval', async () => {
    signedIn('boss@example.com', 'admin')
    sessionRow('DRAFT', 'admin')
    expect((await mint('DRAFT')).status).toBe(200)
  })

  it('404s an id that names no case', async () => {
    expect((await mint('no-such-case')).status).toBe(404)
    expect(mintEphemeralKey).not.toHaveBeenCalled()
    expect(db.inserts).toHaveLength(0)
  })
})

describe('the body station is the session row\'s station', () => {
  it('refuses a mint for a different case than the row was opened on', async () => {
    // Both cases are open to this person: the refusal is about the row, not
    // the case. The consultation would otherwise be marked on the row's case.
    sessionRow('PLAIN')
    const { status, body } = await mint('NEW')
    expect(status).toBe(403)
    expect(body).toEqual({
      error: 'That consultation is for a different case. Start a new one.',
      code: 'station_mismatch',
    })
    expect(mintEphemeralKey).not.toHaveBeenCalled()
    expect(db.updates).toHaveLength(0)
  })

  it('still mints when the ids agree', async () => {
    sessionRow('NEW')
    expect((await mint('NEW')).status).toBe(200)
  })

  it('still opens a row of its own for a client that skipped create-session', async () => {
    // No row, so nothing to disagree with: the insert names the body's case,
    // which has just passed every check.
    expect((await mint('PLAIN')).status).toBe(200)
    expect(db.inserts).toEqual([
      { table: 'clinical_sessions', row: expect.objectContaining({ station_id: 'PLAIN', status: 'live' }) },
    ])
  })

  it('is somebody else\'s session before it is a mismatched one', async () => {
    sessionRow('PLAIN', 'someone-else')
    const { status, body } = await mint('NEW')
    expect(status).toBe(403)
    expect(body).toEqual({ error: 'Forbidden' })
  })
})
