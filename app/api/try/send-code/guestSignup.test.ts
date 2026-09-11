import { beforeEach, describe, expect, it, vi } from 'vitest'

/**
 * The guest door's second shape: `mode: 'guest_signup'`.
 *
 * The post-consultation page (/try/feedback/[sessionId], contract C4) asks for
 * an address, a mobile and a password while the mark runs. The nine-step
 * questionnaire the legacy gate asked is gone from that screen — it is asked on
 * the dashboard instead — so the validator this door runs had to relax. Three
 * things have to stay true while it does, and each of them is a way the funnel
 * could quietly break:
 *
 *  1. the SESSION check is untouched. It is what bounds this door's abuse
 *     surface — a real, unowned `clinical_sessions` row costs a consultation to
 *     create — and no `mode` string may weaken it;
 *  2. the LEGACY gate keeps its strict validation. It asks every question, so a
 *     gap there is still a bug, not an answer withheld;
 *  3. the relaxed path OMITS what it was not told rather than nulling it, so a
 *     second visit cannot erase what a first one collected.
 */

const mocks = vi.hoisted(() => ({
  sendEmail: vi.fn(),
  /** The `clinical_sessions` row, or null for "no such session". */
  session: null as Record<string, unknown> | null,
  lead: null as Record<string, unknown> | null,
  writes: [] as Record<string, unknown>[],
}))

vi.mock('server-only', () => ({}))

vi.mock('@/lib/auth/accountSignUp', () => ({
  findAccountByEmail: async () => null,
}))

vi.mock('@/lib/email/verificationEmail', () => ({
  sendVerificationEmail: (...args: unknown[]) => mocks.sendEmail(...args),
}))

vi.mock('@/lib/supabase/admin', () => ({
  getSupabaseAdmin: () => ({
    from: (table: string) => ({
      select: () => ({
        eq: () => ({
          maybeSingle: async () => ({
            data: table === 'clinical_sessions' ? mocks.session : mocks.lead,
            error: null,
          }),
        }),
      }),
      upsert: async (values: Record<string, unknown>) => {
        mocks.writes.push(values)
        return { error: null }
      },
      update: (values: Record<string, unknown>) => {
        mocks.writes.push(values)
        return { eq: async () => ({ error: null }) }
      },
      delete: () => ({ eq: async () => ({ error: null }) }),
    }),
  }),
}))

const { POST } = await import('./route')

const SESSION_ID = '33333333-3333-4333-8333-333333333333'
const STATION_ID = '44444444-4444-4444-8444-444444444444'

async function post(body: Record<string, unknown>) {
  const response = await POST(
    new Request('https://www.fourteenfisherman.com/api/try/send-code', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    }) as any,
  )
  return { status: response.status, body: await response.json() }
}

/** What the legacy gate posts: every question answered. */
const FULL_ANSWERS = {
  sessionId: SESSION_ID,
  email: 'sarah@nhs.net',
  firstName: 'Sarah',
  phone: '07700900123',
  trainingStage: 'st3',
  trainingStartMonth: '08',
  trainingStartYear: '2024',
  aktStatus: 'passed',
  scaStatus: 'passed',
}

beforeEach(() => {
  vi.clearAllMocks()
  vi.spyOn(console, 'error').mockImplementation(() => {})
  mocks.session = { id: SESSION_ID, user_id: null, station_id: STATION_ID }
  mocks.lead = null
  mocks.writes = []
  mocks.sendEmail.mockResolvedValue({ sent: true })
})

describe('the post-call form', () => {
  it('sends a code for an address alone — no questionnaire', async () => {
    const { status, body } = await post({
      sessionId: SESSION_ID,
      mode: 'guest_signup',
      email: 'Sarah@NHS.net',
      phone: '07700 900123',
    })

    expect(status).toBe(200)
    expect(body.ok).toBe(true)
    expect(mocks.sendEmail).toHaveBeenCalledWith(
      expect.objectContaining({ toEmail: 'sarah@nhs.net' }),
    )
  })

  it('writes the lead against the consultation, with the mobile in E.164', async () => {
    await post({
      sessionId: SESSION_ID,
      mode: 'guest_signup',
      email: 'sarah@nhs.net',
      phone: '07700 900123',
    })

    expect(mocks.writes[0]).toMatchObject({
      session_id: SESSION_ID,
      station_id: STATION_ID,
      email: 'sarah@nhs.net',
      phone: '+447700900123',
      email_verified_at: null,
    })
  })

  it('omits the questions it did not ask rather than nulling them', async () => {
    // A lead may already carry answers from an earlier visit. Nulling here
    // would erase them for the sake of a form that never asked.
    await post({ sessionId: SESSION_ID, mode: 'guest_signup', email: 'sarah@nhs.net' })

    const written = mocks.writes[0]
    expect(written).not.toHaveProperty('training_stage')
    expect(written).not.toHaveProperty('sca_sitting')
    expect(written).not.toHaveProperty('not_in_training_role')
    expect(written).not.toHaveProperty('first_name')
  })

  it('still needs a usable address', async () => {
    const { status } = await post({ sessionId: SESSION_ID, mode: 'guest_signup', email: 'nope' })
    expect(status).toBe(400)
    expect(mocks.sendEmail).not.toHaveBeenCalled()
  })

  it('still needs a real, unowned guest consultation', async () => {
    // The mode relaxes the QUESTIONNAIRE and nothing else: this is the check
    // that makes the door cost something to walk through.
    mocks.session = null
    const { status } = await post({
      sessionId: SESSION_ID,
      mode: 'guest_signup',
      email: 'sarah@nhs.net',
    })
    expect(status).toBe(404)

    mocks.session = { id: SESSION_ID, user_id: 'someone', station_id: STATION_ID }
    const owned = await post({
      sessionId: SESSION_ID,
      mode: 'guest_signup',
      email: 'sarah@nhs.net',
    })
    expect(owned.status).toBe(404)
    expect(mocks.sendEmail).not.toHaveBeenCalled()
  })
})

describe('the legacy gate', () => {
  it('still answers a full questionnaire, nulling the branches it skipped', async () => {
    const { status } = await post(FULL_ANSWERS)

    expect(status).toBe(200)
    expect(mocks.writes[0]).toMatchObject({
      first_name: 'Sarah',
      training_stage: 'st3',
      phone: '+447700900123',
      // Asked and not applicable, which is not the same as unasked.
      not_in_training_role: null,
    })
  })

  it('still refuses a request missing the questions it asks', async () => {
    const { status, body } = await post({ sessionId: SESSION_ID, email: 'sarah@nhs.net' })

    expect(status).toBe(400)
    expect(body.error).toBeTruthy()
    expect(mocks.sendEmail).not.toHaveBeenCalled()
  })

  it('cannot be relaxed by a mode on a request that carries a session', async () => {
    // `mode: 'signup'` is the ACCOUNT-FIRST door and must never turn off the
    // session lookup; only `guest_signup` touches the validator, and it leaves
    // that lookup exactly where it was.
    const { status } = await post({ sessionId: SESSION_ID, mode: 'signup', email: 'a@b.com' })
    expect(status).toBe(400)
  })
})
