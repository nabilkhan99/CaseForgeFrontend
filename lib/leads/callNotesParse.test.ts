import { describe, expect, it } from 'vitest'
import { DraftParseError, impliedNextStep, isRealDate, manualDraft, parseCallDraft, stripDashes } from './callNotesParse'
import type { CallFacts } from './types'

// Sunday 4 October 2026, 11:45 in London.
const NOW = new Date('2026-10-04T10:45:00Z')

const reply = (over: Record<string, unknown> = {}) =>
  JSON.stringify({
    outcome: 'spoke',
    points: [{ label: 'Exam', text: 'Sitting in February.' }],
    facts: { first_name: null, exam: null, competitors: [], intent: 'considering' },
    next_step: null,
    ...over,
  })

const facts = (over: Partial<CallFacts> = {}): CallFacts => ({
  firstName: null,
  exam: null,
  competitors: [],
  intent: 'unknown',
  ...over,
})

describe('parseCallDraft', () => {
  it('reads a well-formed reply', () => {
    const draft = parseCallDraft(reply(), 'gpt-5.4-mini', NOW)
    expect(draft).toMatchObject({ outcome: 'spoke', model: 'gpt-5.4-mini', suggestedNext: null })
    expect(draft.points).toEqual([{ label: 'Exam', text: 'Sitting in February.' }])
  })

  it('rejects a reply that is not JSON, or has no usable outcome', () => {
    expect(() => parseCallDraft('not json', 'm', NOW)).toThrow(DraftParseError)
    expect(() => parseCallDraft(reply({ outcome: 'maybe' }), 'm', NOW)).toThrow(DraftParseError)
  })

  it('keeps a next step the call asked for', () => {
    const draft = parseCallDraft(
      reply({ next_step: { label: 'Call back', kind: 'call', date: '2026-10-06', time: '18:00', why: 'after clinic' } }),
      'm',
      NOW,
    )
    expect(draft.suggestedNext).toEqual({ label: 'Call back', kind: 'call', date: '2026-10-06', time: '18:00', why: 'after clinic' })
  })

  it('drops a next step with an impossible or far-off date, or a bad time', () => {
    const step = (date: string, time: string | null = null) =>
      parseCallDraft(reply({ next_step: { label: 'Call back', kind: 'call', date, time, why: '' } }), 'm', NOW).suggestedNext
    expect(step('2026-02-30')).toBeNull()
    expect(step('2026-09-01')).toBeNull()
    expect(step('2028-01-01')).toBeNull()
    expect(step('2026-10-06', '25:00')).toMatchObject({ date: '2026-10-06', time: null })
  })

  it('learns nothing from a missed call, whatever the model copied from the context', () => {
    const draft = parseCallDraft(
      reply({ outcome: 'no_answer', points: [], facts: { first_name: 'Sam', exam: { text: 'November', date: null, month: '2026-11' }, competitors: [], intent: 'buying' } }),
      'm',
      NOW,
    )
    expect(draft.facts).toEqual(facts())
    expect(draft.suggestedNext).toBeNull()
  })

  it('removes field names used as labels but keeps the point', () => {
    const draft = parseCallDraft(reply({ points: [{ label: 'Intent', text: 'Will decide after the exam.' }] }), 'm', NOW)
    expect(draft.points).toEqual([{ label: null, text: 'Will decide after the exam.' }])
  })

  it('drops a point that only restates the next step once it has its own field', () => {
    const draft = parseCallDraft(
      reply({
        points: [{ label: 'Exam', text: 'February.' }, { label: 'Next step', text: 'Call back Thursday.' }],
        next_step: { label: 'Call back', kind: 'call', date: '2026-10-08', time: null, why: 'Thursday' },
      }),
      'm',
      NOW,
    )
    expect(draft.points.map((p) => p.label)).toEqual(['Exam'])
  })

  it('keeps a next-step point when there is no next step to hold it', () => {
    const draft = parseCallDraft(reply({ points: [{ label: 'Next step', text: 'Wants a call sometime.' }] }), 'm', NOW)
    expect(draft.points).toHaveLength(1)
  })

  it('cleans facts: odd names, bad months and duplicate competitors', () => {
    const draft = parseCallDraft(
      reply({ facts: { first_name: 'x9!', exam: { text: 'Feb', date: '2027-02-31', month: '2027-13' }, competitors: ['Acme SCA', 'Acme SCA', ''], intent: 'wat' } }),
      'm',
      NOW,
    )
    expect(draft.facts).toEqual({ firstName: null, exam: { text: 'Feb', date: null, month: null }, competitors: ['Acme SCA'], intent: 'unknown' })
  })

  it('caps the number of points', () => {
    const points = Array.from({ length: 12 }, (_, i) => ({ label: null, text: `Point ${i}` }))
    expect(parseCallDraft(reply({ points }), 'm', NOW).points).toHaveLength(8)
  })
})

describe('next steps the facts imply', () => {
  it('checks a buyer has bought three days on', () => {
    expect(impliedNextStep(facts({ intent: 'buying' }), NOW)).toMatchObject({ kind: 'check_purchase', date: '2026-10-07' })
  })

  it('asks for feedback the first Monday after the exam month ends', () => {
    const step = impliedNextStep(facts({ intent: 'feedback_only', exam: { text: 'October', date: null, month: '2026-10' } }), NOW)
    expect(step).toMatchObject({ label: 'Ask for feedback after the exam', date: '2026-11-02' })
  })

  it('or the first Monday after an exact exam date', () => {
    const step = impliedNextStep(facts({ intent: 'feedback_only', exam: { text: '22 Oct', date: '2026-10-22', month: '2026-10' } }), NOW)
    expect(step?.date).toBe('2026-10-26')
  })

  it('implies nothing without the facts to place it', () => {
    expect(impliedNextStep(facts({ intent: 'feedback_only' }), NOW)).toBeNull()
    expect(impliedNextStep(facts({ intent: 'considering' }), NOW)).toBeNull()
  })

  it('fills in a step the model left out', () => {
    const draft = parseCallDraft(reply({ facts: { first_name: null, exam: null, competitors: [], intent: 'buying' } }), 'm', NOW)
    expect(draft.suggestedNext).toMatchObject({ kind: 'check_purchase', date: '2026-10-07' })
  })

  it('moves feedback the model dated before the exam was over', () => {
    const draft = parseCallDraft(
      reply({
        facts: { first_name: null, exam: { text: 'October', date: null, month: '2026-10' }, competitors: [], intent: 'feedback_only' },
        next_step: { label: 'Ask for feedback', kind: 'call', date: '2026-10-07', time: null, why: 'after the exam' },
      }),
      'm',
      NOW,
    )
    expect(draft.suggestedNext?.date).toBe('2026-11-02')
  })

  it('trusts the model when its own step is consistent', () => {
    const draft = parseCallDraft(
      reply({
        facts: { first_name: null, exam: null, competitors: [], intent: 'buying' },
        next_step: { label: 'Call back', kind: 'call', date: '2026-10-05', time: '18:00', why: 'call me tomorrow evening' },
      }),
      'm',
      NOW,
    )
    expect(draft.suggestedNext).toMatchObject({ date: '2026-10-05', time: '18:00' })
  })
})

describe('house style and helpers', () => {
  it('replaces dashes used as punctuation', () => {
    expect(stripDashes('Keen — wants a call')).toBe('Keen, wants a call')
    expect(stripDashes('Clinic 9–5')).toBe('Clinic 9-5')
  })

  it('knows a real date from a plausible one', () => {
    expect(isRealDate('2026-10-31')).toBe(true)
    expect(isRealDate('2026-11-31')).toBe(false)
    expect(isRealDate('31/10/2026')).toBe(false)
  })

  it('saves notes as written when the AI is unavailable', () => {
    expect(manualDraft('  rang, no answer  ', 'no_answer')).toMatchObject({
      outcome: 'no_answer',
      points: [{ label: null, text: 'rang, no answer' }],
      model: null,
      suggestedNext: null,
    })
  })
})
