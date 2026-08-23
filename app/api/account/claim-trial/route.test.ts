import { beforeEach, describe, expect, it, vi } from 'vitest'

/**
 * The route's whole job is to be un-widenable: it takes no input, and the only
 * id it ever passes down is the caller's own. Pinned here because the helper it
 * calls is powerful — it reassigns ownership of consultations with the service
 * role — and the only thing standing between that and someone else's free mock
 * is that this route never lets the client choose the owner.
 */

const mocks = vi.hoisted(() => ({
  getUser: vi.fn(),
  claimTrialSessionsForUser: vi.fn(),
  admin: { marker: 'service-role-client' },
}))

vi.mock('server-only', () => ({}))

vi.mock('@/lib/supabase/server', () => ({
  createClient: async () => ({ auth: { getUser: mocks.getUser } }),
}))

vi.mock('@/lib/supabase/admin', () => ({
  getSupabaseAdmin: () => mocks.admin,
}))

vi.mock('@/lib/auth/claimTrialSessions', () => ({
  claimTrialSessionsForUser: mocks.claimTrialSessionsForUser,
}))

const { POST } = await import('./route')

async function post() {
  const response = await POST()
  return { status: response.status, body: await response.json() }
}

beforeEach(() => {
  vi.clearAllMocks()
  vi.spyOn(console, 'error').mockImplementation(() => {})
  mocks.getUser.mockResolvedValue({ data: { user: { id: 'user-1', email: 'jane@nhs.net' } } })
  mocks.claimTrialSessionsForUser.mockResolvedValue(1)
})

describe('POST /api/account/claim-trial', () => {
  it('claims for the signed-in caller and nobody else', async () => {
    const { status, body } = await post()

    expect(status).toBe(200)
    expect(body).toEqual({ claimed: 1 })
    // The id and the email both come from the session, never from a request
    // body — there is no way for a caller to name a different owner.
    expect(mocks.claimTrialSessionsForUser).toHaveBeenCalledWith(
      mocks.admin,
      'user-1',
      'jane@nhs.net',
    )
  })

  it('rejects an anonymous caller without touching the claim', async () => {
    mocks.getUser.mockResolvedValue({ data: { user: null } })

    const { status } = await post()

    expect(status).toBe(401)
    expect(mocks.claimTrialSessionsForUser).not.toHaveBeenCalled()
  })

  it('answers a quiet zero when the claim fails', async () => {
    // The dashboard renders identically either way, so a failure here is not
    // something the UI should have to explain.
    mocks.claimTrialSessionsForUser.mockRejectedValue(new Error('boom'))

    expect(await post()).toEqual({ status: 200, body: { claimed: 0 } })
  })
})
