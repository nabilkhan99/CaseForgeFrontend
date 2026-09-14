import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { beforeEach, describe, expect, it, vi } from 'vitest'

/**
 * The moment an address becomes an account — and, since 7 September 2026, a
 * signed-in session.
 *
 * Two doors verify through this one route and the difference between them is a
 * single string on a database row that decides which funnel every later chart
 * is drawn from: `sessionId` present = the GUEST reveal, absent = the dashboard
 * door at /free/open. Getting that backwards is invisible in the product and
 * wrong everywhere else, so it is pinned here.
 *
 * The other properties under test:
 *
 *  - the guest sign-up sets the password, stores the mobile and sends NO SMS;
 *  - the response carries session cookies, so nothing is emailed after the code;
 *  - `redirectTo` is rebuilt from a matched uuid, never interpolated;
 *  - provisioning failure is NOT fatal. The code WAS right; refusing the guest
 *    their report over an account problem would take away the thing they spent
 *    twelve minutes earning.
 *
 * And contract C3: the guest branch makes an account, honours a `password` and
 * a `phone`, claims the consultation and dates the five-day window from it ONLY
 * when the signed `ff_guest` cookie carries that session id. Every way of not
 * having that proof (no cookie, a forged one, one for a different session) is
 * main's report gate on an old link: the lead is verified and the report opens,
 * and nothing else happens. All three are pinned below.
 */

process.env.TRIAL_GUEST_COOKIE_SECRET = 'test-secret'

const mocks = vi.hoisted(() => ({
  lead: null as Record<string, unknown> | null,
  leadError: null as unknown,
  /** True when no lead row points at the session under test. */
  noLeadForSession: false,
  /** `clinical_sessions.started_at` for the session under test. */
  sessionStartedAt: null as string | null,
  /** Its status. The route must not care what it is. */
  sessionStatus: 'completed' as string,
  updates: [] as Record<string, unknown>[],
  /** Conditions each update was made under, e.g. `email_verified_at is null`. */
  updateConditions: [] as string[],
  /**
   * The rows the verifying UPDATE changed. Empty means another request moved
   * the lead to verified first.
   */
  verifiedRows: [{ id: 'lead-1' }] as { id: string }[],
  filters: [] as { column: string; value: unknown }[],
  ensure: vi.fn(),
  signIn: vi.fn(),
  brevo: vi.fn(),
  leadAlert: vi.fn(),
}))

vi.mock('server-only', () => ({}))

// The founders' alert. Mocked at the scheduler, so nothing is ever sent: the
// sending itself is covered in lib/trial/gateLeadAlert.test.ts.
vi.mock('@/lib/trial/gateLeadAlert', () => ({
  scheduleGateLeadAlert: (...args: unknown[]) => mocks.leadAlert(...args),
}))

vi.mock('@/lib/marketing/trialLead', () => ({
  pushTrialLeadToBrevo: (...args: unknown[]) => mocks.brevo(...args),
}))

vi.mock('@/lib/auth/trialAccount', () => ({
  ensureTrialAccount: (...args: unknown[]) => mocks.ensure(...args),
}))

vi.mock('@/lib/auth/accountSignUp', () => ({
  signInWithMagicLink: (...args: unknown[]) => mocks.signIn(...args),
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
        // Per-query, so "which key was this asked by" is answerable: the guest
        // branch looks up by session and may then fall back to the address.
        const used: Record<string, unknown> = {}
        const builder = {
          eq: (column: string, value: unknown) => {
            if (table === 'trial_leads') {
              mocks.filters.push({ column, value })
              used[column] = value
            }
            return builder
          },
          maybeSingle: async () => {
            if (table === 'trial_leads') {
              const missing = mocks.noLeadForSession && 'session_id' in used
              return { data: missing ? null : mocks.lead, error: mocks.leadError }
            }
            if (table === 'clinical_sessions')
              return {
                data: { started_at: mocks.sessionStartedAt, status: mocks.sessionStatus },
                error: null,
              }
            return { data: { title: 'A station' }, error: null }
          },
        }
        return builder
      },
      update: (values: Record<string, unknown>) => {
        mocks.updates.push(values)
        // Awaitable at any point in the chain, the way PostgREST's builder is.
        const chain = {
          eq: () => chain,
          is: (column: string, value: unknown) => {
            mocks.updateConditions.push(`${column} is ${value}`)
            return chain
          },
          select: () => chain,
          then: (
            resolve: (value: { data: { id: string }[]; error: null }) => unknown,
            reject?: (reason: unknown) => unknown,
          ) => Promise.resolve({ data: mocks.verifiedRows, error: null }).then(resolve, reject),
        }
        return chain
      },
    }),
  }),
}))

const { POST } = await import('./route')
// The real signer, not a stand-in: a test that forged its own cookies would
// prove nothing about the only thing this proof rests on.
const { newGuestCookie, signGuestCookie, withGuestSession } = await import(
  '@/lib/trial/guestSession'
)

/** A guest session id shaped like the ones /try/talk actually mints. */
const GUEST_SESSION = '11111111-1111-4111-8111-111111111111'

/** The cookie the server would have written when it opened `sessionId`. */
function guestCookie(sessionId: string): string {
  const cookie = withGuestSession(newGuestCookie(), sessionId, Math.floor(Date.now() / 1000))
  return signGuestCookie(cookie) ?? ''
}

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

async function post(body: Record<string, unknown>, cookie?: string) {
  const request = new Request('https://www.fourteenfisherman.com/api/try/verify-code', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  })
  // NextRequest's cookie jar, which a plain Request has no equivalent of.
  Object.assign(request, {
    cookies: {
      get: (name: string) => (cookie && name === 'ff_guest' ? { value: cookie } : undefined),
    },
  })
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const response = await POST(request as any)
  return { status: response.status, body: await response.json() }
}

beforeEach(() => {
  vi.clearAllMocks()
  mocks.lead = { ...VERIFIABLE_LEAD }
  mocks.leadError = null
  mocks.noLeadForSession = false
  mocks.sessionStartedAt = null
  mocks.sessionStatus = 'completed'
  mocks.updates = []
  mocks.updateConditions = []
  mocks.verifiedRows = [{ id: 'lead-1' }]
  mocks.filters = []
  mocks.brevo.mockResolvedValue(undefined)
  mocks.signIn.mockResolvedValue(true)
  mocks.ensure.mockResolvedValue({
    userId: 'user-1',
    created: true,
    alreadyExisted: false,
    passwordKept: false,
    signInUrl: null,
    granted: true,
    state: 'trial',
    claimed: 0,
  })
})

describe('which door the grant is recorded against', () => {
  it('a sessionId is the guest reveal', async () => {
    const { status, body } = await post(
      { sessionId: GUEST_SESSION, code: '123456' },
      guestCookie(GUEST_SESSION),
    )

    expect(status).toBe(200)
    expect(body.ok).toBe(true)
    expect(mocks.ensure).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ email: 'sarah@nhs.net', source: 'guest_reveal' }),
    )
    // Found by session, which is what makes a guessed address unable to
    // re-point somebody else's consultation.
    expect(mocks.filters).toContainEqual({ column: 'session_id', value: GUEST_SESSION })
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
    await post(
      { sessionId: GUEST_SESSION, email: 'attacker@example.com', code: '123456' },
      guestCookie(GUEST_SESSION),
    )

    expect(mocks.ensure).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ source: 'guest_reveal', email: 'sarah@nhs.net' }),
    )
    expect(mocks.filters).toContainEqual({ column: 'session_id', value: GUEST_SESSION })
  })
})

describe('the response the caller reads', () => {
  it('carries the account, the grant, the session and where to go', async () => {
    const { body } = await post(
      { sessionId: GUEST_SESSION, code: '123456' },
      guestCookie(GUEST_SESSION),
    )

    expect(body).toEqual({
      ok: true,
      account: { userId: 'user-1', created: true, alreadyExisted: false, passwordKept: false },
      trial: { state: 'trial', granted: true },
      signedIn: true,
      redirectTo: `/clinical-master/feedback/${GUEST_SESSION}`,
    })
  })

  it('says when the password typed on the form was not the one that counts', async () => {
    // The address already had an account with a password. Keeping it is the
    // rule (lib/auth/accountSignUp); keeping it SILENTLY is how somebody ends
    // up locked out of an account they believe they just set a password on.
    mocks.ensure.mockResolvedValue({
      userId: 'user-7',
      created: false,
      alreadyExisted: true,
      passwordKept: true,
      signInUrl: null,
      granted: true,
      state: 'trial',
      claimed: 0,
    })

    const { body } = await post(
      { sessionId: GUEST_SESSION, code: '123456', password: 'longenough1' },
      guestCookie(GUEST_SESSION),
    )

    expect(body.account).toEqual({
      userId: 'user-7',
      created: false,
      alreadyExisted: true,
      passwordKept: true,
    })
  })

  it('claims nothing was kept when the account was made on this call', async () => {
    const { body } = await post(
      { sessionId: GUEST_SESSION, code: '123456' },
      guestCookie(GUEST_SESSION),
    )

    expect(body.account.alreadyExisted).toBe(false)
    expect(body.account.passwordKept).toBe(false)
  })

  it('carries no sign-in credential — the cookies do that job', async () => {
    // A one-time link in a JSON body is a bearer credential for the account.
    const { body } = await post(
      { sessionId: GUEST_SESSION, code: '123456' },
      guestCookie(GUEST_SESSION),
    )
    expect(JSON.stringify(body)).not.toContain('token')
    expect(body.account.signInUrl).toBeUndefined()
  })

  it('says created: false for an address that already had an account', async () => {
    mocks.ensure.mockResolvedValue({
      userId: 'user-9',
      created: false,
      signInUrl: null,
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

describe('the dashboard door at /free/open', () => {
  it('takes no password: the one-door retirement removed the form that sent one', async () => {
    await post({ email: 'sarah@nhs.net', code: '123456', password: 'longenough1' })

    expect(mocks.ensure).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ source: 'signup', password: null }),
    )
  })

  it('stores no mobile it did not ask for, and leaves one we hold alone', async () => {
    await post({ email: 'sarah@nhs.net', code: '123456', phone: '07700 900123' })
    expect(mocks.updates[0]).not.toHaveProperty('phone')
  })

  it('sends no text, ever', () => {
    // The mobile is a line to a human, not a second factor. Asserted against
    // the source because "did not send an SMS" has no call to spy on: the
    // point is that this route knows nothing about SMS at all.
    const route = readFileSync(fileURLToPath(new URL('./route.ts', import.meta.url)), 'utf8')
      // The comments discuss the decision; only the code is bound by it.
      .replace(/\/\*[\s\S]*?\*\//g, ' ')
      .replace(/^\s*\/\/.*$/gm, ' ')
    expect(route.toLowerCase()).not.toMatch(/\bsms\b|send-phone-code|sendverificationsms/)
  })

  it('signs the browser in on this response', async () => {
    const { body } = await post({ email: 'sarah@nhs.net', code: '123456' })

    expect(mocks.signIn).toHaveBeenCalledWith('sarah@nhs.net')
    expect(body.signedIn).toBe(true)
  })

  it('still answers ok when the session could not be established', async () => {
    mocks.signIn.mockResolvedValue(false)

    const { status, body } = await post({ email: 'sarah@nhs.net', code: '123456' })

    expect(status).toBe(200)
    expect(body.signedIn).toBe(false)
    // The account and the grant are real; the caller offers an ordinary sign-in.
    expect(body.account).toMatchObject({ userId: 'user-1' })
  })

  it('refuses a password shorter than the sign-up form allows', async () => {
    const { status } = await post(
      { sessionId: GUEST_SESSION, code: '123456', password: 'short' },
      guestCookie(GUEST_SESSION),
    )
    expect(status).toBe(400)
    expect(mocks.ensure).not.toHaveBeenCalled()
  })

  it('ignores a password sent with an unproven session id', async () => {
    // A report link is reachable by anyone holding the session id. Without the
    // cookie, a password arriving on that path is not a field anybody typed,
    // and no account is made for it to go on.
    await post({ sessionId: 'session-1', code: '123456', password: 'longenough1' })

    expect(mocks.ensure).not.toHaveBeenCalled()
    expect(mocks.signIn).not.toHaveBeenCalled()
  })
})

describe('C3: the guest who proves the consultation was theirs', () => {
  const OWNED = { sessionId: GUEST_SESSION, code: '123456', password: 'longenough1' }

  it('sets the password, stores the mobile and dates the clock from the consultation', async () => {
    mocks.sessionStartedAt = '2026-09-11T09:00:00.000Z'

    const { body } = await post(
      { ...OWNED, phone: '07700 900123' },
      guestCookie(GUEST_SESSION),
    )

    expect(mocks.ensure).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        source: 'guest_reveal',
        password: 'longenough1',
        phone: '+447700900123',
        // The five days run from the consultation just sat, not from the
        // sign-up, and not from whenever they next open a station.
        windowStartsAt: new Date('2026-09-11T09:00:00.000Z'),
      }),
    )
    // And on the lead row the founder actually calls off.
    expect(mocks.updates[0]).toMatchObject({ phone: '+447700900123' })
    expect(body.ok).toBe(true)
  })

  it('sends them to the report of that consultation, inside the dashboard', async () => {
    const { body } = await post(OWNED, guestCookie(GUEST_SESSION))
    expect(body.redirectTo).toBe(`/clinical-master/feedback/${GUEST_SESSION}`)
  })

  it('starts the clock now when the row has no start time to read', async () => {
    mocks.sessionStartedAt = null
    const before = Date.now()

    await post(OWNED, guestCookie(GUEST_SESSION))

    const { windowStartsAt } = mocks.ensure.mock.calls[0][1] as { windowStartsAt: Date }
    expect(windowStartsAt.getTime()).toBeGreaterThanOrEqual(before)
  })

  it('still makes the account when the consultation was too short to mark', async () => {
    // `unmarkable` is a property of the session, not of the verification. The
    // account is worth having either way — it is the other four cases.
    mocks.sessionStatus = 'unmarkable'
    mocks.sessionStartedAt = '2026-09-11T09:00:00.000Z'

    const { status, body } = await post(OWNED, guestCookie(GUEST_SESSION))

    expect(status).toBe(200)
    expect(body.account).toMatchObject({ userId: 'user-1' })
    expect(body.trial.granted).toBe(true)
    expect(body.signedIn).toBe(true)
  })
})

describe('C3: every way of not having the proof is main’s report gate', () => {
  const claimed = () => mocks.ensure.mock.calls[0][1] as Record<string, unknown>

  /** Verified, the report opens on /try/feedback, and nothing else happened. */
  function expectReportGateOnly(body: Record<string, unknown>) {
    expect(body).toEqual({
      ok: true,
      account: null,
      trial: { state: 'none', granted: false },
      signedIn: false,
      redirectTo: `/try/feedback/${GUEST_SESSION}`,
    })
    // No account, no claim, no password, no session cookies.
    expect(mocks.ensure).not.toHaveBeenCalled()
    expect(mocks.signIn).not.toHaveBeenCalled()
  }

  it('no cookie at all: the lead is verified and the report opens, nothing more', async () => {
    const { status, body } = await post({
      sessionId: GUEST_SESSION,
      code: '123456',
      password: 'longenough1',
      phone: '07700 900123',
    })

    expect(status).toBe(200)
    expectReportGateOnly(body)
    expect(mocks.updates[0].email_verified_at).toEqual(expect.any(String))
    expect(mocks.updates[0]).not.toHaveProperty('phone')
    // A verified lead reaches the marketing list, as it did on main.
    expect(mocks.brevo).toHaveBeenCalledOnce()
  })

  it('a forged cookie is no cookie', async () => {
    // Same payload, one byte of signature changed: `readGuestCookie` returns
    // null and the branch falls back, which is the whole point of signing it.
    const real = guestCookie(GUEST_SESSION)
    const forged = `${real.slice(0, -1)}${real.endsWith('A') ? 'B' : 'A'}`

    const { body } = await post(
      { sessionId: GUEST_SESSION, code: '123456', password: 'longenough1' },
      forged,
    )

    expectReportGateOnly(body)
  })

  it('a valid cookie for somebody else’s session is no cookie', async () => {
    const other = '22222222-2222-4222-8222-222222222222'

    const { body } = await post(
      { sessionId: GUEST_SESSION, code: '123456', password: 'longenough1' },
      guestCookie(other),
    )

    expectReportGateOnly(body)
  })

  it('an already-verified lead on an old link just opens again', async () => {
    mocks.lead = { ...VERIFIABLE_LEAD, email_verified_at: new Date().toISOString() }

    const { body } = await post({ sessionId: GUEST_SESSION, code: '123456' })

    expectReportGateOnly(body)
    expect(mocks.updates).toHaveLength(0)
  })

  it('the dashboard door needs no cookie and is untouched by any of this', async () => {
    await post({ email: 'sarah@nhs.net', code: '123456' })

    expect(claimed()).toMatchObject({
      source: 'signup',
      // No consultation behind it, so no clock to start.
      windowStartsAt: null,
    })
  })
})

describe('where they land next', () => {
  it('the dashboard door lands on the dashboard', async () => {
    const { body } = await post({ email: 'sarah@nhs.net', code: '123456' })
    expect(body.redirectTo).toBe('/dashboard')
  })

  it.each([
    '2b0d9a5e-0000-4000-8000-000000000000',
    'https://evil.example.com',
    '//evil.example.com',
  ])('ignores a station of %s: nothing carries one through any more', async (station) => {
    // The account-first form that sent one was retired, and a client-supplied
    // value is never turned into a URL the browser follows.
    const { body } = await post({ email: 'sarah@nhs.net', code: '123456', station })
    expect(body.redirectTo).toBe('/dashboard')
  })

  it.each([
    'https://evil.example.com',
    '../../dashboard',
    'not-a-uuid',
  ])('builds no report redirect out of a session id of %s', async (sessionId) => {
    const { body } = await post({ sessionId, code: '123456' }, guestCookie(sessionId))
    expect(body.redirectTo).toBe('/dashboard')
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

    const { status, body } = await post(
      { sessionId: GUEST_SESSION, code: '123456' },
      guestCookie(GUEST_SESSION),
    )

    expect(status).toBe(200)
    expect(body.ok).toBe(true)
    expect(mocks.ensure).toHaveBeenCalledOnce()
    expect(body.account).toBeNull()
    expect(body.trial).toEqual({ state: 'none', granted: false })
    // Nothing to sign in to, so nothing was asked of GoTrue.
    expect(mocks.signIn).not.toHaveBeenCalled()
    expect(body.signedIn).toBe(false)
  })

  it('survives ensureTrialAccount throwing outright', async () => {
    mocks.ensure.mockRejectedValue(new Error('network'))

    const { status, body } = await post(
      { sessionId: GUEST_SESSION, code: '123456' },
      guestCookie(GUEST_SESSION),
    )

    expect(status).toBe(200)
    expect(body.ok).toBe(true)
    expect(body.account).toBeNull()
  })
})

describe('an already-verified lead', () => {
  const VERIFIED = { ...VERIFIABLE_LEAD, email_verified_at: new Date().toISOString() }

  it('is granted anyway, so a reload does not strand a trialist without a grant', async () => {
    // A reload or a second tab in the browser that ran it, which is the reason
    // it is not a bare `return { ok: true }`.
    mocks.lead = { ...VERIFIED }

    const { body } = await post(
      { sessionId: GUEST_SESSION, code: '123456' },
      guestCookie(GUEST_SESSION),
    )

    expect(body.ok).toBe(true)
    expect(mocks.ensure).toHaveBeenCalledOnce()
    // Nothing re-verified, nothing re-pushed to the marketing list.
    expect(mocks.updates).toHaveLength(0)
    expect(mocks.brevo).not.toHaveBeenCalled()
  })

  it('still has to know the code: a wrong one provisions nothing and signs nobody in', async () => {
    // The shortcut used to return settleTrialAccount without comparing the
    // digits at all. Since C3 that path sets a PASSWORD and establishes a
    // session, so anyone holding a verified lead's session id could have walked
    // into the account.
    mocks.lead = { ...VERIFIED }

    const { status, body } = await post(
      { sessionId: GUEST_SESSION, code: '999999', password: 'longenough1' },
      guestCookie(GUEST_SESSION),
    )

    expect(status).toBe(401)
    expect(body.ok).toBeUndefined()
    expect(mocks.ensure).not.toHaveBeenCalled()
    expect(mocks.signIn).not.toHaveBeenCalled()
    // The attempt is counted, so brute force runs out the same way.
    expect(mocks.updates[0]).toEqual({ verification_attempts: 1 })
  })

  it('and on the dashboard door too', async () => {
    mocks.lead = { ...VERIFIED }

    const { status } = await post({
      email: 'sarah@nhs.net',
      code: '999999',
      password: 'longenough1',
    })

    expect(status).toBe(401)
    expect(mocks.ensure).not.toHaveBeenCalled()
    expect(mocks.signIn).not.toHaveBeenCalled()
  })

  it('accepts the same still-valid code twice, which is what a double-submit is', async () => {
    mocks.lead = { ...VERIFIED }

    const first = await post({ sessionId: GUEST_SESSION, code: '123456' }, guestCookie(GUEST_SESSION))
    const second = await post({ sessionId: GUEST_SESSION, code: '123456' }, guestCookie(GUEST_SESSION))

    expect(first.status).toBe(200)
    expect(second.status).toBe(200)
    expect(mocks.ensure).toHaveBeenCalledTimes(2)
  })

  it('has nothing to accept once the code is spent: 410, not a free pass', async () => {
    mocks.lead = {
      ...VERIFIED,
      verification_code_hash: null,
      verification_expires_at: null,
    }

    const { status, body } = await post(
      { sessionId: GUEST_SESSION, code: '123456', password: 'longenough1' },
      guestCookie(GUEST_SESSION),
    )

    expect(status).toBe(410)
    expect(body.error).toBe('Request a new code')
    expect(mocks.ensure).not.toHaveBeenCalled()
  })

  it('refuses an expired code even though the address is verified', async () => {
    mocks.lead = {
      ...VERIFIED,
      verification_expires_at: new Date(Date.now() - 1000).toISOString(),
    }

    const { status } = await post({ sessionId: GUEST_SESSION, code: '123456' })
    expect(status).toBe(410)
    expect(mocks.ensure).not.toHaveBeenCalled()
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

describe('C3: attaching the consultation that was just sat', () => {
  it('names it to the claim when the cookie proves it', async () => {
    // The claim normally follows trial_leads.session_id. A returning trainee's
    // verified lead still points at their FIRST consultation, so this one has
    // to be named directly or it stays ownerless.
    await post({ sessionId: GUEST_SESSION, code: '123456' }, guestCookie(GUEST_SESSION))

    expect(mocks.ensure).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ claimSessionId: GUEST_SESSION }),
    )
  })

  it('claims nothing at all without the proof, because no account is made', async () => {
    // A link on its own must never be able to turn a consultation into anybody's
    // account. The claim runs inside ensureTrialAccount, which is not reached.
    await post({ sessionId: GUEST_SESSION, code: '123456' })

    expect(mocks.ensure).not.toHaveBeenCalled()
  })

  it('and never on the dashboard door, which has no consultation', async () => {
    await post({ email: 'sarah@nhs.net', code: '123456' })

    expect(mocks.ensure).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ claimSessionId: null }),
    )
  })
})

describe('a returning trainee whose lead is on an older consultation', () => {
  it('is found by address once the session finds nothing — but only with the cookie', async () => {
    mocks.noLeadForSession = true
    mocks.lead = { ...VERIFIABLE_LEAD, email_verified_at: new Date().toISOString() }

    const { status } = await post(
      { sessionId: GUEST_SESSION, email: 'Sarah@NHS.net', code: '123456' },
      guestCookie(GUEST_SESSION),
    )

    expect(status).toBe(200)
    // The session was asked first and the address only after it came back empty.
    expect(mocks.filters).toEqual([
      { column: 'session_id', value: GUEST_SESSION },
      { column: 'email', value: 'sarah@nhs.net' },
    ])
    expect(mocks.ensure).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        source: 'guest_reveal',
        email: 'sarah@nhs.net',
        claimSessionId: GUEST_SESSION,
      }),
    )
  })

  it('is not reachable by a bare session id and a guessed address', async () => {
    mocks.noLeadForSession = true
    mocks.lead = { ...VERIFIABLE_LEAD, email_verified_at: new Date().toISOString() }

    const { status } = await post({
      sessionId: GUEST_SESSION,
      email: 'sarah@nhs.net',
      code: '123456',
      password: 'longenough1',
    })

    expect(status).toBe(404)
    expect(mocks.filters).toEqual([{ column: 'session_id', value: GUEST_SESSION }])
    expect(mocks.ensure).not.toHaveBeenCalled()
  })

  it('does not consult the address when the session found its own lead', async () => {
    await post(
      { sessionId: GUEST_SESSION, email: 'attacker@example.com', code: '123456' },
      guestCookie(GUEST_SESSION),
    )

    expect(mocks.filters).toEqual([{ column: 'session_id', value: GUEST_SESSION }])
    expect(mocks.ensure).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ email: 'sarah@nhs.net' }),
    )
  })
})

describe('the founders’ lead alert', () => {
  it('goes out when a guest finishes the sign-up in the browser that ran it', async () => {
    mocks.lead = { ...VERIFIABLE_LEAD, station_id: 'station-9' }

    const { status } = await post(
      { sessionId: GUEST_SESSION, code: '123456', password: 'longenough1', phone: '07700 900123' },
      guestCookie(GUEST_SESSION),
    )

    expect(status).toBe(200)
    expect(mocks.leadAlert).toHaveBeenCalledOnce()
    const [, sessionId, lead, door] = mocks.leadAlert.mock.calls[0]
    expect(sessionId).toBe(GUEST_SESSION)
    expect(door).toBe('guest_signup')
    // The lead's details, with the mobile they have just typed.
    expect(lead).toMatchObject({
      email: 'sarah@nhs.net',
      first_name: 'Sarah',
      training_stage: 'st3',
      station_id: 'station-9',
      phone: '+447700900123',
    })
  })

  it('goes out when somebody verifies through the gate on an old report link', async () => {
    await post({ sessionId: GUEST_SESSION, code: '123456' })

    expect(mocks.leadAlert).toHaveBeenCalledOnce()
    expect(mocks.leadAlert.mock.calls[0][3]).toBe('report_link')
  })

  it('rides on an UPDATE conditional on the lead not being verified yet', async () => {
    // That condition is what makes it once per lead, across instances.
    await post({ sessionId: GUEST_SESSION, code: '123456' }, guestCookie(GUEST_SESSION))
    expect(mocks.updateConditions).toContain('email_verified_at is null')
  })

  it('is not sent twice when another request verified the lead first', async () => {
    // A double submit racing itself: this request's UPDATE matched no row.
    mocks.verifiedRows = []

    const { status } = await post(
      { sessionId: GUEST_SESSION, code: '123456' },
      guestCookie(GUEST_SESSION),
    )

    expect(status).toBe(200)
    expect(mocks.leadAlert).not.toHaveBeenCalled()
  })

  it('is not sent again for a lead that was already verified', async () => {
    // A reload, a second tab, or a returning trainee verified long ago.
    mocks.lead = { ...VERIFIABLE_LEAD, email_verified_at: new Date().toISOString() }

    await post({ sessionId: GUEST_SESSION, code: '123456' }, guestCookie(GUEST_SESSION))
    await post({ sessionId: GUEST_SESSION, code: '123456' })

    expect(mocks.leadAlert).not.toHaveBeenCalled()
  })

  it('is not sent for a wrong code', async () => {
    await post({ sessionId: GUEST_SESSION, code: '999999' }, guestCookie(GUEST_SESSION))
    expect(mocks.leadAlert).not.toHaveBeenCalled()
  })

  it('is not sent from the dashboard door, which has no consultation behind it', async () => {
    await post({ email: 'sarah@nhs.net', code: '123456' })
    expect(mocks.leadAlert).not.toHaveBeenCalled()
  })
})
