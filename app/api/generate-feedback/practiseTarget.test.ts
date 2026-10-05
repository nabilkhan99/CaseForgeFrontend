import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { fakeDb, type FakeDb } from '@/lib/stations/caseVersionsFakeDb'

/**
 * Where "Retry this case" / "Practise this case again" goes.
 *
 * The report always describes the case that was sat — `feedback.station_id`
 * never moves, so further reading and the title stay right. Only the link
 * onward follows the version rule: once a case is archived, a keeper goes back
 * to the old case they keep and everyone else to the replacement. Today every
 * case is live and replaces nothing, so it is always the case itself.
 */

const mocks = vi.hoisted(() => ({ getUser: vi.fn() }))
let db: FakeDb

vi.mock('server-only', () => ({}))
vi.mock('@/lib/supabase/server', () => ({
  createClient: async () => ({ auth: { getUser: mocks.getUser } }),
}))
vi.mock('@/lib/trainer/guard', () => ({ getTrainerCohort: async () => null }))
vi.mock('@/lib/clinical-master/triggerMarking', () => ({
  triggerMarking: async () => ({ triggered: false }),
}))
vi.mock('@/lib/supabase/admin', () => ({ getSupabaseAdmin: () => db.client }))

const { POST } = await import('./route')

const ORIGINAL_ADMIN_EMAILS = process.env.ADMIN_EMAILS
afterAll(() => {
  process.env.ADMIN_EMAILS = ORIGINAL_ADMIN_EMAILS
})

const STATIONS = [
  { id: 'PLAIN', lifecycle: 'live', replaces_station_id: null },
  { id: 'OLD', lifecycle: 'archived', replaces_station_id: null },
  { id: 'NEW', lifecycle: 'live', replaces_station_id: 'OLD' },
]

const RESULT = {
  session_id: 'sess-1',
  verdict: 'Pass',
  weighted_score: 7,
  max_score: 10.5,
  one_line_summary: '',
  tier3_override_applied: false,
  domains: [],
  timing: null,
  focus_areas: [],
  capability_links: [],
  confidence: null,
}

/**
 * One session by `userId` on `stationId`, with the join the route reads
 * embedded (the fake ignores the select list), marked or not.
 */
function bank(stationId: string, userId: string, opts: { marked?: boolean; status?: string } = {}) {
  const joined = STATIONS.find((s) => s.id === stationId)!
  db = fakeDb({
    stations: STATIONS,
    case_keepers: [{ user_id: 'keeper', station_id: 'OLD' }],
    session_results: opts.marked === false ? [] : [RESULT],
    clinical_sessions: [
      {
        id: 'sess-1',
        user_id: userId,
        station_id: stationId,
        status: opts.status ?? 'completed',
        transcript: opts.marked === false ? [] : [{ speaker: 'candidate', text: 'Hello', start_ms: 0 }],
        started_at: new Date().toISOString(),
        completed_at: null,
        stations: { title: 'A case', ...joined },
      },
    ],
  })
}

function as(userId: string, email = `${userId}@example.com`) {
  mocks.getUser.mockResolvedValue({ data: { user: { id: userId, email } } })
}

async function report() {
  const res = await POST({ json: async () => ({ sessionId: 'sess-1', trigger: false }) } as never)
  return res.json()
}

beforeEach(() => {
  vi.spyOn(console, 'error').mockImplementation(() => {})
  process.env.MARKING_API_URL = 'https://marking.example'
  process.env.MARKING_SHARED_SECRET = 'shh'
  process.env.ADMIN_EMAILS = 'boss@example.com'
})

describe('the practise target on a marked report', () => {
  it('is the case itself for a live case that replaces nothing, at no extra read', async () => {
    bank('PLAIN', 'user-1')
    as('user-1')
    const body = await report()
    expect(body.status).toBe('ready')
    expect(body.practiseStationId).toBe('PLAIN')
    expect(body.feedback.station_id).toBe('PLAIN')
    expect(db.reads).not.toContain('case_keepers')
  })

  it('stays on the old case for its keeper', async () => {
    bank('OLD', 'keeper')
    as('keeper')
    expect((await report()).practiseStationId).toBe('OLD')
  })

  it('moves to the replacement for someone who sat the old case but does not keep it', async () => {
    // e.g. a consultation that was never marked before switch-on.
    bank('OLD', 'user-1')
    as('user-1')
    const body = await report()
    expect(body.practiseStationId).toBe('NEW')
    // The report itself still describes the case that was sat.
    expect(body.feedback.station_id).toBe('OLD')
  })

  it('stays on the old case for an admin reading the report', async () => {
    bank('OLD', 'user-1')
    as('admin', 'boss@example.com')
    expect((await report()).practiseStationId).toBe('OLD')
  })
})

describe('the practise target on a report that never came', () => {
  it('rides along with no_transcript', async () => {
    bank('OLD', 'user-1', { marked: false, status: 'abandoned' })
    as('user-1')
    const body = await report()
    expect(body).toMatchObject({ status: 'no_transcript', stationId: 'OLD', practiseStationId: 'NEW' })
  })

  it('is not computed while a consultation is still being polled', async () => {
    bank('OLD', 'user-1', { marked: false, status: 'live' })
    as('user-1')
    const body = await report()
    expect(body.status).toBe('generating')
    expect(body).not.toHaveProperty('practiseStationId')
    expect(db.reads).not.toContain('case_keepers')
  })
})
