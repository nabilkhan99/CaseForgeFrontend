import { beforeEach, describe, expect, it, vi } from 'vitest'

/**
 * GET /api/coaching-session/details — the joining link on the student's
 * dashboard. Only a Complete customer with a booked session is looked up.
 */

const mocks = vi.hoisted(() => ({
  user: { id: 'user-1', email: 'student@example.com' } as { id: string; email?: string } | null,
  entitlement: { plan: 'complete', coachingDay: '2026-10-04' } as Record<string, unknown>,
  load: vi.fn(),
}))

vi.mock('server-only', () => ({}))
vi.mock('@/lib/commerce/serverEntitlement', () => ({
  getServerEntitlement: async () => ({ user: mocks.user, entitlement: mocks.entitlement }),
}))
vi.mock('@/lib/commerce/coachingJoinServer', () => ({
  loadCoachingJoinDetails: (...args: unknown[]) => mocks.load(...args),
}))

const { GET } = await import('./route')

const DETAILS = { meetingUrl: 'https://meet.google.com/abc-defg-hij', coachName: 'Dr Hassan Khan' }

beforeEach(() => {
  mocks.user = { id: 'user-1', email: 'student@example.com' }
  mocks.entitlement = { plan: 'complete', coachingDay: '2026-10-04' }
  mocks.load.mockReset()
  mocks.load.mockResolvedValue(DETAILS)
})

describe('GET /api/coaching-session/details', () => {
  it('refuses a signed-out caller', async () => {
    mocks.user = null
    const res = await GET()
    expect(res.status).toBe(401)
    expect(mocks.load).not.toHaveBeenCalled()
  })

  it('returns the booked session details for a Complete customer', async () => {
    const res = await GET()
    expect(res.status).toBe(200)
    expect(res.headers.get('Cache-Control')).toBe('no-store')
    await expect(res.json()).resolves.toEqual(DETAILS)
    expect(mocks.load).toHaveBeenCalledWith('student@example.com', '2026-10-04')
  })

  it('answers nothing set, without a lookup, for a plan with no coaching', async () => {
    mocks.entitlement = { plan: 'self_study', coachingDay: undefined }
    const res = await GET()
    await expect(res.json()).resolves.toEqual({ meetingUrl: null, coachName: null })
    expect(mocks.load).not.toHaveBeenCalled()
  })

  it('answers nothing set for Complete with no session booked yet', async () => {
    mocks.entitlement = { plan: 'complete', coachingDay: null }
    const res = await GET()
    await expect(res.json()).resolves.toEqual({ meetingUrl: null, coachName: null })
    expect(mocks.load).not.toHaveBeenCalled()
  })
})
