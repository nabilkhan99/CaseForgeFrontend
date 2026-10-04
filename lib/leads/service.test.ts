import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { SupabaseClient } from '@supabase/supabase-js'
import { createFakeSupabase, type FakeSupabase } from '@/lib/testing/fakeSupabase'
import type { LeadSources } from './assemble'
import type { CallDraft } from './types'

const mocks = vi.hoisted(() => ({ loadLeadSources: vi.fn() }))
vi.mock('server-only', () => ({}))
vi.mock('./load', () => ({ loadLeadSources: (...args: unknown[]) => mocks.loadLeadSources(...args) }))

const { findLead, promptContext, saveCall, saveFollowup } = await import('./service')

// Sunday 4 October 2026, 11:45 in London. Invented people only.
const NOW = new Date('2026-10-04T10:45:00Z')
const ADMIN = 'caller@example.org'

const SOURCES: LeadSources = {
  now: NOW,
  trialLeads: [
    { email: 'lead@example.org', first_name: null, phone: '+447700900123', training_stage: 'gpst3', sca_sitting: null, created_at: '2026-10-01T10:00:00Z', session_id: null },
    { email: 'second@example.org', first_name: null, phone: null, training_stage: 'gpst3', sca_sitting: null, created_at: '2026-10-02T10:00:00Z', session_id: null },
  ],
  grants: [],
  orders: [],
  users: [],
  profiles: [],
  sessions: [],
  results: [],
  calls: [],
  followups: [],
  overrides: [{ email: 'second@example.org', kind: 'merge', merge_into: 'lead@example.org', display_name: null }],
  browsing: null,
}

const draft = (over: Partial<CallDraft> = {}): CallDraft => ({
  outcome: 'no_answer',
  points: [],
  facts: { firstName: null, exam: null, competitors: [], intent: 'unknown' },
  suggestedNext: null,
  model: null,
  ...over,
})

let fake: FakeSupabase
const db = () => fake as unknown as SupabaseClient

beforeEach(() => {
  fake = createFakeSupabase()
  mocks.loadLeadSources.mockResolvedValue(SOURCES)
})

async function lookup() {
  const found = await findLead(db(), NOW, 'lead@example.org')
  if (!found) throw new Error('fixture lead missing')
  return found
}

describe('findLead', () => {
  it('finds a lead by a merged second address too', async () => {
    expect((await findLead(db(), NOW, ' Second@Example.org '))?.lead.email).toBe('lead@example.org')
    expect(await findLead(db(), NOW, 'nobody@example.org')).toBeNull()
  })
})

describe('saveCall', () => {
  it('logs a missed call and schedules the retry from the ladder', async () => {
    const lead = await saveCall(db(), { lookup: await lookup(), draft: draft(), rawNotes: null, source: 'quick', manualNext: null, loggedBy: ADMIN, now: NOW })
    expect(fake.tables.lead_calls).toHaveLength(1)
    expect(fake.tables.lead_calls[0]).toMatchObject({
      lead_email: 'lead@example.org',
      logged_by: ADMIN,
      outcome: 'no_answer',
      next_label: 'Call again',
      next_due: '2026-10-05T17:00:00.000Z',
      next_source: 'rules',
    })
    expect(fake.tables.lead_followups[0]).toMatchObject({ label: 'Call again', due_at: '2026-10-05T17:00:00.000Z', updated_by: ADMIN })
    expect(lead.calls).toHaveLength(1)
    expect(lead.next).toMatchObject({ label: 'Call again', dueAt: '2026-10-05T17:00:00.000Z' })
  })

  it('follows the call’s own timing, and keeps what it taught us', async () => {
    const lead = await saveCall(db(), {
      lookup: await lookup(),
      draft: draft({
        outcome: 'spoke',
        points: [{ label: 'Exam', text: 'February.' }],
        facts: { firstName: 'Sam', exam: { text: 'February 2027', date: null, month: '2027-02' }, competitors: [], intent: 'considering' },
        suggestedNext: { label: 'Call back', kind: 'call', date: '2026-10-06', time: '18:00', why: 'after clinic' },
        model: 'gpt-5.4-mini',
      }),
      rawNotes: 'spoke to sam, sitting feb, ring tues after clinic',
      source: 'prompt',
      manualNext: null,
      loggedBy: ADMIN,
      now: NOW,
    })
    expect(lead).toMatchObject({ name: 'Sam', nameKnown: true, exam: { label: 'February 2027', cls: 'soon' } })
    expect(lead.next).toMatchObject({ label: 'Call back', dueAt: '2026-10-06T17:00:00.000Z', source: 'call' })
    expect(fake.tables.lead_followups[0]).toMatchObject({ display_name: 'Sam', exam_month: '2027-02', exam_note: 'February 2027' })
  })

  it('never renames someone we already have a name for', async () => {
    const named = { ...SOURCES, overrides: [...SOURCES.overrides, { email: 'lead@example.org', kind: 'name' as const, merge_into: null, display_name: 'Dr Jo' }] }
    mocks.loadLeadSources.mockResolvedValue(named)
    const lead = await saveCall(db(), {
      lookup: await lookup(),
      draft: draft({ outcome: 'spoke', facts: { firstName: 'Joanna', exam: null, competitors: [], intent: 'unknown' } }),
      rawNotes: 'x',
      source: 'prompt',
      manualNext: null,
      loggedBy: ADMIN,
      now: NOW,
    })
    expect(lead.name).toBe('Dr Jo')
    expect(fake.tables.lead_followups[0].display_name).toBeNull()
  })

  it('uses a next action set by hand', async () => {
    const lead = await saveCall(db(), {
      lookup: await lookup(),
      draft: draft({ outcome: 'spoke' }),
      rawNotes: null,
      source: 'prompt',
      manualNext: { label: 'Send the price list', dueAt: '2026-10-05T09:00:00.000Z' },
      loggedBy: ADMIN,
      now: NOW,
    })
    expect(lead.next).toMatchObject({ label: 'Send the price list', source: 'manual', dueAt: '2026-10-05T09:00:00.000Z' })
  })

  it('fails loudly when the call cannot be written', async () => {
    fake.failOn.lead_calls = { message: 'insert failed' }
    await expect(
      saveCall(db(), { lookup: await lookup(), draft: draft(), rawNotes: null, source: 'quick', manualNext: null, loggedBy: ADMIN, now: NOW }),
    ).rejects.toThrow('could not save the call')
    expect(fake.tables.lead_followups ?? []).toHaveLength(0)
  })
})

describe('saveFollowup', () => {
  it('closes a lead by hand', async () => {
    const lead = await saveFollowup(db(), { lookup: await lookup(), label: '', dueAt: null, status: 'closed', closedReason: 'Sitting in 2028', updatedBy: ADMIN, now: NOW })
    expect(lead.next).toMatchObject({ status: 'closed', closedReason: 'Sitting in 2028', source: 'manual', dueAt: null })
  })
})

describe('promptContext', () => {
  it('gives the AI no contact details, and no name it would have to guess', async () => {
    const context = promptContext((await lookup()).lead)
    expect(context).toMatchObject({ name: null, examOnFile: null, trial: null, consultations: 0, earlierCalls: [] })
    expect(JSON.stringify(context)).not.toMatch(/@|\+44/)
  })
})
