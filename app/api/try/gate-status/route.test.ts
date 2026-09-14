import { beforeEach, describe, expect, it, vi } from 'vitest'

/**
 * What a session id alone may learn, and what only the consultation's owner may.
 *
 * Holding a session id (a UUID in a link that gets forwarded, and that sits in
 * the founders' lead alert) earns main's minimal answer: `{ verified }`. The
 * verdict, the score, the summary and the marking status are for a request that
 * proves the consultation is its own: the signed guest cookie for this session,
 * or the signed-in user who owns it. Within that, only the four-field summary
 * ever crosses, and only for trial sessions.
 */

process.env.TRIAL_GUEST_COOKIE_SECRET = 'test-secret'

const mocks = vi.hoisted(() => ({
  lead: null as Record<string, unknown> | null,
  leadError: null as unknown,
  session: null as Record<string, unknown> | null,
  result: null as Record<string, unknown> | null,
  /** The signed-in user, or null for a signed-out request. */
  user: null as { id: string } | null,
  authThrows: false,
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

vi.mock('@/lib/supabase/server', () => ({
  createClient: async () => {
    if (mocks.authThrows) throw new Error('no cookies')
    return { auth: { getUser: async () => ({ data: { user: mocks.user } }) } }
  },
}))

const { GET } = await import('./route')
const { signGuestCookie, withGuestSession } = await import('@/lib/trial/guestSession')

const SESSION_ID = '11111111-1111-4111-8111-111111111111'

/** The cookie the server writes when it opens `sessionId` for this browser. */
function ownCookie(sessionId = SESSION_ID): string {
  return signGuestCookie(withGuestSession(null, sessionId, Math.floor(Date.now() / 1000)))!
}

async function get(options: { sessionId?: string; cookie?: string } = {}) {
  const sessionId = options.sessionId ?? SESSION_ID
  const response = await GET({
    nextUrl: { searchParams: new URLSearchParams({ sessionId }) },
    cookies: {
      get: (name: string) =>
        options.cookie && name === 'ff_guest' ? { value: options.cookie } : undefined,
    },
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

/** A 12-minute station, embedded the way PostgREST returns a one-to-one. */
const STATION = { consultation_duration_seconds: 720 }

/** An ISO timestamp this many seconds ago. */
function secondsAgo(seconds: number): string {
  return new Date(Date.now() - seconds * 1000).toISOString()
}

beforeEach(() => {
  vi.clearAllMocks()
  vi.spyOn(console, 'error').mockImplementation(() => {})
  mocks.lead = null
  mocks.leadError = null
  mocks.session = null
  mocks.result = null
  mocks.user = null
  mocks.authThrows = false
})

describe('a request holding only the session id', () => {
  it('gets main’s minimal answer and nothing about the consultation', async () => {
    mocks.session = GUEST_SESSION
    mocks.result = MARKED

    const { body } = await get()

    expect(body).toEqual({ verified: false })
  })

  it('learns whether the lead is verified, which is what the gate needs', async () => {
    mocks.session = GUEST_SESSION
    mocks.lead = { email_verified_at: '2026-09-06T12:00:00Z' }
    mocks.result = MARKED

    expect((await get()).body).toEqual({ verified: true })
  })

  it('is refused the details with a valid cookie for a different session', async () => {
    mocks.session = GUEST_SESSION
    mocks.result = MARKED

    const { body } = await get({ cookie: ownCookie('22222222-2222-4222-8222-222222222222') })

    expect(body).toEqual({ verified: false })
  })

  it('is refused them with a forged cookie', async () => {
    mocks.session = GUEST_SESSION
    mocks.result = MARKED
    const real = ownCookie()
    const forged = `${real.slice(0, -1)}${real.endsWith('A') ? 'B' : 'A'}`

    expect((await get({ cookie: forged })).body).toEqual({ verified: false })
  })

  it('is refused them while signed in as somebody else', async () => {
    mocks.session = { user_id: 'user-9', status: 'completed', transcript: [] }
    mocks.lead = { email_verified_at: '2026-09-06T12:00:00Z' }
    mocks.result = MARKED
    mocks.user = { id: 'user-2' }

    expect((await get()).body).toEqual({ verified: true })
  })

  it('fails closed when the signed-in user cannot be read', async () => {
    mocks.session = { user_id: 'user-9', status: 'completed', transcript: [] }
    mocks.lead = { email_verified_at: '2026-09-06T12:00:00Z' }
    mocks.result = MARKED
    mocks.authThrows = true

    expect((await get()).body).toEqual({ verified: true })
  })
})

describe('the browser that ran it', () => {
  it('sees its own verdict summary', async () => {
    mocks.session = GUEST_SESSION
    mocks.result = MARKED

    const { body } = await get({ cookie: ownCookie() })

    expect(body.verified).toBe(false)
    expect(body.status).toBe('ready')
    expect(body.summary).toEqual({
      verdict: 'Bare Fail',
      weightedScore: 5.5,
      maxScore: 10.5,
      oneLineSummary: 'Good history, the management plan missed the withdrawal.',
    })
  })

  it('is sent no part of the report', async () => {
    mocks.session = GUEST_SESSION
    mocks.result = MARKED

    const serialised = JSON.stringify((await get({ cookie: ownCookie() })).body)

    expect(serialised).not.toContain('domains')
    expect(serialised).not.toContain('focus_areas')
    expect(serialised).not.toContain('Take paracetamol')
    expect(serialised).not.toContain('Medication overuse')
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

    const { body } = await get({ cookie: ownCookie() })

    expect(body.status).toBe('unmarkable')
    expect(body.candidateSeconds).toBe(38)
    expect(body.summary).toBeNull()
  })

  it('keeps the page waiting while the mark is still running', async () => {
    mocks.session = { user_id: null, status: 'processing', transcript: [] }

    const { body } = await get({ cookie: ownCookie() })

    expect(body.status).toBe('processing')
    expect(body.summary).toBeNull()
  })

  it('is told when nobody ever ended the consultation', async () => {
    mocks.session = {
      user_id: null,
      status: 'live',
      transcript: [{ speaker: 'candidate', text: 'Hello', start_ms: 2_000 }],
      started_at: secondsAgo(720 + 200),
      stations: STATION,
    }

    const { body } = await get({ cookie: ownCookie() })

    expect(body.status).toBe('unfinished')
    expect(body.summary).toBeNull()
  })

  it('does not call a consultation abandoned while it could still be running', async () => {
    mocks.session = {
      user_id: null,
      status: 'live',
      transcript: [{ speaker: 'candidate', text: 'Hello', start_ms: 2_000 }],
      started_at: secondsAgo(300),
      stations: STATION,
    }

    expect((await get({ cookie: ownCookie() })).body.status).toBe('live')
  })

  it('never hides a mark behind the abandonment inference', async () => {
    mocks.session = {
      user_id: null,
      status: 'live',
      transcript: [],
      started_at: secondsAgo(3_600),
      stations: STATION,
    }
    mocks.result = MARKED

    const { body } = await get({ cookie: ownCookie() })

    expect(body.status).toBe('ready')
    expect(body.summary).toMatchObject({ verdict: 'Bare Fail' })
  })
})

describe('the signed-in owner', () => {
  it('sees the summary of a trial session that has since been claimed', async () => {
    // Signing up attaches the guest session to the new account, so user_id is
    // no longer null, but the lead row still marks it as a free mock.
    mocks.session = { user_id: 'user-9', status: 'completed', transcript: [] }
    mocks.lead = { email_verified_at: '2026-09-06T12:00:00Z' }
    mocks.result = MARKED
    mocks.user = { id: 'user-9' }

    const { body } = await get()

    expect(body.verified).toBe(true)
    expect(body.summary).toMatchObject({ verdict: 'Bare Fail' })
  })
})

describe('boundaries that hold for everybody', () => {
  it('says nothing about a session that is not a free mock, even to its owner', async () => {
    // A paying user's consultation.
    mocks.session = { user_id: 'user-9', status: 'completed', transcript: [] }
    mocks.result = MARKED
    mocks.user = { id: 'user-9' }

    const { body } = await get()

    expect(body).toEqual({ verified: false })
  })

  it('treats a verified email as verified, with no SMS step left to wait for', async () => {
    mocks.session = GUEST_SESSION
    mocks.lead = { email_verified_at: '2026-09-06T12:00:00Z' }

    expect((await get()).body.verified).toBe(true)
  })

  it('fails closed on a lookup error', async () => {
    mocks.leadError = { message: 'connection reset' }
    mocks.session = GUEST_SESSION
    mocks.result = MARKED

    expect((await get({ cookie: ownCookie() })).body).toEqual({ verified: false })
  })

  it('rejects a request with no session id', async () => {
    const response = await GET({
      nextUrl: { searchParams: new URLSearchParams() },
      cookies: { get: () => undefined },
    } as never)

    expect(response.status).toBe(400)
    expect(await response.json()).toEqual({ verified: false })
  })
})
