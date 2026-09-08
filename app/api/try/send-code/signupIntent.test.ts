import { beforeEach, describe, expect, it, vi } from 'vitest'

/**
 * "You already have an account. Sign in instead."
 *
 * /free/start is a SIGN-UP form, so it is told plainly when the address it was
 * given already belongs to a finished account: mailing a code to somebody who
 * should be typing their password wastes their time, and the screen they would
 * land on afterwards is one they have seen before.
 *
 * Three things make that safe to say out loud, and all three are pinned here:
 *
 *  1. it is OPT-IN, on `intent: 'signup'`. /free/open and the portfolio banner
 *     are for people coming back — turning them away from the code they asked
 *     for would close the door they were using;
 *  2. a `password_pending` account is NOT turned away. That is a lead we
 *     provisioned who never chose a password, and finishing that on this form
 *     is exactly the point;
 *  3. nothing is mailed on the refusal.
 */

const mocks = vi.hoisted(() => ({
  findAccount: vi.fn(),
  sendEmail: vi.fn(),
  lead: null as Record<string, unknown> | null,
  inserts: [] as Record<string, unknown>[],
}))

vi.mock('server-only', () => ({}))

vi.mock('@/lib/auth/accountSignUp', () => ({
  findAccountByEmail: (...args: unknown[]) => mocks.findAccount(...args),
}))

vi.mock('@/lib/email/verificationEmail', () => ({
  sendVerificationEmail: (...args: unknown[]) => mocks.sendEmail(...args),
}))

vi.mock('@/lib/supabase/admin', () => ({
  getSupabaseAdmin: () => ({
    from: () => ({
      select: () => ({
        eq: () => ({ maybeSingle: async () => ({ data: mocks.lead, error: null }) }),
      }),
      insert: async (values: Record<string, unknown>) => {
        mocks.inserts.push(values)
        return { error: null }
      },
      update: () => ({ eq: async () => ({ error: null }) }),
    }),
  }),
}))

const { POST } = await import('./route')

async function post(body: Record<string, unknown>) {
  const response = await POST(
    new Request('https://www.fourteenfisherman.com/api/try/send-code', {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-forwarded-for': randomIp() },
      body: JSON.stringify(body),
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    }) as any,
  )
  return { status: response.status, body: await response.json() }
}

/**
 * A fresh client per call.
 *
 * The sign-up door's per-IP budget lives in module state and is deliberately
 * small (8 an hour), so a file's worth of tests from one address would trip it
 * and start asserting against a 429 instead of the thing under test.
 */
let ip = 0
function randomIp(): string {
  ip += 1
  return `203.0.113.${ip}`
}

beforeEach(() => {
  vi.clearAllMocks()
  mocks.lead = null
  mocks.inserts = []
  mocks.findAccount.mockResolvedValue(null)
  mocks.sendEmail.mockResolvedValue({ sent: true })
})

describe('intent: signup', () => {
  it('turns away an address that already has a finished account', async () => {
    mocks.findAccount.mockResolvedValue({ userId: 'user-7', passwordPending: false })

    const { status, body } = await post({
      mode: 'signup',
      intent: 'signup',
      email: 'sarah@nhs.net',
    })

    expect(status).toBe(409)
    expect(body.accountExists).toBe(true)
    expect(body.error).toBe('You already have an account. Sign in instead.')
    expect(mocks.sendEmail).not.toHaveBeenCalled()
  })

  it('lets a half-provisioned account finish signing up', async () => {
    // A guest-reveal lead has an account with no password on it. This form is
    // where they get one.
    mocks.findAccount.mockResolvedValue({ userId: 'user-7', passwordPending: true })

    const { status } = await post({ mode: 'signup', intent: 'signup', email: 'sarah@nhs.net' })

    expect(status).toBe(200)
    expect(mocks.sendEmail).toHaveBeenCalledOnce()
  })

  it('mails a code to an address nobody has ever used', async () => {
    const { status, body } = await post({
      mode: 'signup',
      intent: 'signup',
      email: 'new@nhs.net',
    })

    expect(status).toBe(200)
    expect(body.ok).toBe(true)
    expect(mocks.inserts[0]).toMatchObject({ email: 'new@nhs.net', email_verified_at: null })
  })
})

describe('without the intent', () => {
  it('mails the code whoever they are — /free/open is for people coming back', async () => {
    mocks.findAccount.mockResolvedValue({ userId: 'user-7', passwordPending: false })

    const { status } = await post({ mode: 'signup', email: 'sarah@nhs.net' })

    expect(status).toBe(200)
    expect(mocks.sendEmail).toHaveBeenCalledOnce()
    // Not even asked: a lookup nobody acts on is a round trip for nothing.
    expect(mocks.findAccount).not.toHaveBeenCalled()
  })
})
