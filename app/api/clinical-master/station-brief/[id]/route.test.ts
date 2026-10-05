import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { fakeDb, type FakeDb } from '@/lib/stations/caseVersionsFakeDb'

/**
 * The brief page's fallback read: the versions of a case the browser's own
 * read (under RLS) cannot see. Admins may open drafts; keepers their archived
 * case; anyone else asking for the wrong version is pointed at the one they do
 * see; a draft is a 404 to everyone but admins, indistinguishable from an id
 * that names nothing.
 */

const getUser = vi.fn()
let bank: FakeDb

vi.mock('server-only', () => ({}))
vi.mock('@/lib/supabase/server', () => ({
  createClient: async () => ({ auth: { getUser: () => getUser() } }),
}))
vi.mock('@/lib/supabase/admin', () => ({
  getSupabaseAdmin: () => bank.client,
}))

const { GET } = await import('./route')

const ORIGINAL_ADMIN_EMAILS = process.env.ADMIN_EMAILS
afterAll(() => {
  process.env.ADMIN_EMAILS = ORIGINAL_ADMIN_EMAILS
})

const id = (n: number) => `00000000-0000-4000-8000-00000000000${n}`
const PLAIN = id(1)
const OLD = id(2)
const NEW = id(3)
const GONE = id(4)
const DRAFT = id(5)
const UNKNOWN = id(9)

function row(stationId: string, lifecycle: string, replaces: string | null = null) {
  return {
    id: stationId,
    title: `Case ${stationId.slice(-1)}`,
    patient_name: 'Sam Patel',
    candidate_instructions: 'Read the notes.',
    domain_id: 'dom-1',
    reading_duration_seconds: null,
    consultation_duration_seconds: 600,
    lifecycle,
    replaces_station_id: replaces,
  }
}

// PLAIN: today's shape. OLD → NEW: a switched pair. GONE: archived, its
// replacement not live. DRAFT: unreleased.
const STATIONS = [
  row(PLAIN, 'live'),
  row(OLD, 'archived'),
  row(NEW, 'live', OLD),
  row(GONE, 'archived'),
  row(DRAFT, 'draft'),
]

function signedIn(email = 'gp@example.com', userId = 'user-1') {
  getUser.mockResolvedValue({ data: { user: { id: userId, email } } })
}

async function brief(stationId: string) {
  const res = await GET({} as never, { params: Promise.resolve({ id: stationId }) })
  return { status: res.status, body: await res.json() }
}

beforeEach(() => {
  vi.clearAllMocks()
  vi.spyOn(console, 'error').mockImplementation(() => {})
  process.env.ADMIN_EMAILS = 'boss@example.com'
  bank = fakeDb({
    stations: STATIONS,
    domains: [{ id: 'dom-1', name: 'Older adults' }],
    case_keepers: [{ user_id: 'keeper', station_id: OLD }],
  })
  signedIn()
})

describe('GET /api/clinical-master/station-brief/[id]', () => {
  it('refuses a signed-out caller without reading a station', async () => {
    getUser.mockResolvedValue({ data: { user: null } })
    expect(await brief(PLAIN)).toEqual({ status: 401, body: { error: 'Unauthorized' } })
    expect(bank.reads).toEqual([])
  })

  it('returns exactly what the brief page renders, with its defaults (a live case, today)', async () => {
    expect(await brief(PLAIN)).toEqual({
      status: 200,
      body: {
        station: {
          id: PLAIN,
          title: 'Case 1',
          patient_name: 'Sam Patel',
          candidate_instructions: 'Read the notes.',
          reading_duration_seconds: 180,
          consultation_duration_seconds: 600,
          domain_name: 'Older adults',
        },
      },
    })
    expect(bank.reads).not.toContain('case_keepers')
  })

  it('opens a draft to an admin', async () => {
    signedIn('Boss@Example.com', 'admin')
    const { status, body } = await brief(DRAFT)
    expect(status).toBe(200)
    expect(body.station.id).toBe(DRAFT)
  })

  it('answers a draft to a non-admin exactly as an unknown id', async () => {
    const draft = await brief(DRAFT)
    const unknown = await brief(UNKNOWN)
    expect(draft).toEqual({ status: 404, body: { error: 'Station not found', code: 'station_not_found' } })
    expect(unknown).toEqual(draft)
    expect(bank.reads).not.toContain('domains')
  })

  it('answers 503 try-again when the keeper read fails', async () => {
    signedIn('keeper@example.com', 'keeper')
    bank.failing.add('case_keepers')
    const { status, body } = await brief(OLD)
    expect(status).toBe(503)
    expect(body).toMatchObject({ code: 'case_version_unavailable' })
  })

  it('opens an archived case to its keeper', async () => {
    signedIn('keeper@example.com', 'keeper')
    const { status, body } = await brief(OLD)
    expect(status).toBe(200)
    expect(body.station.id).toBe(OLD)
  })

  it('forwards a non-keeper asking for an archived case to its live replacement', async () => {
    expect(await brief(OLD)).toEqual({
      status: 403,
      body: {
        error: 'This case has been replaced by a newer version in your library.',
        code: 'case_version_refused',
        reason: 'archived_not_kept',
        redirectStationId: NEW,
      },
    })
  })

  it('gives a non-keeper the refusal sentence when the archived case has no live replacement', async () => {
    const { status, body } = await brief(GONE)
    expect(status).toBe(403)
    expect(body).toMatchObject({ code: 'case_version_refused', reason: 'archived_not_kept' })
    expect(body.error).toBe('This case has been replaced by a newer version in your library.')
    expect(body).not.toHaveProperty('redirectStationId')
  })

  it('forwards a keeper asking for the replacement back to the case they keep', async () => {
    signedIn('keeper@example.com', 'keeper')
    const { status, body } = await brief(NEW)
    expect(status).toBe(403)
    expect(body).toMatchObject({ reason: 'replaced_for_keeper', redirectStationId: OLD })
  })

  it('opens the replacement to everyone else', async () => {
    const { status, body } = await brief(NEW)
    expect(status).toBe(200)
    expect(body.station.id).toBe(NEW)
  })

  it('404s an id that is not a uuid without querying', async () => {
    expect((await brief('not-a-uuid')).status).toBe(404)
    expect(bank.reads).toEqual([])
  })

  it('reports a failed station read as a 500, never as not-found', async () => {
    bank.failing.add('stations')
    expect((await brief(PLAIN)).status).toBe(500)
  })

  it('falls back to the default domain label when the domain read fails', async () => {
    bank.failing.add('domains')
    const { status, body } = await brief(PLAIN)
    expect(status).toBe(200)
    expect(body.station.domain_name).toBe('General Practice')
  })
})
