import { beforeEach, describe, expect, it, vi } from 'vitest'

/**
 * Who may read a report.
 *
 * This route runs on the service role, so the checks here are the only thing
 * standing between a session id and its report and transcript. The rule:
 *   - signed out: a guest session nobody owns yet, and nothing else;
 *   - signed in: your own session, any unowned guest session, a student's
 *     session if you are their trainer, or any session if you are an
 *     ADMIN_EMAILS admin (so the founders' lead alert links open);
 *   - trainer and admin reads never start a marking run.
 */

type Row = { id: string; user_id: string | null }

const mocks = vi.hoisted(() => ({
  getUser: vi.fn(),
  triggerMarking: vi.fn(),
  row: null as Row | null,
}))

vi.mock('server-only', () => ({}))

vi.mock('@/lib/supabase/server', () => ({
  createClient: async () => ({ auth: { getUser: mocks.getUser } }),
}))

vi.mock('@/lib/trainer/guard', () => ({ getTrainerCohort: async () => null }))

vi.mock('@/lib/clinical-master/triggerMarking', () => ({
  triggerMarking: mocks.triggerMarking,
}))

/** A query builder that honours the two filters the access checks use. */
function sessions() {
  const filters: { userId?: string; unowned?: boolean } = {}
  const answer = () => {
    const row = mocks.row
    if (!row) return null
    if (filters.userId !== undefined && row.user_id !== filters.userId) return null
    if (filters.unowned && row.user_id !== null) return null
    return {
      ...row,
      transcript: [{ speaker: 'candidate', text: 'Hello', start_ms: 0 }],
      status: 'processing',
      started_at: new Date().toISOString(),
      completed_at: null,
      station_id: 'st-1',
      stations: { title: 'A case' },
    }
  }
  const builder: Record<string, unknown> = {
    select: () => builder,
    eq: (column: string, value: string) => {
      if (column === 'user_id') filters.userId = value
      return builder
    },
    is: (column: string, value: null) => {
      if (column === 'user_id' && value === null) filters.unowned = true
      return builder
    },
    maybeSingle: async () => ({ data: answer(), error: null }),
    single: async () => {
      const data = answer()
      return { data, error: data ? null : 'missing' }
    },
  }
  return builder
}

vi.mock('@/lib/supabase/admin', () => ({
  getSupabaseAdmin: () => ({
    from: (table: string) =>
      table === 'session_results'
        ? { select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: null, error: null }) }) }) }
        : sessions(),
  }),
}))

const { POST } = await import('./route')

async function read() {
  const response = await POST({
    json: async () => ({ sessionId: 'session-1', trigger: true }),
  } as never)
  return response.status
}

beforeEach(() => {
  vi.clearAllMocks()
  vi.spyOn(console, 'error').mockImplementation(() => {})
  process.env.MARKING_API_URL = 'https://caseforge2025a.azurewebsites.net'
  process.env.MARKING_SHARED_SECRET = 'shh'
  process.env.ADMIN_EMAILS = 'founder@fourteenfisherman.com'
  mocks.triggerMarking.mockResolvedValue({ triggered: true })
})

describe('a signed-out caller', () => {
  beforeEach(() => mocks.getUser.mockResolvedValue({ data: { user: null } }))

  it('may read a guest session nobody owns', async () => {
    mocks.row = { id: 'session-1', user_id: null }
    expect(await read()).toBe(200)
  })

  it('may not read a session that belongs to an account', async () => {
    mocks.row = { id: 'session-1', user_id: 'owner-1' }
    expect(await read()).toBe(403)
    expect(mocks.triggerMarking).not.toHaveBeenCalled()
  })
})

describe('a signed-in caller', () => {
  it('reads their own session', async () => {
    mocks.getUser.mockResolvedValue({ data: { user: { id: 'owner-1', email: 'gp@nhs.net' } } })
    mocks.row = { id: 'session-1', user_id: 'owner-1' }
    expect(await read()).toBe(200)
  })

  it("may not read someone else's session", async () => {
    mocks.getUser.mockResolvedValue({ data: { user: { id: 'other-1', email: 'other@nhs.net' } } })
    mocks.row = { id: 'session-1', user_id: 'owner-1' }
    expect(await read()).toBe(403)
  })

  it('reads any session as an admin, without starting a marking run', async () => {
    mocks.getUser.mockResolvedValue({
      data: { user: { id: 'admin-1', email: 'Founder@FourteenFisherman.com' } },
    })
    mocks.row = { id: 'session-1', user_id: 'owner-1' }
    expect(await read()).toBe(200)
    expect(mocks.triggerMarking).not.toHaveBeenCalled()
  })
})
