import { beforeEach, describe, expect, it, vi } from 'vitest'

/**
 * The case-review sign-off is authorised by the admin's session cookie, so it
 * must refuse a request another site could make the browser send: anything
 * that is not JSON, and anything whose Origin names another host. Neither
 * reaches the session check or the database.
 */

const mocks = vi.hoisted(() => ({
  getAdminEmail: vi.fn(),
  setApproval: vi.fn(),
}))

vi.mock('@/lib/admin/guard', () => ({ getAdminEmail: () => mocks.getAdminEmail() }))
vi.mock('@/lib/supabase/admin', () => ({ getSupabaseAdmin: () => ({}) }))
vi.mock('../../caseReviewData', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../caseReviewData')>()),
  setApproval: (...args: unknown[]) => mocks.setApproval(...args),
}))

const { POST } = await import('./route')

const ID = '11111111-2222-4333-8444-555555555555'

function post(headers: Record<string, string>, body = JSON.stringify({ action: 'approve' })) {
  const request = new Request(`http://localhost/api/admin/case-review/${ID}/approval`, {
    method: 'POST',
    headers,
    body,
  })
  return POST(request as never, { params: Promise.resolve({ id: ID }) })
}

beforeEach(() => {
  mocks.getAdminEmail.mockReset().mockResolvedValue('boss@example.com')
  mocks.setApproval.mockReset().mockResolvedValue({
    ok: true,
    approval: { id: ID, approvedAt: '2026-10-06T00:00:00.000Z', approvedBy: 'boss@example.com' },
  })
})

describe('approval CSRF guard', () => {
  it('signs off a same-origin JSON request from an admin', async () => {
    const res = await post({ 'Content-Type': 'application/json', Origin: 'http://localhost' })
    expect(res.status).toBe(200)
    expect(mocks.setApproval).toHaveBeenCalledOnce()
  })

  it('refuses a cross-site Origin before the session or the database', async () => {
    const res = await post({ 'Content-Type': 'application/json', Origin: 'https://evil.example' })
    expect(res.status).toBe(403)
    expect(mocks.getAdminEmail).not.toHaveBeenCalled()
    expect(mocks.setApproval).not.toHaveBeenCalled()
  })

  it('refuses a form-encoded body (what a cross-site HTML form sends)', async () => {
    const res = await post({ 'Content-Type': 'application/x-www-form-urlencoded' }, 'action=approve')
    expect(res.status).toBe(415)
    expect(mocks.setApproval).not.toHaveBeenCalled()
  })

  it('refuses text/plain JSON (the no-preflight trick)', async () => {
    const res = await post({ 'Content-Type': 'text/plain' })
    expect(res.status).toBe(415)
    expect(mocks.setApproval).not.toHaveBeenCalled()
  })
})
