import { beforeEach, describe, expect, it, vi } from 'vitest'

/**
 * What the report's poll is told, and, just as importantly, what it is not
 * told to keep doing.
 *
 * Three of these outcomes stop the poll dead, and each stops it for a different
 * reason: the result landed, the mic captured nothing, or the Azure guard
 * refused a run too short to mark fairly. The fourth keeps polling. Getting
 * 'unmarkable' wrong in either direction is expensive: treat it as 'generating'
 * and the page spins for five minutes on a session that will never produce a
 * result; re-fire marking on it and we pay to be told the same thing again.
 *
 * On main the claim-and-fire still lives inline in the route, so "fired" is
 * observed at its three moving parts: the marking_started_at claim update, the
 * after() callback that makes the call, and fetch itself.
 */

const mocks = vi.hoisted(() => ({
  getUser: vi.fn(),
  after: vi.fn(),
  claimUpdate: vi.fn(),
  fetch: vi.fn(),
  results: null as Record<string, unknown> | null,
  session: null as Record<string, unknown> | null,
}))

vi.mock('server-only', () => ({}))

vi.mock('next/server', async (importOriginal) => ({
  ...(await importOriginal<typeof import('next/server')>()),
  after: mocks.after,
}))

vi.mock('@/lib/supabase/server', () => ({
  createClient: async () => ({ auth: { getUser: mocks.getUser } }),
}))

vi.mock('@/lib/trainer/guard', () => ({ getTrainerCohort: async () => null }))

vi.mock('@/lib/supabase/admin', () => ({
  getSupabaseAdmin: () => ({
    from: (table: string) => {
      if (table === 'session_results') {
        return {
          select: () => ({
            eq: () => ({ maybeSingle: async () => ({ data: mocks.results, error: null }) }),
          }),
        }
      }
      return {
        select: () => ({
          eq: () => ({
            single: async () => ({ data: mocks.session, error: mocks.session ? null : 'missing' }),
            maybeSingle: async () => ({ data: mocks.session, error: null }),
            is: () => ({ maybeSingle: async () => ({ data: mocks.session, error: null }) }),
          }),
        }),
        update: (patch: Record<string, unknown>) => {
          mocks.claimUpdate(patch)
          return {
            eq: () => ({
              or: () => ({
                select: () => ({
                  maybeSingle: async () => ({ data: { id: 'session-1' }, error: null }),
                }),
              }),
            }),
          }
        },
      }
    },
  }),
}))

const { POST } = await import('./route')

async function poll(trigger = true) {
  const response = await POST({
    json: async () => ({ sessionId: 'session-1', trigger }),
  } as never)
  return { status: response.status, body: await response.json() }
}

/** A short run: three candidate turns spanning 40 seconds. */
const SHORT_TRANSCRIPT = [
  { speaker: 'candidate', text: 'Hello, what can I do for you?', start_ms: 5_000 },
  { speaker: 'patient', text: 'I have a headache.', start_ms: 9_000 },
  { speaker: 'candidate', text: 'How long has that been going on?', start_ms: 22_000 },
  { speaker: 'candidate', text: 'Right, I see.', start_ms: 45_000 },
]

const sessionRow = (overrides: Record<string, unknown>) => ({
  id: 'session-1',
  status: 'unmarkable',
  transcript: SHORT_TRANSCRIPT,
  started_at: new Date().toISOString(),
  completed_at: null,
  station_id: 'station-9',
  stations: null,
  ...overrides,
})

function expectNoMarkingFired() {
  expect(mocks.claimUpdate).not.toHaveBeenCalled()
  expect(mocks.after).not.toHaveBeenCalled()
  expect(mocks.fetch).not.toHaveBeenCalled()
}

beforeEach(() => {
  vi.clearAllMocks()
  vi.spyOn(console, 'error').mockImplementation(() => {})
  vi.stubGlobal('fetch', mocks.fetch)
  process.env.MARKING_API_URL = 'https://caseforge2025a.azurewebsites.net'
  process.env.MARKING_SHARED_SECRET = 'shh'
  mocks.getUser.mockResolvedValue({ data: { user: null } })
  mocks.results = null
  mocks.session = null
})

describe('POST /api/generate-feedback: unmarkable sessions', () => {
  it('reports the run length the guard judged, and stops the poll', async () => {
    mocks.session = sessionRow({ stations: { title: 'Recurrent headaches' } })

    const { status, body } = await poll()

    expect(status).toBe(200)
    expect(body.status).toBe('unmarkable')
    // 5s to 45s across the candidate's turns. Re-derived here because the guard
    // records only the status: there is no duration stored anywhere.
    expect(body.candidateSeconds).toBe(40)
    expect(body.candidateTurns).toBe(3)
    // The station comes back so the screen can offer the way out: run it again.
    expect(body.stationId).toBe('station-9')
    expect(body.stationTitle).toBe('Recurrent headaches')
  })

  it('never re-fires marking for a session the guard already refused', async () => {
    mocks.session = sessionRow({})

    const { body } = await poll(true)

    expect(body.status).toBe('unmarkable')
    expect(body.triggerQueued).toBe(false)
    expectNoMarkingFired()
  })

  it('calls an unmarkable session with no transcript "not recorded" instead', async () => {
    // A mic that captured nothing and a consultation that was too short are
    // different facts with different copy. The empty case is checked first.
    mocks.session = sessionRow({ transcript: [] })

    expect((await poll()).body.status).toBe('no_transcript')
    expectNoMarkingFired()
  })

  it('returns an existing result rather than the status', async () => {
    // Ordering guard: a result row wins over anything the session status says,
    // so a session that was marked can never be reported as unmarkable.
    mocks.results = {
      verdict: 'Bare Fail',
      weighted_score: 5.5,
      max_score: 10.5,
      one_line_summary: 'Solid history, management fell short.',
      domains: [],
      focus_areas: [],
    }
    mocks.session = { station_id: 'station-9', transcript: [], stations: null }

    const { body } = await poll()

    expect(body.status).toBe('ready')
    expect(body.feedback.overall.verdict).toBe('Bare Fail')
    expectNoMarkingFired()
  })

  it('keeps polling, and starts a run, for a session still being marked', async () => {
    // The control for the tests above: proves this harness does see a trigger
    // when one happens, so "not called" there means something.
    mocks.session = sessionRow({ status: 'processing' })

    const { body } = await poll(true)

    expect(body.status).toBe('generating')
    expect(body.triggerQueued).toBe(true)
    expect(mocks.claimUpdate).toHaveBeenCalledOnce()
    expect(mocks.claimUpdate.mock.calls[0][0]).toHaveProperty('marking_started_at')
    expect(mocks.after).toHaveBeenCalledOnce()
  })

  it('leaves the claim alone when the poll asked not to trigger', async () => {
    mocks.session = sessionRow({ status: 'processing' })

    const { body } = await poll(false)

    expect(body.status).toBe('generating')
    expect(body.triggerQueued).toBe(false)
    expectNoMarkingFired()
  })
})
