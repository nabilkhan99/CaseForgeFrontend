import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { fakeDb, type FakeDb } from '@/lib/stations/caseVersionsFakeDb'

/**
 * A session on a DRAFT case, read by anyone but an admin: no station text
 * (title, learning points, mark scheme) leaves the server and no marking run
 * is spent; the answer is the same 404 as a session that does not exist. An
 * admin (who is the only person who can start a draft) reads it as normal.
 */

const mocks = vi.hoisted(() => ({ getUser: vi.fn(), triggerMarking: vi.fn() }))
let db: FakeDb

vi.mock('server-only', () => ({}))
vi.mock('@/lib/supabase/server', () => ({
  createClient: async () => ({ auth: { getUser: mocks.getUser } }),
}))
vi.mock('@/lib/trainer/guard', () => ({ getTrainerCohort: async () => null }))
vi.mock('@/lib/clinical-master/triggerMarking', () => ({
  triggerMarking: (...args: unknown[]) => mocks.triggerMarking(...args),
}))
vi.mock('@/lib/supabase/admin', () => ({ getSupabaseAdmin: () => db.client }))

const { POST } = await import('./route')

const ORIGINAL_ADMIN_EMAILS = process.env.ADMIN_EMAILS
afterAll(() => {
  process.env.ADMIN_EMAILS = ORIGINAL_ADMIN_EMAILS
})

const DRAFT_STATION = {
  title: 'Unreleased case',
  clinical_learning_points: 'secret teaching',
  data_gathering: 'secret scheme',
  clinical_management: null,
  relating_to_others: null,
  lifecycle: 'draft',
  replaces_station_id: null,
}

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

/** One session on the draft, owned by `userId` (null: a guest session). */
function bank(userId: string | null, marked: boolean) {
  db = fakeDb({
    stations: [{ id: 'DRAFT', ...DRAFT_STATION }],
    case_keepers: [],
    session_results: marked ? [RESULT] : [],
    clinical_sessions: [
      {
        id: 'sess-1',
        user_id: userId,
        station_id: 'DRAFT',
        status: 'processing',
        transcript: [{ speaker: 'candidate', text: 'Hello', start_ms: 0 }],
        started_at: new Date().toISOString(),
        completed_at: null,
        stations: DRAFT_STATION,
      },
    ],
  })
}

function as(user: { id: string; email: string } | null) {
  mocks.getUser.mockResolvedValue({ data: { user } })
}

async function report() {
  const res = await POST({ json: async () => ({ sessionId: 'sess-1' }) } as never)
  return { status: res.status, body: await res.json() }
}

beforeEach(() => {
  vi.clearAllMocks()
  vi.spyOn(console, 'error').mockImplementation(() => {})
  mocks.triggerMarking.mockResolvedValue({ triggered: true })
  process.env.MARKING_API_URL = 'https://marking.example'
  process.env.MARKING_SHARED_SECRET = 'shh'
  process.env.ADMIN_EMAILS = 'boss@example.com'
})

describe('feedback on a draft case', () => {
  it('404s a marked report to a non-admin, with no station text', async () => {
    bank(null, true)
    as(null)
    const { status, body } = await report()
    expect(status).toBe(404)
    expect(JSON.stringify(body)).not.toContain('secret')
    expect(JSON.stringify(body)).not.toContain('Unreleased')
  })

  it('404s an unmarked one to a non-admin and spends no marking run', async () => {
    bank(null, false)
    as(null)
    const { status, body } = await report()
    expect(status).toBe(404)
    expect(JSON.stringify(body)).not.toContain('Unreleased')
    expect(mocks.triggerMarking).not.toHaveBeenCalled()
  })

  it('404s even the session\'s owner when they are not an admin (a case pulled back to draft)', async () => {
    bank('user-1', false)
    as({ id: 'user-1', email: 'gp@example.com' })
    expect((await report()).status).toBe(404)
    expect(mocks.triggerMarking).not.toHaveBeenCalled()
  })

  it('reads as normal for the admin who ran it, marking included', async () => {
    bank('admin', true)
    as({ id: 'admin', email: 'boss@example.com' })
    const marked = await report()
    expect(marked.status).toBe(200)
    expect(marked.body.feedback.station_title).toBe('Unreleased case')

    bank('admin', false)
    const pending = await report()
    expect(pending.body.status).toBe('generating')
    expect(mocks.triggerMarking).toHaveBeenCalledOnce()
  })
})
