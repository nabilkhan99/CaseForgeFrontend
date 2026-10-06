import { describe, expect, it } from 'vitest'
import { assembleLeads, mergeSignals, type CallRow, type FollowupRow, type LeadSources, type TrialLeadRow } from './assemble'
import { NO_SIGNALS, type Signals } from './heat'

// Sunday 4 October 2026, 11:45 in London. Every name and address here is invented.
const NOW = new Date('2026-10-04T10:45:00Z')

const sources = (over: Partial<LeadSources> = {}): LeadSources => ({
  now: NOW,
  trialLeads: [],
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
  ...over,
})

const row = (email: string, over: Partial<TrialLeadRow> = {}): TrialLeadRow => ({
  email,
  first_name: null,
  phone: null,
  training_stage: 'gpst3',
  sca_sitting: null,
  created_at: '2026-09-20T10:00:00Z',
  session_id: null,
  ...over,
})

const call = (email: string, over: Partial<CallRow> = {}): CallRow => ({
  id: `call-${email}`,
  lead_email: email,
  logged_by: 'caller@example.org',
  created_at: '2026-10-04T10:10:00Z',
  source: 'quick',
  outcome: 'no_answer',
  raw_notes: null,
  points: [],
  facts: {},
  next_label: 'Call again',
  next_kind: 'call',
  next_due: '2026-10-05T17:00:00.000Z',
  next_source: 'rules',
  model: null,
  ...over,
})

const followup = (email: string, over: Partial<FollowupRow> = {}): FollowupRow => ({
  lead_email: email,
  label: 'Call again',
  kind: 'call',
  due_at: '2026-10-05T17:00:00.000Z',
  source: 'rules',
  status: 'open',
  closed_reason: null,
  why: '1 missed call',
  display_name: null,
  exam_note: null,
  exam_date: null,
  exam_month: null,
  updated_at: '2026-10-04T10:10:00Z',
  updated_by: 'caller@example.org',
  ...over,
})

const emails = (src: LeadSources) => assembleLeads(src).map((l) => l.email).sort()

describe('who is a lead', () => {
  it('leaves out our own accounts, test domains and hand-excluded addresses', () => {
    const src = sources({
      trialLeads: [row('nabilkhan+t@gmail.com'), row('x@aganseo.com'), row('hidden@example.org'), row('real.doctor@example.org')],
      overrides: [{ email: 'hidden@example.org', kind: 'exclude', merge_into: null, display_name: null }],
    })
    expect(emails(src)).toEqual(['real.doctor@example.org'])
  })

  it('merges a second sign-up into the first, calls included', () => {
    const src = sources({
      trialLeads: [row('first@example.org'), row('second@example.org', { created_at: '2026-09-25T10:00:00Z' })],
      overrides: [{ email: 'second@example.org', kind: 'merge', merge_into: 'first@example.org', display_name: null }],
      calls: [call('second@example.org')],
    })
    const [lead] = assembleLeads(src)
    expect(lead.email).toBe('first@example.org')
    expect(lead.aliases).toEqual(['second@example.org'])
    expect(lead.calls).toHaveLength(1)
  })

  it('drops customers, refunded ones included', () => {
    const src = sources({
      trialLeads: [row('buyer@example.org'), row('refunded@example.org')],
      orders: [
        { email: 'Buyer@Example.org', status: 'paid' },
        { email: 'refunded@example.org', status: 'refunded' },
      ],
    })
    expect(emails(src)).toEqual([])
  })

  it('keeps a lead who bought after we called them, closed as Bought', () => {
    const src = sources({
      trialLeads: [row('won@example.org')],
      orders: [{ email: 'won@example.org', status: 'paid' }],
      calls: [call('won@example.org', { outcome: 'spoke' })],
    })
    const [lead] = assembleLeads(src)
    expect(lead).toMatchObject({ bought: true, next: { status: 'closed', closedReason: 'Bought' } })
  })
})

describe('names', () => {
  const base = { trialLeads: [row('jo.bloggs@example.org', { first_name: 'jo-ann' })] }

  it('prefers a name set by hand, then one learned on a call, then the form', () => {
    expect(assembleLeads(sources(base))[0]).toMatchObject({ name: 'Jo-Ann', nameKnown: true })
    expect(assembleLeads(sources({ ...base, followups: [followup('jo.bloggs@example.org', { display_name: 'Joanne' })] }))[0].name).toBe('Joanne')
    expect(
      assembleLeads(
        sources({
          ...base,
          followups: [followup('jo.bloggs@example.org', { display_name: 'Joanne' })],
          overrides: [{ email: 'jo.bloggs@example.org', kind: 'name', merge_into: null, display_name: 'Dr Jo' }],
        }),
      )[0].name,
    ).toBe('Dr Jo')
  })

  it('falls back to the profile, then to the email', () => {
    const profiled = sources({
      trialLeads: [row('anon@example.org')],
      users: [{ id: 'u1', email: 'anon@example.org' }],
      profiles: [{ id: 'u1', exam_date: null, full_name: 'sam taylor' }],
    })
    expect(assembleLeads(profiled)[0]).toMatchObject({ name: 'Sam', nameKnown: true })
    expect(assembleLeads(sources({ trialLeads: [row('anon@example.org')] }))[0]).toMatchObject({ name: 'anon', nameKnown: false })
  })
})

describe('practice and exam timing', () => {
  it('counts an account’s consultations, not the ones still being read', () => {
    const src = sources({
      trialLeads: [row('trial@example.org')],
      users: [{ id: 'u1', email: 'trial@example.org' }],
      grants: [{ user_id: 'u1', email: 'trial@example.org', started_at: '2026-10-02T10:00:00Z', expires_at: '2026-10-07T10:54:00Z' }],
      sessions: [
        { id: 's1', user_id: 'u1', station_id: 'a', status: 'completed', started_at: '2026-10-02T10:00:00Z' },
        { id: 's2', user_id: 'u1', station_id: 'b', status: 'completed', started_at: '2026-10-03T10:00:00Z' },
        { id: 's3', user_id: 'u1', station_id: 'c', status: 'reading', started_at: null },
      ],
      results: [{ session_id: 's1', verdict: 'Pass', weighted_score: '7.5' }],
    })
    const [lead] = assembleLeads(src)
    expect(lead).toMatchObject({ kind: 'trial', consultations: 2, stationsTried: 2, passes: 1, best: 7.5, trial: { running: true } })
  })

  it('credits a guest with every free mock their browser ran', () => {
    const signals: Signals = { ...NO_SIGNALS, guestSessions: 3 }
    const src = sources({
      trialLeads: [row('guest@example.org', { session_id: 's1' })],
      sessions: [{ id: 's1', user_id: null, station_id: 'a', status: 'completed', started_at: '2026-10-02T10:00:00Z' }],
      browsing: { pidsByEmail: new Map([['guest@example.org', ['p1']]]), byBrowser: new Map([['p1', signals]]) },
    })
    // Three mocks seen in the browser, one tied to the email: the count is known, which cases they were is not.
    expect(assembleLeads(src)[0]).toMatchObject({ kind: 'free', consultations: 3, stationsTried: 3 })
  })

  it('trusts what they told us on a call over the profile, and the profile over the old form', () => {
    const base = {
      trialLeads: [row('exam@example.org', { sca_sitting: 'jan_2027' })],
      users: [{ id: 'u1', email: 'exam@example.org' }],
      profiles: [{ id: 'u1', exam_date: '2026-11-18', full_name: null }],
    }
    expect(assembleLeads(sources(base))[0].exam).toMatchObject({ date: '2026-11-18', cls: 'prime' })
    const told = sources({ ...base, followups: [followup('exam@example.org', { exam_month: '2027-02' })] })
    expect(assembleLeads(told)[0].exam).toMatchObject({ label: 'February 2027', cls: 'soon' })
  })
})

describe('the next action column', () => {
  it('asks for a first call to a warm lead nobody has rung', () => {
    const src = sources({
      trialLeads: [row('keen@example.org', { sca_sitting: 'nov_2026', created_at: '2026-10-01T10:00:00Z' })],
    })
    const [lead] = assembleLeads(src)
    expect(lead.heat).toBe('warm') // exam in 1 to 2 months (3) + active in the last 2 weeks (2)
    expect(lead.next).toMatchObject({ label: 'First call', status: 'open', dueAt: NOW.toISOString() })
  })

  it('shows the stored next action once someone has called', () => {
    const src = sources({
      trialLeads: [row('called@example.org')],
      calls: [call('called@example.org')],
      followups: [followup('called@example.org')],
    })
    expect(assembleLeads(src)[0].next).toMatchObject({ label: 'Call again', dueAt: '2026-10-05T17:00:00.000Z', source: 'rules' })
  })
})

describe('mergeSignals', () => {
  it('counts a browser shared by two of a lead’s addresses once', () => {
    const browsing = {
      pidsByEmail: new Map([
        ['a@example.org', ['p1', 'p2']],
        ['b@example.org', ['p2']],
      ]),
      byBrowser: new Map<string, Signals>([
        ['p1', { ...NO_SIGNALS, pricingViews: 1, activeDays: 2, lastSeen: '2026-10-01T10:00:00.000Z' }],
        ['p2', { ...NO_SIGNALS, pricingViews: 2, activeDays: 1, lastSeen: '2026-10-03T10:00:00.000Z' }],
      ]),
    }
    expect(mergeSignals(browsing, ['a@example.org', 'b@example.org'])).toMatchObject({
      pricingViews: 3,
      activeDays: 2,
      lastSeen: '2026-10-03T10:00:00.000Z',
    })
  })
})
