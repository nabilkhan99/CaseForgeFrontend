import { beforeEach, describe, expect, it, vi } from 'vitest'

/**
 * The /try side-door.
 *
 * The middleware turns signed-in visitors away from the /try PAGES, but the
 * pages are the cheap half. These two routes run on the service role precisely
 * because a guest has no session, so before this guard any signed-in account
 * could POST straight at them: spend an Azure gpt-realtime consultation
 * outside their entitlement, and leave the result in a `clinical_sessions` row
 * owned by nobody — invisible from the dashboard they pay for.
 *
 * Both directions are pinned. A genuine guest must still get through, or the
 * guard has broken the funnel it was meant to protect.
 */

process.env.TRIAL_GUEST_COOKIE_SECRET = 'test-secret'

const mocks = vi.hoisted(() => ({
  getUser: vi.fn(),
  admin: vi.fn(),
  mintEphemeralKey: vi.fn(),
}))

vi.mock('server-only', () => ({}))

vi.mock('@/lib/supabase/server', () => ({
  createClient: async () => ({ auth: { getUser: mocks.getUser } }),
}))

vi.mock('@/lib/supabase/admin', () => ({
  getSupabaseAdmin: mocks.admin,
}))

vi.mock('@/lib/clinical-master/realtimeToken', () => ({
  mintEphemeralKey: mocks.mintEphemeralKey,
  unreliableEchoCancellation: () => false,
}))

vi.mock('@/lib/clinical-master/realtimeSession', () => ({
  voiceForStation: () => 'verse',
}))

const { POST: createSession } = await import('./create-session/route')
const { POST: realtimeToken } = await import('./realtime-token/route')
const { signGuestCookie, withGuestSession } = await import('@/lib/trial/guestSession')

type Handler = (req: Request) => Promise<Response>

/** The cookie /try/talk would have issued for this session. */
function guestCookie(): string {
  return signGuestCookie(withGuestSession(null, 's1', Math.floor(Date.now() / 1000)))!
}

function request(path: string, cookie: string | null = guestCookie()) {
  const req = new Request(`https://www.fourteenfisherman.com${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ sessionId: 's1', stationId: 'st1' }),
  })
  // NextRequest's cookie jar. The handlers read it to check the guest binding.
  Object.defineProperty(req, 'cookies', {
    value: { get: (name: string) => (cookie && name === 'ff_guest' ? { value: cookie } : undefined) },
  })
  return req
}

/**
 * Minimal service-role stand-in: an active station and the guest session the
 * funnel opened against it. Just enough for a guest call to get past the guard
 * and do real work.
 */
function guestStore() {
  const station = { id: 'st1', is_active: true, consultation_duration_seconds: 480 }
  const session = {
    id: 's1',
    user_id: null,
    status: 'reading',
    started_at: new Date().toISOString(),
    station_id: 'st1',
  }
  return {
    from: (table: string) => {
      const data = table === 'stations' ? station : session
      const builder = {
        select: () => builder,
        eq: () => builder,
        single: async () => ({ data, error: null }),
        maybeSingle: async () => ({ data, error: null }),
        insert: async () => ({ error: null }),
        update: () => builder,
      }
      return builder
    },
  }
}

beforeEach(() => {
  vi.clearAllMocks()
  vi.spyOn(console, 'error').mockImplementation(() => {})
  mocks.getUser.mockResolvedValue({ data: { user: null } })
  mocks.admin.mockReturnValue(guestStore())
  mocks.mintEphemeralKey.mockResolvedValue({ ephemeralKey: 'ek_1', callsUrl: 'https://azure/calls' })
})

// The handlers are typed against NextRequest; a plain Request carries
// everything they actually read (url, json()), so the cast is safe here.
const routes: Array<[string, Handler, string]> = [
  ['create-session', createSession as unknown as Handler, '/api/try/create-session'],
  ['realtime-token', realtimeToken as unknown as Handler, '/api/try/realtime-token'],
]

describe.each(routes)('POST /api/try/%s', (_name, handler, path) => {
  it('refuses a signed-in caller and does no work', async () => {
    mocks.getUser.mockResolvedValue({ data: { user: { id: 'user-1', email: 'jane@nhs.net' } } })

    const response = await handler(request(path))

    expect(response.status).toBe(403)
    expect(await response.json()).toEqual({
      error: 'signed_in',
      message: "You're signed in — your consultations live in your dashboard.",
    })
    // Nothing touched the database, and above all nothing minted a key.
    expect(mocks.admin).not.toHaveBeenCalled()
    expect(mocks.mintEphemeralKey).not.toHaveBeenCalled()
  })

  it('lets a genuine guest straight through', async () => {
    const response = await handler(request(path))

    expect(response.status).toBe(200)
  })

  it('treats the caller as a guest when the auth lookup itself breaks', async () => {
    // Fail open. Almost every caller here has no session cookie at all; a
    // transient auth failure must not take the free funnel down.
    mocks.getUser.mockRejectedValue(new Error('gotrue down'))

    const response = await handler(request(path))

    expect(response.status).toBe(200)
  })
})

/**
 * The guest-only guard is not the only thing between an anonymous caller and
 * an Azure key any more. Being a guest is necessary; having been handed the
 * session by the funnel is the rest of it. See lib/trial/guestSession.ts.
 */
it('refuses an anonymous mint that the funnel never issued', async () => {
  vi.spyOn(console, 'warn').mockImplementation(() => {})

  const response = await realtimeToken(request('/api/try/realtime-token', null) as never)

  expect(response.status).toBe(403)
  expect((await response.json()).code).toBe('guest_cookie_missing')
  expect(mocks.mintEphemeralKey).not.toHaveBeenCalled()
})
