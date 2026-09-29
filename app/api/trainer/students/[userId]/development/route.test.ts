import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'
import type { TrainerCohort } from '@/lib/trainer/guard'
import type { TrendReportV2 } from '@/lib/clinical-master/trendTypes'

/**
 * A coach reading one student's Development page. Two properties matter more
 * than any status code: nothing is read for an id outside the trainer's own
 * cohort, and nothing here ever starts a trend build, which is a paid Azure
 * call against the student's account.
 */

const getTrainerCohort = vi.fn()
const getSupabaseAdmin = vi.fn()

vi.mock('@/lib/trainer/guard', () => ({
  getTrainerCohort: () => getTrainerCohort(),
}))
vi.mock('@/lib/supabase/admin', () => ({
  getSupabaseAdmin: () => getSupabaseAdmin(),
}))

const { GET } = await import('./route')

const TRAINER = 'trainer-0000'
const STUDENT = 'student-1111'
const OTHER_STUDENT = 'student-2222'
const OUTSIDER = 'outsider-9999'
const STATION_A = 'station-aaaa'
const STATION_B = 'station-bbbb'
const STATION_GONE = 'station-gone'

function cohort(overrides: Partial<TrainerCohort> = {}): TrainerCohort {
  // The guard has already stripped the trainer's own id, as it does in life.
  return {
    cohortId: 'cohort-1',
    name: 'Hassan 1:1',
    stationIds: [],
    studentIds: [STUDENT, OTHER_STUDENT],
    ...overrides,
  }
}

function call(userId: string) {
  return GET(new NextRequest(`http://localhost/api/trainer/students/${userId}/development`), {
    params: Promise.resolve({ userId }),
  })
}

function v2Report(): TrendReportV2 {
  return {
    version: 2,
    candidate_id: STUDENT,
    window: { cases_included: 4, from: '2026-09-01', to: '2026-09-20' },
    overall_trajectory: 'improving',
    overall_narrative: 'Getting there.',
    patterns: [
      {
        headline: 'Check ideas before explaining',
        domain: 'relating_to_others',
        frequency: 3,
        your_quote: 'So what we will do is',
        quote_gloss: '',
        model_line: 'What were you thinking it might be?',
        model_gloss: '',
        the_change: 'Ask first.',
        evidence: [
          { case_id: STATION_A, quote: 'first' },
          { case_id: STATION_B, quote: 'second' },
        ],
      },
      {
        headline: 'Safety-net with specifics',
        domain: 'clinical_management',
        frequency: 2,
        your_quote: 'Come back if worse',
        quote_gloss: '',
        model_line: 'If the pain spreads to your arm, call 999.',
        model_gloss: '',
        the_change: 'Name the red flag.',
        // A repeat and an id with no station behind it.
        evidence: [
          { case_id: STATION_A, quote: 'again' },
          { case_id: STATION_GONE, quote: 'lost' },
        ],
      },
    ],
  }
}

interface Recorded {
  table: string
  method: string
  args: unknown[]
}

interface Stub {
  trend?: unknown
  trendError?: unknown
  sessions?: unknown[]
  sessionsError?: unknown
  count?: number | null
  countError?: unknown
  stations?: { id: string; title: string | null }[]
  stationsError?: unknown
}

/**
 * A read-only fake of the admin client. Every builder offers only the read
 * methods this route should use; an insert, upsert, update, delete or rpc is
 * not there to call, so a write attempt fails the test rather than passing
 * silently.
 */
function stubAdmin(stub: Stub = {}) {
  const calls: Recorded[] = []

  const from = vi.fn((table: string) => {
    const own: Recorded[] = []
    const record = (method: string, args: unknown[]) => {
      const entry = { table, method, args }
      calls.push(entry)
      own.push(entry)
    }

    const result = () => {
      if (table === 'trend_reports') {
        return { data: stub.trend ?? null, error: stub.trendError ?? null }
      }
      if (table === 'stations') {
        return { data: stub.stations ?? [], error: stub.stationsError ?? null }
      }
      if (table === 'clinical_sessions') {
        const select = own.find((c) => c.method === 'select')
        const isCount = Boolean((select?.args[1] as { count?: string } | undefined)?.count)
        return isCount
          ? { data: null, count: stub.count ?? 0, error: stub.countError ?? null }
          : { data: stub.sessions ?? [], error: stub.sessionsError ?? null }
      }
      throw new Error(`unexpected table ${table}`)
    }

    const builder: Record<string, unknown> = {}
    for (const method of ['select', 'eq', 'in', 'order', 'limit']) {
      builder[method] = vi.fn((...args: unknown[]) => {
        record(method, args)
        return builder
      })
    }
    builder.maybeSingle = vi.fn(() => Promise.resolve(result()))
    builder.then = (resolve: (value: unknown) => unknown, reject: (reason: unknown) => unknown) =>
      Promise.resolve()
        .then(result)
        .then(resolve, reject)
    return builder
  })

  getSupabaseAdmin.mockReturnValue({ from })
  return { from, calls }
}

const fetchSpy = vi.fn()

beforeEach(() => {
  vi.clearAllMocks()
  vi.stubGlobal('fetch', fetchSpy)
  vi.stubEnv('MARKING_API_URL', 'https://marking.example')
  vi.stubEnv('MARKING_SHARED_SECRET', 'test-secret')
  vi.spyOn(console, 'error').mockImplementation(() => {})
})

afterEach(() => {
  vi.unstubAllGlobals()
  vi.unstubAllEnvs()
  vi.restoreAllMocks()
})

describe('GET /api/trainer/students/[userId]/development', () => {
  describe('who may read', () => {
    it('403s someone who is not a trainer, before touching the database', async () => {
      getTrainerCohort.mockResolvedValue(null)
      const { from } = stubAdmin()

      const res = await call(STUDENT)

      expect(res.status).toBe(403)
      expect(await res.json()).toEqual({ error: 'Forbidden' })
      expect(getSupabaseAdmin).not.toHaveBeenCalled()
      expect(from).not.toHaveBeenCalled()
    })

    it('403s an id outside the cohort with the same body, and reads nothing', async () => {
      getTrainerCohort.mockResolvedValue(cohort())
      const { from } = stubAdmin()

      const res = await call(OUTSIDER)

      expect(res.status).toBe(403)
      expect(await res.json()).toEqual({ error: 'Forbidden' })
      expect(from).not.toHaveBeenCalled()
    })

    it("403s the trainer's own id, which the guard keeps out of studentIds", async () => {
      getTrainerCohort.mockResolvedValue(cohort())
      const { from } = stubAdmin()

      expect((await call(TRAINER)).status).toBe(403)
      expect(from).not.toHaveBeenCalled()
    })

    it('403s everyone when the cohort has no students yet', async () => {
      getTrainerCohort.mockResolvedValue(cohort({ studentIds: [] }))
      const { from } = stubAdmin()

      expect((await call(STUDENT)).status).toBe(403)
      expect(from).not.toHaveBeenCalled()
    })
  })

  describe('what a trainer gets back', () => {
    it('returns a v2 report with its evidence cases named', async () => {
      getTrainerCohort.mockResolvedValue(cohort())
      const { calls } = stubAdmin({
        trend: v2Report(),
        count: 4,
        stations: [
          { id: STATION_A, title: 'Chest pain in a lorry driver' },
          { id: STATION_B, title: 'Low mood after bereavement' },
        ],
      })

      const res = await call(STUDENT)
      const body = await res.json()

      expect(res.status).toBe(200)
      expect(body.report).toEqual(v2Report())
      expect(body.markedCount).toBe(4)
      // The unresolvable id is dropped, not shown as a raw uuid.
      expect(body.caseTitles).toEqual({
        [STATION_A]: 'Chest pain in a lorry driver',
        [STATION_B]: 'Low mood after bereavement',
      })

      // One lookup, each evidence id once.
      const titleLookup = calls.find((c) => c.table === 'stations' && c.method === 'in')
      expect(titleLookup?.args).toEqual(['id', [STATION_A, STATION_B, STATION_GONE]])
    })

    it('treats a v1 row as no report at all', async () => {
      getTrainerCohort.mockResolvedValue(cohort())
      const { calls } = stubAdmin({
        trend: {
          candidate_id: STUDENT,
          recurring_themes: ['x'],
          next_steps: ['y'],
          confidence: 'low',
        },
        count: 5,
      })

      const body = await (await call(STUDENT)).json()

      expect(body.report).toBeNull()
      expect(body.caseTitles).toEqual({})
      expect(body.markedCount).toBe(5)
      expect(calls.some((c) => c.table === 'stations')).toBe(false)
    })

    it('reports how many cases are marked when there is no report', async () => {
      getTrainerCohort.mockResolvedValue(cohort())
      stubAdmin({ trend: null, count: 2 })

      const body = await (await call(STUDENT)).json()

      expect(body).toEqual({ report: null, domainCases: [], caseTitles: {}, markedCount: 2 })
    })

    it('builds the domain series from the student\'s own marked sessions', async () => {
      getTrainerCohort.mockResolvedValue(cohort())
      const { calls } = stubAdmin({
        count: 2,
        sessions: [
          {
            id: 'newer',
            started_at: '2026-09-10T09:00:00Z',
            completed_at: '2026-09-10T09:14:00Z',
            session_results: {
              weighted_score: '7.5',
              domains: [
                { domain: 'data_gathering', grade_points: 3 },
                { domain: 'clinical_management', weighted_points: 3 },
              ],
            },
          },
          {
            id: 'empty',
            started_at: '2026-09-05T09:00:00Z',
            completed_at: '2026-09-05T09:14:00Z',
            session_results: { weighted_score: 0, domains: [{ domain: 'data_gathering', grade_points: 0 }] },
          },
          {
            id: 'older',
            started_at: '2026-09-01T09:00:00Z',
            completed_at: '2026-09-01T09:14:00Z',
            session_results: {
              weighted_score: 4,
              domains: [{ domain: 'relating_to_others', grade_points: 2 }],
            },
          },
        ],
      })

      const body = await (await call(STUDENT)).json()

      expect(body.domainCases).toEqual([
        { sessionId: 'older', points: { relating_to_others: 2 } },
        { sessionId: 'newer', points: { data_gathering: 3, clinical_management: 3 } },
      ])

      // Scoped to the id in the URL, and only to completed sessions.
      const sessionFilters = calls.filter((c) => c.table === 'clinical_sessions' && c.method === 'eq')
      expect(sessionFilters.map((c) => c.args)).toEqual([
        ['user_id', STUDENT],
        ['status', 'completed'],
        ['user_id', STUDENT],
        ['status', 'completed'],
      ])
      const trendFilter = calls.find((c) => c.table === 'trend_reports' && c.method === 'eq')
      expect(trendFilter?.args).toEqual(['candidate_id', STUDENT])
    })

    it('reads the newest trend row only', async () => {
      getTrainerCohort.mockResolvedValue(cohort())
      const { calls } = stubAdmin({ trend: v2Report(), count: 4 })

      await call(STUDENT)

      const trendCalls = calls.filter((c) => c.table === 'trend_reports')
      expect(trendCalls).toContainEqual({
        table: 'trend_reports',
        method: 'order',
        args: ['created_at', { ascending: false }],
      })
      expect(trendCalls).toContainEqual({ table: 'trend_reports', method: 'limit', args: [1] })
    })
  })

  describe('never builds a report', () => {
    it('makes no network call and touches no claim table, report or not', async () => {
      getTrainerCohort.mockResolvedValue(cohort())

      // No report, enough cases: exactly the state in which the student's own
      // trend route would kick off a build.
      const { from } = stubAdmin({ trend: null, count: 7 })
      await call(STUDENT)

      stubAdmin({ trend: v2Report(), count: 7 })
      await call(STUDENT)

      expect(fetchSpy).not.toHaveBeenCalled()
      const tables = from.mock.calls.map(([table]) => table)
      expect(tables).not.toContain('trend_generation_claims')
    })
  })

  describe('when a read fails', () => {
    it.each([
      ['the trend read', { trendError: { message: 'boom' } }],
      ['the session read', { sessionsError: { message: 'boom' } }],
      ['the count', { countError: { message: 'boom' } }],
    ])('500s generically when %s fails', async (_label, stub) => {
      getTrainerCohort.mockResolvedValue(cohort())
      stubAdmin(stub as Stub)

      const res = await call(STUDENT)

      expect(res.status).toBe(500)
      expect(await res.json()).toEqual({ error: 'Failed to load development' })
      expect(console.error).toHaveBeenCalledWith(
        expect.stringContaining('[trainer-development]'),
        expect.anything(),
      )
    })

    it('500s when the admin client cannot be built', async () => {
      getTrainerCohort.mockResolvedValue(cohort())
      getSupabaseAdmin.mockImplementation(() => {
        throw new Error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY for admin client')
      })

      const res = await call(STUDENT)

      expect(res.status).toBe(500)
      expect(await res.json()).toEqual({ error: 'Failed to load development' })
    })

    it('still returns the report when only the case titles fail', async () => {
      getTrainerCohort.mockResolvedValue(cohort())
      stubAdmin({ trend: v2Report(), count: 4, stationsError: { message: 'boom' } })

      const res = await call(STUDENT)
      const body = await res.json()

      expect(res.status).toBe(200)
      expect(body.report).toEqual(v2Report())
      expect(body.caseTitles).toEqual({})
    })
  })
})
