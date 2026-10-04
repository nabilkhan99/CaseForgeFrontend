import { describe, expect, it } from 'vitest'
import { decideNextAction, RESULTS_LAG_DAYS, trailingMisses, type LeadStanding } from './followUp'
import type { CallRecord, SuggestedNext } from './types'

// Sunday 4 October 2026, 11:42 in London (BST, UTC+1).
const NOW = new Date('2026-10-04T10:42:00Z')

const HOT: LeadStanding = { heat: 'hot', notCandidate: false, examDate: null, examSat: false, trialEndsAt: null }

const call = (outcome: CallRecord['outcome'], at: string): CallRecord => ({ outcome, at })

function decide(calls: CallRecord[], standing: Partial<LeadStanding> = {}, suggested: SuggestedNext | null = null) {
  return decideNextAction({ now: NOW, standing: { ...HOT, ...standing }, calls, suggested })
}

describe('first contact', () => {
  it('puts a hot lead nobody has called at the top: due now', () => {
    const next = decide([])
    expect(next).toMatchObject({ label: 'First call', kind: 'call', status: 'open', source: 'rules' })
    expect(next.dueAt).toBe(NOW.toISOString())
    expect(next.why).toBe('Hot lead, not called yet')
  })

  it('leaves a cool lead unscheduled on the nurture list', () => {
    expect(decide([], { heat: 'cool' })).toMatchObject({ label: 'Nurture list', dueAt: null, status: 'open' })
  })

  it('calls a cool lead anyway while their trial is running', () => {
    const next = decide([], { heat: 'cool', trialEndsAt: new Date('2026-10-07T10:54:00Z') })
    expect(next).toMatchObject({ label: 'First call', why: 'Trial ends Wed 7 Oct' })
    expect(next.dueAt).toBe(NOW.toISOString())
  })

  it('closes someone who is not in GP training', () => {
    expect(decide([], { notCandidate: true })).toMatchObject({ status: 'closed', closedReason: 'Not an SCA candidate' })
  })

  it('waits for results when they have already sat', () => {
    const next = decide([], { examSat: true, examDate: '2026-09-10' })
    expect(next.label).toBe('Check in after results')
    // 10 Sep + 28 days = 8 Oct, 10:00 London.
    expect(RESULTS_LAG_DAYS).toBe(28)
    expect(next.dueAt).toBe('2026-10-08T09:00:00.000Z')
  })

  it('cannot schedule results for a sitting known only by month', () => {
    expect(decide([], { examSat: true })).toMatchObject({ label: 'Check in after results', dueAt: null })
  })
})

describe('the no-answer ladder', () => {
  it('retries a morning miss the next evening', () => {
    const next = decide([call('no_answer', '2026-10-04T10:10:00Z')])
    expect(next).toMatchObject({ label: 'Call again', why: '1 missed call' })
    expect(next.dueAt).toBe('2026-10-05T17:00:00.000Z') // Mon 18:00 BST
  })

  it('retries an evening miss the next lunchtime, and adds a text', () => {
    const next = decide([call('no_answer', '2026-10-04T10:10:00Z'), call('no_answer', '2026-10-05T17:05:00Z')])
    expect(next).toMatchObject({ label: 'Call again and send a text', why: '2 missed calls' })
    expect(next.dueAt).toBe('2026-10-06T11:30:00.000Z') // Tue 12:30 BST
  })

  it('makes the third miss the last call, three days later', () => {
    const next = decide([
      call('no_answer', '2026-10-04T10:10:00Z'),
      call('no_answer', '2026-10-05T17:05:00Z'),
      call('no_answer', '2026-10-06T11:35:00Z'),
    ])
    expect(next).toMatchObject({ label: 'Last call, then email if no answer' })
    expect(next.dueAt).toBe('2026-10-09T17:00:00.000Z') // Fri 18:00 BST
  })

  it('closes the lead after the fourth miss', () => {
    const misses = ['2026-10-04T10:10:00Z', '2026-10-05T17:05:00Z', '2026-10-06T11:35:00Z', '2026-10-09T17:02:00Z']
    expect(decide(misses.map((at) => call('no_answer', at)))).toMatchObject({
      status: 'closed',
      closedReason: 'No answer after 4 tries',
      dueAt: null,
    })
  })

  it('gives a voicemail at least two days', () => {
    const next = decide([call('voicemail', '2026-10-04T10:10:00Z')])
    expect(next.why).toBe('1 missed call, voicemail left')
    expect(next.dueAt).toBe('2026-10-06T17:00:00.000Z')
  })

  it('does not let a text in between reset or extend the run', () => {
    const calls = [call('no_answer', '2026-10-04T10:10:00Z'), call('other', '2026-10-04T10:20:00Z'), call('no_answer', '2026-10-05T17:05:00Z')]
    expect(trailingMisses(calls)).toBe(2)
  })

  it('starts the count again once they have been reached', () => {
    const calls = [call('no_answer', '2026-10-01T10:00:00Z'), call('spoke', '2026-10-02T10:00:00Z'), call('no_answer', '2026-10-04T10:10:00Z')]
    expect(trailingMisses(calls)).toBe(1)
  })

  it('switches to a results check for someone who has already sat', () => {
    const next = decide([call('no_answer', '2026-10-04T10:10:00Z')], { examSat: true, examDate: '2026-09-10' })
    expect(next.label).toBe('Check in after results')
  })
})

describe('after a conversation', () => {
  it('follows up three days later at the time they picked up', () => {
    const next = decide([call('spoke', '2026-10-04T10:35:00Z')]) // 11:35 BST
    expect(next).toMatchObject({ label: 'Follow up', why: 'Spoke Sun 4 Oct' })
    expect(next.dueAt).toBe('2026-10-07T10:30:00.000Z') // Wed 11:30 BST
  })

  it('keeps a follow-up within calling hours', () => {
    const next = decide([call('spoke', '2026-10-04T06:10:00Z')]) // 07:10 BST
    expect(next.dueAt).toBe('2026-10-07T08:00:00.000Z') // 09:00 BST
  })

  it('closes when they said no', () => {
    expect(decide([call('not_interested', '2026-10-04T10:35:00Z')])).toMatchObject({
      status: 'closed',
      closedReason: 'Not interested',
    })
  })

  it('switches to email on a wrong number', () => {
    const next = decide([call('wrong_number', '2026-10-04T10:35:00Z')])
    expect(next).toMatchObject({ kind: 'email', label: 'Email them, the number did not work' })
    expect(next.dueAt).toBe(NOW.toISOString())
  })

  it('checks back two days after a text or email', () => {
    expect(decide([call('other', '2026-10-04T10:35:00Z')]).dueAt).toBe('2026-10-06T09:00:00.000Z')
  })
})

describe('a next step the call asked for', () => {
  const suggestion = (over: Partial<SuggestedNext> = {}): SuggestedNext => ({
    label: 'Call back',
    kind: 'call',
    date: '2026-10-06',
    time: '18:00',
    why: 'Said ring Tuesday after clinic',
    ...over,
  })

  it('wins over the standard path', () => {
    const next = decide([call('spoke', '2026-10-04T10:35:00Z')], {}, suggestion())
    expect(next).toMatchObject({ label: 'Call back', source: 'call', why: 'Said ring Tuesday after clinic' })
    expect(next.dueAt).toBe('2026-10-06T17:00:00.000Z')
  })

  it('uses the time they picked up when the call named only a day', () => {
    const next = decide([call('spoke', '2026-10-04T10:35:00Z')], {}, suggestion({ time: null }))
    expect(next.dueAt).toBe('2026-10-06T10:30:00.000Z')
  })

  it('is due now rather than in the past', () => {
    const next = decide([call('spoke', '2026-10-04T10:35:00Z')], {}, suggestion({ date: '2026-10-03' }))
    expect(next.dueAt).toBe(NOW.toISOString())
  })

  it('is not moved by a trial deadline: the person chose the day', () => {
    const next = decide([call('spoke', '2026-10-04T10:35:00Z')], { trialEndsAt: new Date('2026-10-05T10:54:00Z') }, suggestion())
    expect(next.dueAt).toBe('2026-10-06T17:00:00.000Z')
  })
})

describe('trial deadlines', () => {
  const TRIAL_ENDS = new Date('2026-10-05T10:54:00Z') // Mon 11:54 BST

  it('pulls a retry in front of the trial ending', () => {
    const next = decide([call('no_answer', '2026-10-04T10:10:00Z')], { trialEndsAt: TRIAL_ENDS })
    // Three hours before the end is 08:54, before calling hours, so it becomes this evening.
    expect(next.dueAt).toBe('2026-10-04T17:00:00.000Z')
    expect(next.why).toBe('1 missed call, before the trial ends')
  })

  it('never pulls a call to before 09:00: a morning deadline means the evening before', () => {
    const next = decide([call('no_answer', '2026-10-04T10:10:00Z')], { trialEndsAt: new Date('2026-10-06T08:00:00Z') }) // Tue 09:00 BST
    expect(next.dueAt).toBe('2026-10-05T17:00:00.000Z') // Mon 18:00 BST, not Tue 06:00
  })

  it('never pulls a call to after 20:00: a late deadline means that evening at six', () => {
    const next = decide(
      [call('no_answer', '2026-10-04T10:10:00Z'), call('no_answer', '2026-10-05T17:05:00Z'), call('no_answer', '2026-10-06T11:35:00Z')],
      { trialEndsAt: new Date('2026-10-07T22:30:00Z') }, // Wed 23:30 BST
    )
    expect(next.dueAt).toBe('2026-10-07T17:00:00.000Z') // Wed 18:00 BST
  })

  it('leaves the schedule alone once we have spoken to them', () => {
    const calls = [call('spoke', '2026-10-03T10:00:00Z'), call('no_answer', '2026-10-04T10:10:00Z')]
    expect(decide(calls, { trialEndsAt: TRIAL_ENDS }).dueAt).toBe('2026-10-05T17:00:00.000Z')
  })

  it('ignores a trial that has already ended', () => {
    const next = decide([call('no_answer', '2026-10-04T10:10:00Z')], { trialEndsAt: new Date('2026-10-01T10:00:00Z') })
    expect(next.dueAt).toBe('2026-10-05T17:00:00.000Z')
  })
})
