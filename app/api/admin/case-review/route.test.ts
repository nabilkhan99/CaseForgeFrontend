import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

/**
 * The two /api/admin/case-review routes (the list and the sign-off): the
 * guard, input validation and error mapping. The queries are mocked here;
 * caseReviewData.test.ts covers what they read and write. Plus source pins on
 * the pages and the admin front door, which have no DOM test environment in
 * this repo. The detail page reads server side (no JSON route); it is run for
 * real in app/admin/case-review/[id]/page.test.ts.
 */

const mocks = vi.hoisted(() => ({
  isAdmin: vi.fn(),
  getAdminEmail: vi.fn(),
  getSupabaseAdmin: vi.fn(() => ({})),
  listDrafts: vi.fn(),
  setApproval: vi.fn(),
}))

vi.mock('@/lib/admin/guard', () => ({ isAdmin: () => mocks.isAdmin(), getAdminEmail: () => mocks.getAdminEmail() }))
vi.mock('@/lib/supabase/admin', () => ({ getSupabaseAdmin: () => mocks.getSupabaseAdmin() }))
vi.mock('./caseReviewData', async (importOriginal) => ({
  ...(await importOriginal<typeof import('./caseReviewData')>()),
  listDrafts: (...args: unknown[]) => mocks.listDrafts(...args),
  setApproval: (...args: unknown[]) => mocks.setApproval(...args),
}))

const { GET: LIST } = await import('./route')
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
  mocks.setApproval.mockResolvedValue({ ok: true, approval: { id: ID, approvedAt: '2026-10-05T12:00:00.000Z', approvedBy: ADMIN } })
  vi.spyOn(console, 'error').mockImplementation(() => {})
})

describe('the admin guard', () => {
  it('turns non-admins away from every route before touching data', async () => {
    mocks.isAdmin.mockResolvedValue(false)
    mocks.getAdminEmail.mockResolvedValue(null)
    const responses = await Promise.all([LIST(), APPROVAL(...post(ID, { action: 'approve' }))])
    expect(responses.map((r) => r.status)).toEqual([403, 403])
    expect(mocks.getSupabaseAdmin).not.toHaveBeenCalled()
    expect(mocks.listDrafts).not.toHaveBeenCalled()
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

  it('the list has an empty state, and every row opens that case\'s review page', () => {
    const list = read(ROOT + 'components/admin/case-review/CaseReviewList.tsx')
    expect(list).toContain('Nothing to review')
    expect(list).toContain('href={`/admin/case-review/${draft.id}`}')
  })

  it('the detail page gates before it reads, and is never indexed', () => {
    const page = read(ROOT + 'app/admin/case-review/[id]/page.tsx')
    const gate = page.indexOf('await requireAdminPage(')
    const load = page.indexOf('await loadCaseReview(')
    expect(gate).toBeGreaterThan(-1)
    expect(load).toBeGreaterThan(gate)
    expect(page).toContain('robots: { index: false, follow: false }')
  })

  it('the detail renders the case through the public case page component, not a fork of it', () => {
    const preview = read(ROOT + 'components/admin/case-review/CaseReviewPreview.tsx')
    expect(preview).toContain("import CaseDetailPageClient from '@/components/cases/CaseDetailPageClient'")
    expect(preview).toMatch(/<CaseDetailPageClient\s+caseData=\{shown\}/)
    expect(preview).toContain('reviewBar={')
    // The case bodies come from the public page's own read, minus its live filter.
    const loader = read(ROOT + 'app/admin/case-review/[id]/loadCaseReview.ts')
    expect(loader).toContain('getCaseByIdForReview(')
    expect(loader).toContain('buildCaseSeoIndex(')
  })

  it('the public case page drops its visitor offer under the review bar, and only there', () => {
    const casePage = read(ROOT + 'components/cases/CaseDetailPageClient.tsx')
    expect(casePage).toContain('{!user && !reviewBar && (')
    // The public route never passes one.
    expect(read(ROOT + 'app/sca-cases/[slug]/page.tsx')).not.toContain('reviewBar')
  })

  it('the review bar opens the draft as a consultation in a new tab, and goes back to the list', () => {
    const bar = read(ROOT + 'components/admin/case-review/CaseReviewBar.tsx')
    expect(bar).toMatch(/href=\{`\/clinical-master\/station\/\$\{meta\.id\}`\}\s+target="_blank"\s+rel="noopener noreferrer"/)
    expect(bar).toContain('href="/admin/case-review"')
    expect(bar).toContain('View the case it replaces')
  })

  it('no case review file writes lifecycle or is_active', () => {
    for (const file of [
      'app/api/admin/case-review/caseReviewData.ts',
      'app/api/admin/case-review/[id]/approval/route.ts',
      'components/admin/case-review/ApprovalControl.tsx',
      'components/admin/case-review/CaseReviewBar.tsx',
      'components/admin/case-review/CaseReviewPreview.tsx',
      'app/admin/case-review/[id]/loadCaseReview.ts',
    ]) {
      const src = read(ROOT + file)
      expect(src).not.toMatch(/lifecycle:\s*'(live|archived)'/)
      expect(src).not.toMatch(/is_active:/)
    }
  })
})
