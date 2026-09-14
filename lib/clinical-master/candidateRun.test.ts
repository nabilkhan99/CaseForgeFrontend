import { describe, expect, it } from 'vitest'
import { candidateRun } from './candidateRun'

/**
 * The number the "not enough to mark fairly" screen quotes back at someone. It
 * is re-derived from the transcript rather than stored, so the risk it carries
 * is arithmetic: mixing the two clocks a transcript can hold would turn a
 * 40-second run into a number of decades.
 */

const iso = (seconds: number) => new Date(Date.parse('2026-09-06T12:00:00Z') + seconds * 1000).toISOString()

describe('candidateRun', () => {
  it('measures the span between the first and last candidate turn', () => {
    expect(
      candidateRun([
        { speaker: 'candidate', text: 'Hello, what brings you in?', start_ms: 2_000 },
        { speaker: 'patient', text: 'My head hurts.', start_ms: 6_000 },
        { speaker: 'candidate', text: 'How long for?', start_ms: 44_000 },
      ]),
    ).toEqual({ turns: 2, seconds: 42 })
  })

  it('reads the legacy capture shape', () => {
    // Rows written before the spec shape landed carry role/content/timestamp.
    expect(
      candidateRun([
        { role: 'user', content: 'Hello there', timestamp: iso(0) },
        { role: 'assistant', content: 'Hi doctor', timestamp: iso(5) },
        { role: 'user', content: 'Tell me more', timestamp: iso(31) },
      ]),
    ).toEqual({ turns: 2, seconds: 31 })
  })

  it('never mixes the two clocks', () => {
    // start_ms counts from the start of the consultation; timestamp is a
    // wall-clock instant. Averaged together they would put the span in decades,
    // so the clock with two readings wins outright — here, start_ms.
    expect(
      candidateRun([
        { speaker: 'candidate', text: 'One', start_ms: 1_000, timestamp: iso(0) },
        { speaker: 'candidate', text: 'Two', start_ms: 21_000, timestamp: iso(20) },
      ]).seconds,
    ).toBe(20)
  })

  it('falls back to the wall clock when start_ms is absent', () => {
    expect(
      candidateRun([
        { speaker: 'candidate', text: 'One', timestamp: iso(0) },
        { speaker: 'candidate', text: 'Two', timestamp: iso(75) },
      ]).seconds,
    ).toBe(75)
  })

  it('counts only the candidate, and only when they said something', () => {
    expect(
      candidateRun([
        { speaker: 'patient', text: 'Hello?', start_ms: 0 },
        { speaker: 'candidate', text: '   ', start_ms: 1_000 },
        { speaker: 'candidate', text: 'Sorry, hello', start_ms: 2_000 },
        { role: 'assistant', content: 'No problem', timestamp: iso(3) },
      ]).turns,
    ).toBe(1)
  })

  it('returns zero seconds for a single turn', () => {
    // One turn is a point, not a span — and 1-turn transcripts are exactly what
    // the guard exists to refuse.
    expect(candidateRun([{ speaker: 'candidate', text: 'Hello', start_ms: 4_000 }])).toEqual({
      turns: 1,
      seconds: 0,
    })
  })

  it('survives an absent or malformed transcript', () => {
    const empty = { turns: 0, seconds: 0 }
    expect(candidateRun(null)).toEqual(empty)
    expect(candidateRun(undefined)).toEqual(empty)
    expect(candidateRun('not a transcript')).toEqual(empty)
    expect(candidateRun([null, 42, { speaker: 'candidate' }])).toEqual(empty)
  })

  it('ignores unparseable timestamps rather than counting from 1970', () => {
    expect(
      candidateRun([
        { speaker: 'candidate', text: 'One', timestamp: 'not a date' },
        { speaker: 'candidate', text: 'Two', timestamp: iso(10) },
      ]).seconds,
    ).toBe(0)
  })
})
