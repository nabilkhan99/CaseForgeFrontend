import { beforeEach, describe, expect, it, vi } from 'vitest'

/**
 * The moment an address becomes an account.
 *
 * Two doors verify through this one route and the difference between them is a
 * single string on a database row that decides which funnel every later chart
 * is drawn from: `sessionId` present = the GUEST reveal, absent = the /free
 * SIGN-UP box. Getting that backwards is invisible in the product and wrong
 * everywhere else, so it is pinned here.
 *
 * The other property under test is that provisioning failure is NOT fatal. The
 * code WAS right; refusing the guest their report over an account problem would
 * take away the thing they spent twelve minutes earning.
 */

const mocks = vi.hoisted(() => ({
  lead: null as Record<string, unknown> | null,
  leadError: null as unknown,
  updates: [] as Record<string, unknown>[],
  filters: [] as { column: string; value: unknown }[],
  ensure: vi.fn(),
  brevo: vi.fn(),
}))

vi.mock('server-only', () => ({}))

vi.mock('@/lib/marketing/trialLead', () => ({
  pushTrialLeadToBrevo: (...args: unknown[]) => mocks.brevo(...args),
}))

vi.mock('@/lib/auth/trialAccount', () => ({
  ensureTrialAccount: (...args: unknown[]) => mocks.ensure(...args),
}))

vi.mock('@/lib/trial/verification', () => ({
  CODE_LENGTH: 6,
  MAX_VERIFY_ATTEMPTS: 5,
  // The real one is a salted hash comparison; what this file is about is what
  // happens on either side of it.
  verificationCodeMatches: (code: string) => code === '123456',
}))

vi.mock('@/lib/supabase/admin', () => ({
  getSupabaseAdmin: () => ({
    from: (table: string) => ({
      select: () => {
        const builder = {
          eq: (column: string, value: unknown) => {
            if (table === 'trial_leads') mocks.filters.push({ column, value })
            return builder
          },
          maybeSingle: async () =>
            table === 'trial_leads'
              ? { data: mocks.lead, error: mocks.leadError }
              : { data: { title: 'A station' }, error: null },
        }
        return builder
      },
      update: (values: Record<string, unknown>) => {
        mocks.updates.push(values)
        return { eq: async () => ({ error: null }) }
      },
    }),
  }),
}))

const { POST } = await import('./route')

const VERIFIABLE_LEAD = {
  id: 'lead-1',
  email: 'sarah@nhs.net',
  first_name: 'Sarah',
  phone: null,
  training_stage: 'st3',
  sca_sit_date: null,
  training_start_month: null,
  training_start_year: null,
  akt_status: null,
  akt_sitting: null,
  sca_status: null,
  sca_sitting: null,
  not_in_training_role: null,
  station_id: null,
  verification_code_hash: 'hash',
  verification_expires_at: new Date(Date.now() + 600_000).toISOString(),
  verification_attempts: 0,
  email_verified_at: null,
}

async function post(body: Record<string, unknown>) {
  const response = await POST(
    new Request('https://www.fourteenfisherman.com/api/try/verify-code', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    }) as any,
  )
  return { status: response.status, body: await response.json() }
}

beforeEach(() => {
  vi.clearAllMocks()
  mocks.lead = { ...VERIFIABLE_LEAD }
  mocks.leadError = null
  mocks.updates = []
  mocks.filters = []
  mocks.brevo.mockResolvedValue(undefined)
  mocks.ensure.mockResolvedValue({
    userId: 'user-1',
    created: true,
    signInUrl: 'https://www.fourteenfisherman.com/auth/start?token_hash=h&email=sarah@nhs.net',
    granted: true,
    state: 'trial',
    claimed: 0,
  })
})

describe('which door the grant is recorded against', () => {
  it('a sessionId is the guest reveal', async () => {
    const { status, body } = await post({ sessionId: 'session-1', code: '123456' })

    expect(status).toBe(200)
    expect(body.ok).toBe(true)
    expect(mocks.ensure).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ email: 'sarah@nhs.net', source: 'guest_reveal' }),
    )
    // Found by session, which is what makes a guessed address unable to
    // re-point somebody else's consultation.
    expect(mocks.filters).toContainEqual({ column: 'session_id', value: 'session-1' })
  })

  it('an email alone is the sign-up box on /free', async () => {
    await post({ email: 'Sarah@NHS.net', code: '123456' })

    expect(mocks.ensure).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ source: 'signup' }),
    )
    expect(mocks.filters).toContainEqual({ column: 'email', value: 'sarah@nhs.net' })
  })

  it('a sessionId wins when both are sent, so a stray field cannot redirect a reveal', async () => {
    await post({ sessionId: 'session-1', email: 'attacker@example.com', code: '123456' })

    expect(mocks.ensure).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ source: 'guest_reveal', email: 'sarah@nhs.net' }),
    )
    expect(mocks.filters).toContainEqual({ column: 'session_id', value: 'session-1' })
  })
})

describe('the response the caller reads', () => {
  it('carries the account and the grant beside the ok', async () => {
    const { body } = await post({ sessionId: 'session-1', code: '123456' })

    expect(body).toEqual({
      ok: true,
      account: {
        userId: 'user-1',
        created: true,
        signInUrl: 'https://www.fourteenfisherman.com/auth/start?token_hash=h&email=sarah@nhs.net',
      },
      trial: { state: 'trial', granted: true },
    })
  })

  it('says created: false for an address that already had an account', async () => {
    mocks.ensure.mockResolvedValue({
      userId: 'user-9',
      created: false,
      signInUrl: 'https://www.fourteenfisherman.com/auth/start?token_hash=h2',
      granted: true,
      state: 'trial',
      claimed: 2,
    })

    const { body } = await post({ email: 'sarah@nhs.net', code: '123456' })
    expect(body.account).toMatchObject({ userId: 'user-9', created: false })
    expect(body.trial.granted).toBe(true)
  })

  it('marks the lead verified and clears the code before any of that', async () => {
    await post({ sessionId: 'session-1', code: '123456' })
    expect(mocks.updates[0]).toMatchObject({
      verification_code_hash: null,
      verification_expires_at: null,
    })
    expect(mocks.updates[0].email_verified_at).toEqual(expect.any(String))
  })
})

describe('when the account cannot be made', () => {
  it('still opens the report — the code was right', async () => {
    mocks.ensure.mockResolvedValue({
      userId: null,
      created: false,
      signInUrl: null,
      granted: false,
      state: 'none',
      claimed: 0,
    })

    const { status, body } = await post({ sessionId: 'session-1', code: '123456' })

    expect(status).toBe(200)
    expect(body.ok).toBe(true)
    expect(body.account).toBeNull()
    expect(body.trial).toEqual({ state: 'none', granted: false })
  })

  it('survives ensureTrialAccount throwing outright', async () => {
    mocks.ensure.mockRejectedValue(new Error('network'))

    const { status, body } = await post({ sessionId: 'session-1', code: '123456' })

    expect(status).toBe(200)
    expect(body.ok).toBe(true)
    expect(body.account).toBeNull()
  })
})

describe('an already-verified lead', () => {
  it('is granted anyway, so a reload does not strand a trialist without a grant', async () => {
    // Legacy leads verified before this shipped land here too, which is the
    // reason it is not a bare `return { ok: true }`.
    mocks.lead = { ...VERIFIABLE_LEAD, email_verified_at: new Date().toISOString() }

    const { body } = await post({ sessionId: 'session-1', code: '123456' })

    expect(body.ok).toBe(true)
    expect(mocks.ensure).toHaveBeenCalledOnce()
    // Nothing re-verified, nothing re-pushed to the marketing list.
    expect(mocks.updates).toHaveLength(0)
    expect(mocks.brevo).not.toHaveBeenCalled()
  })
})

describe('refusals', () => {
  it('needs a session or an email', async () => {
    const { status } = await post({ code: '123456' })
    expect(status).toBe(400)
    expect(mocks.ensure).not.toHaveBeenCalled()
  })

  it('needs a six-digit code', async () => {
    const { status } = await post({ sessionId: 'session-1', code: '12' })
    expect(status).toBe(400)
  })

  it('grants nothing on a wrong code, and counts the attempt', async () => {
    const { status } = await post({ sessionId: 'session-1', code: '999999' })
    expect(status).toBe(401)
    expect(mocks.ensure).not.toHaveBeenCalled()
    expect(mocks.updates[0]).toEqual({ verification_attempts: 1 })
  })

  it('grants nothing on an expired code', async () => {
    mocks.lead = {
      ...VERIFIABLE_LEAD,
      verification_expires_at: new Date(Date.now() - 1000).toISOString(),
    }
    const { status } = await post({ sessionId: 'session-1', code: '123456' })
    expect(status).toBe(410)
    expect(mocks.ensure).not.toHaveBeenCalled()
  })

  it('grants nothing once the attempts are used up', async () => {
    mocks.lead = { ...VERIFIABLE_LEAD, verification_attempts: 5 }
    const { status } = await post({ sessionId: 'session-1', code: '123456' })
    expect(status).toBe(429)
    expect(mocks.ensure).not.toHaveBeenCalled()
  })

  it('grants nothing when there is no lead at all', async () => {
    mocks.lead = null
    const { status } = await post({ email: 'nobody@example.com', code: '123456' })
    expect(status).toBe(404)
    expect(mocks.ensure).not.toHaveBeenCalled()
  })
})
