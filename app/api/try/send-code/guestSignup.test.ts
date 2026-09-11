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
 *
 * And, since 11 September, a fourth: a VERIFIED lead is never un-verified and
 * never re-pointed by a caller who cannot prove the new session is theirs. That
 * row is the only link between an address and the consultations it has sat.
 */

process.env.TRIAL_GUEST_COOKIE_SECRET = 'test-secret'

const mocks = vi.hoisted(() => ({
  sendEmail: vi.fn(),
  /** The `clinical_sessions` row, or null for "no such session". */
  session: null as Record<string, unknown> | null,
  /** The lead keyed by this session, and the one keyed by the address. */
  leadBySession: null as Record<string, unknown> | null,
  leadByEmail: null as Record<string, unknown> | null,
  writes: [] as Record<string, unknown>[],
  deletes: [] as unknown[],
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
    from: (table: string) => {
      // Which lead comes back depends on WHICH key was asked for: the route
      // reads the row for this session and the row for this address, and the
      // whole verified-lead question is what happens when they differ.
      const filters: Record<string, unknown> = {}
      const builder = {
        select: () => builder,
        eq: (column: string, value: unknown) => {
          filters[column] = value
          return builder
        },
        maybeSingle: async () => {
          if (table === 'clinical_sessions') return { data: mocks.session, error: null }
          return {
            data: 'session_id' in filters ? mocks.leadBySession : mocks.leadByEmail,
            error: null,
          }
        },
        upsert: async (values: Record<string, unknown>) => {
          mocks.writes.push(values)
          return { error: null }
        },
        update: (values: Record<string, unknown>) => {
          mocks.writes.push(values)
          return { eq: async () => ({ error: null }) }
        },
        delete: () => ({
          eq: async (_column: string, value: unknown) => {
            mocks.deletes.push(value)
            return { error: null }
          },
        }),
      }
      return builder
    },
  }),
}))

const { POST } = await import('./route')
// The real signer: a test that forged its own cookies would prove nothing
// about the only thing the verified-lead guard rests on.
const { signGuestCookie, withGuestSession } = await import('@/lib/trial/guestSession')

const SESSION_ID = '33333333-3333-4333-8333-333333333333'
const STATION_ID = '44444444-4444-4444-8444-444444444444'
/** The session the returning trainee's lead was verified against, months ago. */
const OLD_SESSION_ID = '55555555-5555-4555-8555-555555555555'

/** The cookie this server would have written when it opened `sessionId`. */
function heldCookie(sessionId = SESSION_ID): string {
  return signGuestCookie(withGuestSession(null, sessionId, Math.floor(Date.now() / 1000)))!
}

/** Every call gets its own client address, so the per-IP brake never crosses tests. */
let addresses = 0

async function post(
  body: Record<string, unknown>,
  options: { cookie?: string; ip?: string } = {},
) {
  addresses += 1
  const request = new Request('https://www.fourteenfisherman.com/api/try/send-code', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-forwarded-for': options.ip ?? `203.0.113.${addresses}`,
    },
    body: JSON.stringify(body),
  })
  Object.assign(request, {
    cookies: {
      get: (name: string) =>
        options.cookie && name === 'ff_guest' ? { value: options.cookie } : undefined,
    },
  })
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const response = await POST(request as any)
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
  vi.spyOn(console, 'warn').mockImplementation(() => {})
  mocks.session = { id: SESSION_ID, user_id: null, station_id: STATION_ID }
  mocks.leadBySession = null
  mocks.leadByEmail = null
  mocks.writes = []
  mocks.deletes = []
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

describe('a lead that is already verified', () => {
  /** Sarah verified months ago, against a different consultation. */
  const VERIFIED_ELSEWHERE = {
    id: 'lead-1',
    session_id: OLD_SESSION_ID,
    station_id: 'a-station-from-back-then',
    verification_last_sent_at: null,
    email_verified_at: '2026-07-01T10:00:00.000Z',
  }

  it('is not touched by a caller who cannot prove the new session is theirs', async () => {
    // Typing a known address next to any unowned session id used to null that
    // row's `email_verified_at` and move it here — losing the real owner their
    // claim on the consultation they actually sat, and attaching their address
    // to somebody else's work.
    mocks.leadByEmail = { ...VERIFIED_ELSEWHERE }

    const { status, body } = await post({
      sessionId: SESSION_ID,
      mode: 'guest_signup',
      email: 'sarah@nhs.net',
    })

    expect(status).toBe(403)
    expect(body.code).toBe('guest_session_unrecognised')
    expect(mocks.writes).toHaveLength(0)
    expect(mocks.deletes).toHaveLength(0)
    expect(mocks.sendEmail).not.toHaveBeenCalled()
  })

  it('gets a new code in its own browser, and keeps both its verification and its session', async () => {
    // The legitimate case: the same trainee, in the browser that ran this
    // consultation, coming back for another free case.
    mocks.leadByEmail = { ...VERIFIED_ELSEWHERE }

    const { status } = await post(
      { sessionId: SESSION_ID, mode: 'guest_signup', email: 'sarah@nhs.net' },
      { cookie: heldCookie() },
    )

    expect(status).toBe(200)
    expect(mocks.sendEmail).toHaveBeenCalledOnce()

    const written = mocks.writes[0]
    // Never un-verified: the claim on their first consultation depends on it.
    expect(written).not.toHaveProperty('email_verified_at')
    // And never re-pointed: the new session is attached by verify-code instead.
    expect(written.session_id).toBe(OLD_SESSION_ID)
    expect(written.station_id).toBe('a-station-from-back-then')
    expect(written.verification_code_hash).toEqual(expect.any(String))
  })

  it('deletes nothing belonging to the session it is not moving to', async () => {
    mocks.leadByEmail = { ...VERIFIED_ELSEWHERE }
    mocks.leadBySession = { id: 'lead-2', verification_last_sent_at: null }

    await post(
      { sessionId: SESSION_ID, mode: 'guest_signup', email: 'sarah@nhs.net' },
      { cookie: heldCookie() },
    )

    expect(mocks.deletes).toHaveLength(0)
  })

  it('still un-verifies nothing when the lead is already on this session', async () => {
    mocks.leadByEmail = { ...VERIFIED_ELSEWHERE, session_id: SESSION_ID }
    mocks.leadBySession = { ...VERIFIED_ELSEWHERE, session_id: SESSION_ID }

    const { status } = await post({
      sessionId: SESSION_ID,
      mode: 'guest_signup',
      email: 'sarah@nhs.net',
    })

    expect(status).toBe(200)
    expect(mocks.writes[0]).not.toHaveProperty('email_verified_at')
  })
})

describe('the per-IP brake', () => {
  it('stops one client mailing code after code from a single finished session', async () => {
    // A real session id bounds how many SESSIONS a client can have, not how
    // many addresses it can mail from one of them — resends are throttled per
    // lead row, and each new address is a new row.
    const ip = '198.51.100.7'
    const statuses: number[] = []
    for (let attempt = 0; attempt < 14; attempt += 1) {
      const { status, body } = await post(
        { sessionId: SESSION_ID, mode: 'guest_signup', email: `t${attempt}@nhs.net` },
        { ip },
      )
      statuses.push(status)
      if (status === 429) {
        expect(body.code).toBe('guest_ip_limit')
        break
      }
    }

    expect(statuses).toContain(429)
    expect(statuses.filter((status) => status === 200).length).toBeLessThanOrEqual(12)
  })
})
