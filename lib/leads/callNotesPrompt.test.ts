import { describe, expect, it } from 'vitest'
import { anchorLines, buildCallNotesUserMessage, CALENDAR_DAYS, calendarLines, CALL_NOTES_SCHEMA, CALL_NOTES_SYSTEM_PROMPT } from './callNotesPrompt'

// Sunday 4 October 2026, 11:45 in London.
const NOW = new Date('2026-10-04T10:45:00Z')

describe('the dates the model copies instead of calculating', () => {
  it('prints four weeks of calendar starting today', () => {
    const lines = calendarLines(NOW)
    expect(lines).toHaveLength(CALENDAR_DAYS)
    expect(lines[0]).toBe('Sun 4 Oct 2026 = 2026-10-04 (today)')
    expect(lines[2]).toBe('Tue 6 Oct 2026 = 2026-10-06')
    expect(lines.at(-1)).toBe('Sat 31 Oct 2026 = 2026-10-31')
  })

  it('starts "next week" on the coming Monday, even on a Sunday', () => {
    expect(anchorLines(NOW)).toContain('The coming Monday (start of "next week"): Mon 5 Oct 2026 = 2026-10-05')
  })

  it('works out the Monday after each month ends', () => {
    const anchors = anchorLines(NOW)
    expect(anchors).toContain('First Monday after October ends: Mon 2 Nov 2026 = 2026-11-02')
    // 1 Feb 2027 is itself a Monday.
    expect(anchors).toContain('First Monday after January ends: Mon 1 Feb 2027 = 2027-02-01')
  })

  it('moves "next week" a full week on mid-week days', () => {
    const wednesday = new Date('2026-10-07T10:00:00Z')
    expect(anchorLines(wednesday)).toContain('The coming Monday (start of "next week"): Mon 12 Oct 2026 = 2026-10-12')
  })
})

describe('the user message', () => {
  const message = buildCallNotesUserMessage({
    notes: '  busy, call tomorrow  ',
    lead: {
      name: null,
      examOnFile: null,
      trial: { endsAt: new Date('2026-10-07T10:54:00Z') },
      consultations: 1,
      passes: 0,
      earlierCalls: [{ at: new Date('2026-10-04T10:10:00Z'), outcome: 'no_answer', summary: null }],
    },
    now: NOW,
  })

  it('states today in UK time and what we know, without contact details', () => {
    expect(message).toContain('Today is Sunday 4 October 2026, 11:45 UK time.')
    expect(message).toContain('- Name on file: none, they signed up with only an email address')
    expect(message).toContain('- Free trial: running, ends Wed 7 Oct at 11:54')
    expect(message).toContain('- Practice so far: 1 consultation, 0 passed')
    expect(message).toContain('- Earlier calls: Sun 4 Oct 11:10, no answer')
    expect(message).not.toMatch(/@|\+44/)
  })

  it('ends with the notes verbatim, trimmed', () => {
    expect(message.endsWith('"""\nbusy, call tomorrow\n"""')).toBe(true)
  })

  it('gives the time words as anchors', () => {
    expect(message).toContain('"after clinic", "after work" or "evening" = 18:00')
  })
})

describe('the contract', () => {
  it('requires every key, as strict structured outputs demand', () => {
    expect(CALL_NOTES_SCHEMA.required).toEqual(['outcome', 'points', 'facts', 'next_step'])
    expect(CALL_NOTES_SCHEMA.additionalProperties).toBe(false)
  })

  it('tells the model points are not a form', () => {
    expect(CALL_NOTES_SYSTEM_PROMPT).toContain('Labels are not a form')
  })
})
