import { beforeEach, describe, expect, it, vi } from 'vitest'

/**
 * What the unverified trialist is allowed to know.
 *
 * This route answers two questions for someone who has proved nothing yet, so
 * both of its limits are pinned: the summary is all that crosses (the report is
 * what the email buys), and only a *trial* session answers at all — otherwise
 * this would be "read any user's verdict by guessing a session id", which is
 * emphatically not what the guest-session boundary was meant to allow.
 */

const mocks = vi.hoisted(() => ({
  lead: null as Record<string, unknown> | null,
  leadError: null as unknown,
  session: null as Record<string, unknown> | null,
  result: null as Record<string, unknown> | null,
}))

vi.mock('server-only', () => ({}))

vi.mock('@/lib/supabase/admin', () => ({
  getSupabaseAdmin: () => ({
    from: (table: string) => ({
      select: () => ({
        eq: () => ({
          maybeSingle: async () => {
            if (table === 'trial_leads') {
              return { data: mocks.lead, error: mocks.leadError }
            }
            if (table === 'clinical_sessions') {
              return { data: mocks.session, error: null }
            }
            return { data: mocks.result, error: null }
          },
        }),
      }),
    }),
  }),
}))

const { GET } = await import('./route')

async function get(sessionId = 'session-1') {
  const response = await GET({
    nextUrl: { searchParams: new URLSearchParams({ sessionId }) },
  } as never)
  return { status: response.status, body: await response.json() }
}

const MARKED = {
  verdict: 'Bare Fail',
  weighted_score: 5.5,
  max_score: 10.5,
  one_line_summary: 'Good history, the management plan missed the withdrawal.',
  domains: [{ domain: 'clinical_management', grade: 'F', evidence: [{ quote: 'Take paracetamol' }] }],
  focus_areas: [{ priority: 1, label: 'Medication overuse' }],
}

/** A guest free-mock session: nobody owns it, and it has been marked. */
const GUEST_SESSION = { user_id: null, status: 'completed', transcript: [] }

beforeEach(() => {
  vi.clearAllMocks()
  vi.spyOn(console, 'error').mockImplementation(() => {})
  mocks.lead = null
  mocks.leadError = null
  mocks.session = null
  mocks.result = null
})

describe('GET /api/try/gate-status', () => {
  it('reveals the summary to an unverified trialist', async () => {
    mocks.session = GUEST_SESSION
    mocks.result = MARKED

    const { body } = await get()

    expect(body.verified).toBe(false)
    expect(body.status).toBe('ready')
    expect(body.summary).toEqual({
      verdict: 'Bare Fail',
      weightedScore: 5.5,
      maxScore: 10.5,
      oneLineSummary: 'Good history, the management plan missed the withdrawal.',
    })
  })

  it('sends no part of the report, verified or not', async () => {
    mocks.session = GUEST_SESSION
    mocks.result = MARKED

    const serialised = JSON.stringify((await get()).body)

    expect(serialised).not.toContain('domains')
    expect(serialised).not.toContain('focus_areas')
    expect(serialised).not.toContain('Take paracetamol')
    expect(serialised).not.toContain('Medication overuse')
  })

  it('says nothing about a session that is not a free mock', async () => {
    // A paying user's consultation. Without this rule the route would hand out
    // any user's verdict to anyone who could guess a session id.
    mocks.session = { user_id: 'user-9', status: 'completed', transcript: [] }
    mocks.result = MARKED

    const { body } = await get()

    expect(body).toEqual({ verified: false })
    expect(body.summary).toBeUndefined()
  })

  it('still answers for a trial session that has since been claimed', async () => {
    // Signing up attaches the guest session to the new account, so user_id is
    // no longer null — but the lead row still marks it as a free mock.
    mocks.session = { user_id: 'user-9', status: 'completed', transcript: [] }
    mocks.lead = { email_verified_at: '2026-09-06T12:00:00Z', phone: null }
    mocks.result = MARKED

    const { body } = await get()

    expect(body.verified).toBe(true)
    expect(body.summary).toMatchObject({ verdict: 'Bare Fail' })
  })

  it('reports a run the guard refused, with its length', async () => {
    mocks.session = {
      user_id: null,
      status: 'unmarkable',
      transcript: [
        { speaker: 'candidate', text: 'Hello there', start_ms: 3_000 },
        { speaker: 'candidate', text: 'Right, bye', start_ms: 41_000 },
      ],
    }

    const { body } = await get()

    expect(body.status).toBe('unmarkable')
    expect(body.candidateSeconds).toBe(38)
    expect(body.summary).toBeNull()
  })

  it('keeps the page waiting while the mark is still running', async () => {
    mocks.session = { user_id: null, status: 'processing', transcript: [] }

    const { body } = await get()

    expect(body.status).toBe('processing')
    expect(body.summary).toBeNull()
  })

  it('still reports verification when the email is confirmed', async () => {
    mocks.session = GUEST_SESSION
    mocks.lead = { email_verified_at: '2026-09-06T12:00:00Z', phone: null }

    expect((await get()).body.verified).toBe(true)
  })

  it('holds the gate shut while a phone step is unsettled', async () => {
    mocks.session = GUEST_SESSION
    mocks.lead = {
      email_verified_at: '2026-09-06T12:00:00Z',
      phone: '07700900000',
      phone_verified_at: null,
      phone_verification_skipped_at: null,
    }

    expect((await get()).body.verified).toBe(false)
  })

  it('fails closed on a lookup error', async () => {
    mocks.leadError = { message: 'connection reset' }
    mocks.session = GUEST_SESSION
    mocks.result = MARKED

    const { body } = await get()

    expect(body).toEqual({ verified: false })
  })

  it('rejects a request with no session id', async () => {
    const response = await GET({
      nextUrl: { searchParams: new URLSearchParams() },
    } as never)

    expect(response.status).toBe(400)
    expect(await response.json()).toEqual({ verified: false })
  })
})
