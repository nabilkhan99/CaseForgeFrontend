import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

/**
 * The three /api/admin/case-review routes: the guard, input validation and
 * error mapping. The queries are mocked here; caseReviewData.test.ts covers
 * what they read and write. Plus source pins on the pages and the admin
 * front door, which have no DOM test environment in this repo.
 */

const mocks = vi.hoisted(() => ({
  isAdmin: vi.fn(),
  getAdminEmail: vi.fn(),
  getSupabaseAdmin: vi.fn(() => ({})),
  listDrafts: vi.fn(),
  loadDraftReview: vi.fn(),
  setApproval: vi.fn(),
}))

vi.mock('@/lib/admin/guard', () => ({ isAdmin: () => mocks.isAdmin(), getAdminEmail: () => mocks.getAdminEmail() }))
vi.mock('@/lib/supabase/admin', () => ({ getSupabaseAdmin: () => mocks.getSupabaseAdmin() }))
vi.mock('./caseReviewData', async (importOriginal) => ({
  ...(await importOriginal<typeof import('./caseReviewData')>()),
  listDrafts: (...args: unknown[]) => mocks.listDrafts(...args),
  loadDraftReview: (...args: unknown[]) => mocks.loadDraftReview(...args),
  setApproval: (...args: unknown[]) => mocks.setApproval(...args),
}))

const { GET: LIST } = await import('./route')
const { GET: DETAIL } = await import('./[id]/route')
const { POST: APPROVAL } = await import('./[id]/approval/route')

const ID = '11111111-1111-4111-8111-111111111111'
const ADMIN = 'ishaq@example.org'

function params(id: string) {
  return { params: Promise.resolve({ id }) }
}

function post(id: string, body: unknown): [NextRequest, ReturnType<typeof params>] {
  return [
    new NextRequest(`http://localhost/api/admin/case-review/${id}/approval`, {
      method: 'POST',
      body: typeof body === 'string' ? body : JSON.stringify(body),
      headers: { 'Content-Type': 'application/json' },
    }),
    params(id),
  ]
}

beforeEach(() => {
  vi.clearAllMocks()
  mocks.isAdmin.mockResolvedValue(true)
  mocks.getAdminEmail.mockResolvedValue(ADMIN)
  mocks.listDrafts.mockResolvedValue([])
  mocks.loadDraftReview.mockResolvedValue(null)
  mocks.setApproval.mockResolvedValue({ ok: true, approval: { id: ID, approvedAt: '2026-10-05T12:00:00.000Z', approvedBy: ADMIN } })
  vi.spyOn(console, 'error').mockImplementation(() => {})
})

describe('the admin guard', () => {
  it('turns non-admins away from every route before touching data', async () => {
    mocks.isAdmin.mockResolvedValue(false)
    mocks.getAdminEmail.mockResolvedValue(null)
    const responses = await Promise.all([
      LIST(),
      DETAIL(new NextRequest(`http://localhost/api/admin/case-review/${ID}`), params(ID)),
      APPROVAL(...post(ID, { action: 'approve' })),
    ])
    expect(responses.map((r) => r.status)).toEqual([403, 403, 403])
    expect(mocks.getSupabaseAdmin).not.toHaveBeenCalled()
    expect(mocks.listDrafts).not.toHaveBeenCalled()
    expect(mocks.loadDraftReview).not.toHaveBeenCalled()
    expect(mocks.setApproval).not.toHaveBeenCalled()
  })
})

describe('GET /api/admin/case-review', () => {
  it('lists drafts (none today)', async () => {
    const res = await LIST()
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ drafts: [] })
  })

  it('reports a failed load without leaking the error', async () => {
    mocks.listDrafts.mockRejectedValue(new Error('relation does not exist'))
    const res = await LIST()
    expect(res.status).toBe(500)
    expect(await res.json()).toEqual({ error: 'Could not load the draft cases.' })
  })
})

describe('GET /api/admin/case-review/{id}', () => {
  it('400s a malformed id without querying', async () => {
    const res = await DETAIL(new NextRequest('http://localhost/x'), params('nope'))
    expect(res.status).toBe(400)
    expect(mocks.loadDraftReview).not.toHaveBeenCalled()
  })

  it('404s anything that is not a draft', async () => {
    const res = await DETAIL(new NextRequest('http://localhost/x'), params(ID))
    expect(res.status).toBe(404)
  })
})

describe('POST /api/admin/case-review/{id}/approval', () => {
  it('approves as the signed-in admin', async () => {
    const res = await APPROVAL(...post(ID, { action: 'approve' }))
    expect(res.status).toBe(200)
    expect(mocks.setApproval).toHaveBeenCalledWith(expect.anything(), ID, 'approve', ADMIN, expect.any(Date))
  })

  it('withdraws', async () => {
    await APPROVAL(...post(ID, { action: 'withdraw' }))
    expect(mocks.setApproval.mock.calls[0][2]).toBe('withdraw')
  })

  it('rejects any other action, a bad body and a bad id with 400', async () => {
    for (const [id, body] of [[ID, { action: 'go_live' }], [ID, 'not json'], [ID, {}], ['nope', { action: 'approve' }]] as const) {
      const res = await APPROVAL(...post(id, body))
      expect(res.status).toBe(400)
    }
    expect(mocks.setApproval).not.toHaveBeenCalled()
  })

  it('passes a refusal for a non-draft straight through', async () => {
    mocks.setApproval.mockResolvedValue({ ok: false, status: 409, error: 'Only draft cases are signed off here. This case is live.' })
    const res = await APPROVAL(...post(ID, { action: 'approve' }))
    expect(res.status).toBe(409)
    expect(await res.json()).toEqual({ error: 'Only draft cases are signed off here. This case is live.' })
  })
})

describe('the pages (source pins)', () => {
  const read = (rel: string) => readFileSync(fileURLToPath(new URL(rel, import.meta.url)), 'utf8')
  const ROOT = '../../../../'

  it('both case review pages run the admin gate before rendering', () => {
    for (const page of ['app/admin/case-review/page.tsx', 'app/admin/case-review/[id]/page.tsx']) {
      expect(read(ROOT + page)).toMatch(/await requireAdminPage\(/)
    }
    const gate = read(ROOT + 'app/admin/case-review/requireAdminPage.ts')
    expect(gate).toContain('parseAdminEmails(process.env.ADMIN_EMAILS)')
    expect(gate).toContain('notFound()')
    expect(gate).toContain('/auth/sign-in?redirect=')
  })

  it('the admin front door links to case review', () => {
    expect(read(ROOT + 'app/admin/AdminHome.tsx')).toContain("href: '/admin/case-review'")
  })

  it('the list has an empty state, and the detail reuses the public renderers and links to the brief', () => {
    expect(read(ROOT + 'components/admin/case-review/CaseReviewList.tsx')).toContain('Nothing to review')
    const detail = read(ROOT + 'components/admin/case-review/CaseReviewDetail.tsx')
    expect(detail).toContain("from '@/components/cases/LearningPoints'")
    expect(detail).toContain("from '@/components/cases/MarkScheme'")
    expect(detail).toContain('/clinical-master/station/${draft.id}')
  })

  it('no case review file writes lifecycle or is_active', () => {
    for (const file of [
      'app/api/admin/case-review/caseReviewData.ts',
      'app/api/admin/case-review/[id]/approval/route.ts',
      'components/admin/case-review/ApprovalControl.tsx',
    ]) {
      const src = read(ROOT + file)
      expect(src).not.toMatch(/lifecycle:\s*'(live|archived)'/)
      expect(src).not.toMatch(/is_active:/)
    }
  })
})
