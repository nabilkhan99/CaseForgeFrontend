import { describe, expect, it } from 'vitest'
import type { LeadView } from './assemble'
import { callerLabel, dueLabel, filterCounts, matchesFilter, matchesSearch, practiceSummary, sortLeads, touchPoints } from './board'
import { NO_SIGNALS } from './heat'
import type { NextAction } from './types'

// Sunday 4 October 2026, 11:45 in London. Invented leads.
const NOW = new Date('2026-10-04T10:45:00Z')

const next = (over: Partial<NextAction> = {}): NextAction => ({
  label: 'Call again',
  kind: 'call',
  dueAt: null,
  source: 'rules',
  status: 'open',
  closedReason: null,
  why: '',
  ...over,
})

const lead = (email: string, over: Partial<LeadView> = {}): LeadView => ({
  email,
  aliases: [],
  name: email.split('@')[0],
  nameKnown: true,
  phone: null,
  stage: 'ST3',
  kind: 'trial',
  trial: null,
  joinedAt: '2026-09-20T10:00:00Z',
  exam: { label: 'Not given', cls: 'unknown', days: null, date: null },
  consultations: 0,
  stationsTried: 0,
  passes: 0,
  best: null,
  signals: null,
  heat: 'warm',
  score: 5,
  why: [],
  lastActivity: null,
  calls: [],
  next: next(),
  bought: false,
  notCandidate: false,
  ...over,
})

const missed = { id: 'c1', at: '2026-10-03T10:00:00Z', by: 'a@example.org', source: 'quick' as const, outcome: 'no_answer' as const, points: [], facts: {}, rawNotes: null, next: null, model: null }
const spoke = { ...missed, id: 'c2', outcome: 'spoke' as const }

const LEADS = [
  lead('later@example.org', { calls: [missed], next: next({ dueAt: '2026-10-06T11:30:00Z' }) }),
  lead('overdue@example.org', { calls: [missed], next: next({ dueAt: '2026-10-03T17:00:00Z' }) }),
  lead('hot-new@example.org', { score: 12, heat: 'hot', next: next({ label: 'First call', dueAt: NOW.toISOString() }) }),
  lead('cool@example.org', { score: 2, heat: 'cool', next: next({ label: 'Nurture list', dueAt: null }) }),
  lead('spoke@example.org', { calls: [spoke], next: next({ label: 'Follow up', dueAt: '2026-10-07T10:30:00Z' }) }),
  lead('closed@example.org', { calls: [spoke], next: next({ status: 'closed', closedReason: 'Not interested', label: 'Not interested' }) }),
]

describe('sortLeads', () => {
  it('puts what is due first, then upcoming, then unscheduled, then closed', () => {
    expect(sortLeads(LEADS, NOW).map((l) => l.email)).toEqual([
      'overdue@example.org',
      'hot-new@example.org',
      'later@example.org',
      'spoke@example.org',
      'cool@example.org',
      'closed@example.org',
    ])
  })
})

describe('filters', () => {
  it('counts each view', () => {
    expect(filterCounts(LEADS, NOW)).toEqual({ due: 2, never: 2, chasing: 2, spoke: 1, closed: 1, all: 6 })
  })

  it('treats a lead we have reached as spoken to, not chased', () => {
    expect(matchesFilter(LEADS[4], 'spoke', NOW)).toBe(true)
    expect(matchesFilter(LEADS[4], 'chasing', NOW)).toBe(false)
  })

  it('searches names, emails, merged addresses and exam timing', () => {
    const merged = lead('main@example.org', { aliases: ['other@example.org'], exam: { label: 'February 2027', cls: 'soon', days: null, date: null } })
    expect(matchesSearch(merged, 'OTHER@')).toBe(true)
    expect(matchesSearch(merged, 'february')).toBe(true)
    expect(matchesSearch(merged, 'march')).toBe(false)
  })
})

describe('dueLabel', () => {
  it('words a due time the way a caller reads it', () => {
    expect(dueLabel('2026-10-03T17:00:00Z', NOW)).toEqual({ text: 'Overdue · Sat 3 Oct 18:00', tone: 'overdue' })
    expect(dueLabel(NOW.toISOString(), NOW)).toEqual({ text: 'Now', tone: 'now' })
    expect(dueLabel('2026-10-04T17:00:00Z', NOW)).toEqual({ text: 'Today 18:00', tone: 'today' })
    expect(dueLabel('2026-10-05T11:30:00Z', NOW)).toEqual({ text: 'Tomorrow 12:30', tone: 'later' })
    expect(dueLabel('2026-10-07T09:00:00Z', NOW)).toEqual({ text: 'Wed 7 Oct 10:00', tone: 'later' })
    expect(dueLabel(null, NOW)).toEqual({ text: 'Not scheduled', tone: 'none' })
  })
})

describe('touch points', () => {
  it('lists every tracked touch point, strongest buying signal first', () => {
    const chips = touchPoints({
      signals: { ...NO_SIGNALS, guideViews: 5, pricingViews: 3, checkoutStarts: 1, studyBudget: 2, activeDays: 4, guestSessions: 2 },
    })
    expect(chips.map((c) => c.label)).toEqual([
      'payment page ×1',
      'pricing ×3',
      'study budget ×2',
      'guides ×5',
      'free mocks ×2',
      'on the site 4 days',
    ])
    expect(chips.map((c) => c.tone)).toEqual(['hot', 'warm', 'warm', 'plain', 'plain', 'plain'])
  })

  it('has nothing to show when browsing data is off, or for a single quiet visit', () => {
    expect(touchPoints({ signals: null })).toEqual([])
    expect(touchPoints({ signals: { ...NO_SIGNALS, activeDays: 1 } })).toEqual([])
  })
})

describe('practiceSummary', () => {
  it('counts redos as consultations beyond the stations tried', () => {
    expect(practiceSummary({ consultations: 6, stationsTried: 4, passes: 1, best: 7 })).toBe('6 consultations · 2 redos · 1 passed · best 7.0')
    expect(practiceSummary({ consultations: 1, stationsTried: 1, passes: 0, best: null })).toBe('1 consultation · 0 passed')
  })
})

describe('callerLabel', () => {
  it('shows who logged a call without their full address', () => {
    expect(callerLabel('sam.taylor@example.org')).toBe('sam.taylor')
  })
})
