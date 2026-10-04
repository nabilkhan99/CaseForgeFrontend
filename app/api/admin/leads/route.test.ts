import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'
import type { LeadSources } from '@/lib/leads/assemble'

/**
 * All four /api/admin/leads routes: the guard, request validation and error
 * mapping. The service and the database are mocked here; service.test.ts
 * covers what a save actually writes.
 */

const mocks = vi.hoisted(() => ({
  isAdmin: vi.fn(),
  getAdminEmail: vi.fn(),
  getSupabaseAdmin: vi.fn(() => ({})),
  loadLeadSources: vi.fn(),
  findLead: vi.fn(),
  saveCall: vi.fn(),
  saveFollowup: vi.fn(),
  chatConfigFromEnv: vi.fn(),
  draftCallNotes: vi.fn(),
}))

vi.mock('server-only', () => ({}))
vi.mock('@/lib/admin/guard', () => ({ isAdmin: () => mocks.isAdmin(), getAdminEmail: () => mocks.getAdminEmail() }))
vi.mock('@/lib/supabase/admin', () => ({ getSupabaseAdmin: () => mocks.getSupabaseAdmin() }))
vi.mock('@/lib/leads/load', () => ({ loadLeadSources: (...args: unknown[]) => mocks.loadLeadSources(...args) }))
vi.mock('@/lib/leads/service', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/leads/service')>()),
  findLead: (...args: unknown[]) => mocks.findLead(...args),
  saveCall: (...args: unknown[]) => mocks.saveCall(...args),
  saveFollowup: (...args: unknown[]) => mocks.saveFollowup(...args),
}))
vi.mock('@/lib/leads/callNotes', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/leads/callNotes')>()),
  chatConfigFromEnv: () => mocks.chatConfigFromEnv(),
  draftCallNotes: (...args: unknown[]) => mocks.draftCallNotes(...args),
}))

const { GET } = await import('./route')
const { POST: DRAFT } = await import('./draft/route')
const { POST: CALL } = await import('./calls/route')
const { PATCH: FOLLOWUP } = await import('./followup/route')
const { CallNotesUnavailableError } = await import('@/lib/leads/callNotes')
const { assembleLeads } = await import('@/lib/leads/assemble')

const ADMIN = 'caller@example.org'
const LEAD_EMAIL = 'lead@example.org'

const EMPTY_SOURCES: LeadSources = {
  now: new Date('2026-10-04T10:45:00Z'),
  trialLeads: [{ email: LEAD_EMAIL, first_name: 'Sam', phone: null, training_stage: 'gpst3', sca_sitting: null, created_at: '2026-09-20T10:00:00Z', session_id: null }],
  grants: [],
  orders: [],
  users: [],
  profiles: [],
  sessions: [],
  results: [],
  calls: [],
  followups: [],
  overrides: [],
  browsing: null,
}

const LOOKUP = { sources: EMPTY_SOURCES, lead: assembleLeads(EMPTY_SOURCES)[0] }

function json(url: string, method: string, body: unknown): NextRequest {
  return new NextRequest(`http://localhost${url}`, { method, body: JSON.stringify(body), headers: { 'Content-Type': 'application/json' } })
}

beforeEach(() => {
  vi.clearAllMocks()
  mocks.isAdmin.mockResolvedValue(true)
  mocks.getAdminEmail.mockResolvedValue(ADMIN)
  mocks.loadLeadSources.mockResolvedValue(EMPTY_SOURCES)
  mocks.findLead.mockResolvedValue(LOOKUP)
  mocks.saveCall.mockResolvedValue({ email: LEAD_EMAIL })
  mocks.saveFollowup.mockResolvedValue({ email: LEAD_EMAIL })
  mocks.chatConfigFromEnv.mockReturnValue({ endpoint: 'https://x', apiKey: 'k', deployment: 'gpt-5.4-mini', apiVersion: 'v' })
  vi.spyOn(console, 'error').mockImplementation(() => {})
})

describe('the admin guard', () => {
  it('turns away non-admins from every route before touching data', async () => {
    mocks.isAdmin.mockResolvedValue(false)
    mocks.getAdminEmail.mockResolvedValue(null)
    const responses = await Promise.all([
      GET(new NextRequest('http://localhost/api/admin/leads')),
      DRAFT(json('/api/admin/leads/draft', 'POST', { email: LEAD_EMAIL, notes: 'x' })),
      CALL(json('/api/admin/leads/calls', 'POST', { email: LEAD_EMAIL, quick: 'no_answer' })),
      FOLLOWUP(json('/api/admin/leads/followup', 'PATCH', { email: LEAD_EMAIL, status: 'closed' })),
    ])
    expect(responses.map((r) => r.status)).toEqual([403, 403, 403, 403])
    expect(mocks.getSupabaseAdmin).not.toHaveBeenCalled()
    expect(mocks.loadLeadSources).not.toHaveBeenCalled()
    expect(mocks.findLead).not.toHaveBeenCalled()
  })
})

describe('GET /api/admin/leads', () => {
  it('lists the leads and says what is switched on', async () => {
    const response = await GET(new NextRequest('http://localhost/api/admin/leads'))
    const body = await response.json()
    expect(response.status).toBe(200)
    expect(body.leads.map((l: { email: string }) => l.email)).toEqual([LEAD_EMAIL])
    expect(body).toMatchObject({ browsing: false, ai: true })
  })

  it('asks for fresh browsing data on ?fresh=1', async () => {
    await GET(new NextRequest('http://localhost/api/admin/leads?fresh=1'))
    expect(mocks.loadLeadSources.mock.calls[0][2]).toEqual({ freshBrowsing: true })
  })

  it('reports a failed load without leaking the error', async () => {
    mocks.loadLeadSources.mockRejectedValue(new Error('relation does not exist'))
    const response = await GET(new NextRequest('http://localhost/api/admin/leads'))
    expect(response.status).toBe(500)
    expect(await response.json()).toEqual({ error: 'Could not load leads.' })
  })
})

describe('POST /api/admin/leads/draft', () => {
  it('needs notes', async () => {
    const response = await DRAFT(json('/api/admin/leads/draft', 'POST', { email: LEAD_EMAIL, notes: '   ' }))
    expect(response.status).toBe(400)
  })

  it('says so when the AI is not set up', async () => {
    mocks.chatConfigFromEnv.mockReturnValue(null)
    const response = await DRAFT(json('/api/admin/leads/draft', 'POST', { email: LEAD_EMAIL, notes: 'spoke to her' }))
    expect(response.status).toBe(503)
  })

  it('404s an unknown lead', async () => {
    mocks.findLead.mockResolvedValue(null)
    const response = await DRAFT(json('/api/admin/leads/draft', 'POST', { email: 'nobody@example.org', notes: 'x' }))
    expect(response.status).toBe(404)
  })

  it('passes on what went wrong with the AI in words the caller can act on', async () => {
    mocks.draftCallNotes.mockRejectedValue(new CallNotesUnavailableError('The AI is busy. Try again in a minute.'))
    const response = await DRAFT(json('/api/admin/leads/draft', 'POST', { email: LEAD_EMAIL, notes: 'x' }))
    expect(response.status).toBe(502)
    expect(await response.json()).toEqual({ error: 'The AI is busy. Try again in a minute.' })
  })

  it('returns the draft', async () => {
    const draft = { outcome: 'spoke', points: [], facts: {}, suggestedNext: null, model: 'gpt-5.4-mini' }
    mocks.draftCallNotes.mockResolvedValue(draft)
    const response = await DRAFT(json('/api/admin/leads/draft', 'POST', { email: LEAD_EMAIL, notes: 'spoke to her' }))
    expect(await response.json()).toEqual({ draft })
    expect(mocks.draftCallNotes.mock.calls[0][0]).toMatchObject({ notes: 'spoke to her', lead: { name: 'Sam', consultations: 0, earlierCalls: [] } })
  })
})

describe('POST /api/admin/leads/calls', () => {
  it('logs a one-tap no answer, with who logged it', async () => {
    const response = await CALL(json('/api/admin/leads/calls', 'POST', { email: LEAD_EMAIL, quick: 'no_answer' }))
    expect(response.status).toBe(200)
    expect(mocks.saveCall.mock.calls[0][1]).toMatchObject({
      source: 'quick',
      loggedBy: ADMIN,
      draft: { outcome: 'no_answer', points: [], model: null },
      manualNext: null,
    })
  })

  it('refuses an unknown quick outcome, or a prompt call with no draft', async () => {
    const quick = await CALL(json('/api/admin/leads/calls', 'POST', { email: LEAD_EMAIL, quick: 'spoke' }))
    const noDraft = await CALL(json('/api/admin/leads/calls', 'POST', { email: LEAD_EMAIL, notes: 'spoke' }))
    expect([quick.status, noDraft.status]).toEqual([400, 400])
    expect(mocks.saveCall).not.toHaveBeenCalled()
  })

  it('cleans a reviewed draft before saving it', async () => {
    await CALL(
      json('/api/admin/leads/calls', 'POST', {
        email: LEAD_EMAIL,
        notes: 'spoke to her',
        draft: { outcome: 'spoke', points: [{ label: 'Keen', text: 'Keen — wants a call' }], facts: { intent: 'hacked' }, suggestedNext: null, model: 'gpt-5.4-mini' },
      }),
    )
    expect(mocks.saveCall.mock.calls[0][1]).toMatchObject({
      source: 'prompt',
      rawNotes: 'spoke to her',
      draft: { points: [{ label: 'Keen', text: 'Keen, wants a call' }], facts: { intent: 'unknown' } },
    })
  })

  it('takes a next action set by hand, and refuses a bad date', async () => {
    const draft = { outcome: 'spoke', points: [], facts: {}, suggestedNext: null }
    const bad = await CALL(json('/api/admin/leads/calls', 'POST', { email: LEAD_EMAIL, draft, next: { label: 'Call back', dueAt: 'Tuesday' } }))
    expect(bad.status).toBe(400)
    await CALL(json('/api/admin/leads/calls', 'POST', { email: LEAD_EMAIL, draft, next: { label: 'Call back', dueAt: '2026-10-06T17:00:00Z' } }))
    expect(mocks.saveCall.mock.calls[0][1].manualNext).toEqual({ label: 'Call back', dueAt: '2026-10-06T17:00:00.000Z' })
  })

  it('404s an unknown lead and 500s a failed save', async () => {
    mocks.findLead.mockResolvedValueOnce(null)
    expect((await CALL(json('/api/admin/leads/calls', 'POST', { email: LEAD_EMAIL, quick: 'no_answer' }))).status).toBe(404)
    mocks.saveCall.mockRejectedValueOnce(new Error('insert failed'))
    expect((await CALL(json('/api/admin/leads/calls', 'POST', { email: LEAD_EMAIL, quick: 'no_answer' }))).status).toBe(500)
  })
})

describe('PATCH /api/admin/leads/followup', () => {
  it('needs a status, and a label for an open action', async () => {
    const noStatus = await FOLLOWUP(json('/api/admin/leads/followup', 'PATCH', { email: LEAD_EMAIL }))
    const noLabel = await FOLLOWUP(json('/api/admin/leads/followup', 'PATCH', { email: LEAD_EMAIL, status: 'open', label: ' ' }))
    expect([noStatus.status, noLabel.status]).toEqual([400, 400])
  })

  it('closes a lead with a reason', async () => {
    const response = await FOLLOWUP(json('/api/admin/leads/followup', 'PATCH', { email: LEAD_EMAIL, status: 'closed', closedReason: 'Sitting in 2028' }))
    expect(response.status).toBe(200)
    expect(mocks.saveFollowup.mock.calls[0][1]).toMatchObject({ status: 'closed', closedReason: 'Sitting in 2028', updatedBy: ADMIN })
  })

  it('moves an open action to a new time', async () => {
    await FOLLOWUP(json('/api/admin/leads/followup', 'PATCH', { email: LEAD_EMAIL, status: 'open', label: 'Call back', dueAt: '2026-10-08T17:00:00Z' }))
    expect(mocks.saveFollowup.mock.calls[0][1]).toMatchObject({ status: 'open', label: 'Call back', dueAt: '2026-10-08T17:00:00.000Z' })
  })
})
