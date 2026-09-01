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

type Handler = (req: Request) => Promise<Response>

function request(path: string) {
  return new Request(`https://www.fourteenfisherman.com${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ sessionId: 's1', stationId: 'st1' }),
  })
}

/**
 * Minimal service-role stand-in: a station that is free-trial and active, and
 * no existing session. Just enough for a guest call to get past the guard and
 * do real work.
 */
function guestStore() {
  const station = { id: 'st1', is_free_trial: true, is_active: true, consultation_duration_seconds: 480 }
  return {
    from: (table: string) => {
      if (table === 'stations') {
        const builder = {
          select: () => builder,
          eq: () => builder,
          single: async () => ({ data: station, error: null }),
          maybeSingle: async () => ({ data: station, error: null }),
        }
        return builder
      }
      const builder = {
        select: () => builder,
        eq: () => builder,
        single: async () => ({ data: null, error: null }),
        maybeSingle: async () => ({ data: null, error: null }),
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
    // Fail open. Almost every caller here has no cookies at all; a transient
    // auth failure must not take the free funnel down.
    mocks.getUser.mockRejectedValue(new Error('gotrue down'))

    const response = await handler(request(path))

    expect(response.status).toBe(200)
  })
})
