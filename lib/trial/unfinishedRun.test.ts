import { describe, expect, it } from 'vitest'
import {
  DEFAULT_CONSULTATION_SECONDS,
  UNFINISHED_GRACE_SECONDS,
  consultationSeconds,
  isUnfinishedRun,
} from './unfinishedRun'

/**
 * The five-minute lie: /try/feedback told anybody whose row was still `live`
 * that their consultation was being marked, for a hundred polls, on a mark that
 * was never requested. These are the edges of the rule that ends that wait —
 * and, just as importantly, the edges where it must NOT fire, because calling a
 * finished consultation abandoned would be the worse mistake.
 */

const STARTED = '2026-09-11T10:00:00.000Z'
const startedMs = Date.parse(STARTED)
const DURATION = 720

/** `nowMs` this many seconds after the consultation opened. */
function at(seconds: number): number {
  return startedMs + seconds * 1000
}

describe('isUnfinishedRun', () => {
  it('waits while a consultation could still be running', () => {
    expect(
      isUnfinishedRun({
        status: 'live',
        startedAt: STARTED,
        durationSeconds: DURATION,
        transcriptTurns: 8,
        nowMs: at(300),
      }),
    ).toBe(false)
  })

  it('waits through the grace, for the save and the mark', () => {
    // The clock has run out but the transcript save and an 80–90 second mark
    // both happen after the last word.
    expect(
      isUnfinishedRun({
        status: 'live',
        startedAt: STARTED,
        durationSeconds: DURATION,
        transcriptTurns: 8,
        nowMs: at(DURATION + UNFINISHED_GRACE_SECONDS - 1),
      }),
    ).toBe(false)
  })

  it('gives up once the grace is spent', () => {
    expect(
      isUnfinishedRun({
        status: 'live',
        startedAt: STARTED,
        durationSeconds: DURATION,
        transcriptTurns: 8,
        nowMs: at(DURATION + UNFINISHED_GRACE_SECONDS + 1),
      }),
    ).toBe(true)
  })

  it('needs no grace when nothing was ever said', () => {
    // An empty transcript is nothing for a mark to be waiting on, so the
    // consultation's own clock is the whole test.
    expect(
      isUnfinishedRun({
        status: 'live',
        startedAt: STARTED,
        durationSeconds: DURATION,
        transcriptTurns: 0,
        nowMs: at(DURATION + 1),
      }),
    ).toBe(true)
    // And still not before it: a silent first minute is a nervous trainee.
    expect(
      isUnfinishedRun({
        status: 'live',
        startedAt: STARTED,
        durationSeconds: DURATION,
        transcriptTurns: 0,
        nowMs: at(60),
      }),
    ).toBe(false)
  })

  it('covers a session abandoned on the reading page too', () => {
    expect(
      isUnfinishedRun({
        status: 'reading',
        startedAt: STARTED,
        durationSeconds: DURATION,
        nowMs: at(DURATION + 5),
      }),
    ).toBe(true)
  })

  it('never fires on a status that is somebody’s answer', () => {
    // `processing` is being marked; the rest have been answered already. A day
    // later, none of them is "unfinished".
    for (const status of ['processing', 'completed', 'unmarkable', 'abandoned']) {
      expect(
        isUnfinishedRun({
          status,
          startedAt: STARTED,
          durationSeconds: DURATION,
          nowMs: at(86_400),
        }),
        status,
      ).toBe(false)
    }
  })

  it('keeps waiting when the start cannot be read', () => {
    // No evidence of age is not evidence of abandonment.
    for (const startedAt of [null, undefined, '', 'not a date']) {
      expect(
        isUnfinishedRun({ status: 'live', startedAt, durationSeconds: DURATION, nowMs: at(86_400) }),
        String(startedAt),
      ).toBe(false)
    }
  })

  it('falls back to twelve minutes when the station does not say', () => {
    expect(consultationSeconds(null)).toBe(DEFAULT_CONSULTATION_SECONDS)
    expect(consultationSeconds(0)).toBe(DEFAULT_CONSULTATION_SECONDS)
    expect(consultationSeconds('480')).toBe(480)
    expect(
      isUnfinishedRun({
        status: 'live',
        startedAt: STARTED,
        transcriptTurns: 3,
        nowMs: at(DEFAULT_CONSULTATION_SECONDS + UNFINISHED_GRACE_SECONDS + 1),
      }),
    ).toBe(true)
  })
})
