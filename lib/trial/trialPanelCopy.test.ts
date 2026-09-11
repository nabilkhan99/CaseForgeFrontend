import { describe, expect, it } from 'vitest'
import {
  formatTrialEndDay,
  numberWord,
  trialCountdown,
  trialProgressLine,
  trialTitleLine,
} from './trialPanelCopy'

/**
 * The dashboard panel's sentences.
 *
 * These are pinned as functions rather than reviewed in a rendered component
 * because they are the product's own account of a deadline somebody is planning
 * their week around, and a day out is the kind of error only the person it costs
 * ever notices. The three that matter:
 *   * a window that has not opened says so, rather than counting from nothing;
 *   * a few hours left reads as "Ends today", never "0 days left";
 *   * nothing anywhere counts stations down.
 */

describe('trialTitleLine', () => {
  it('leads with the thing that changed', () => {
    // "Unlimited attempts" first, deliberately: a trainee who saw the old
    // five-consultation offer is rationing, and that is the behaviour this
    // sentence exists to correct.
    expect(trialTitleLine(5)).toBe('Unlimited attempts · five cases')
  })

  it('describes the bank it actually has', () => {
    // The flag decides which cases are free, so a bank with four flagged says
    // four rather than promising a fifth that does not exist.
    expect(trialTitleLine(4)).toBe('Unlimited attempts · four cases')
    expect(trialTitleLine(1)).toBe('Unlimited attempts · one case')
  })
})

describe('trialProgressLine', () => {
  it('counts cases, not consultations', () => {
    expect(trialProgressLine(3, 5)).toBe('3 of 5 cases tried')
  })

  it('never reports more cases than there are', () => {
    expect(trialProgressLine(9, 5)).toBe('5 of 5 cases tried')
  })

  it('starts at zero rather than at nothing', () => {
    expect(trialProgressLine(0, 5)).toBe('0 of 5 cases tried')
  })
})

describe('trialCountdown', () => {
  it('says the clock has not started, before the first consultation', () => {
    // The most common question the old strip left unanswered: somebody handed
    // a link on a Friday needs to know the weekend is not being spent.
    const countdown = trialCountdown(null, null, 5)
    expect(countdown.headline).toBe('Your five days start with your first consultation')
    expect(countdown.endsOn).toBeNull()
    expect(countdown.urgent).toBe(false)
  })

  it('counts the days down, with the date beside them', () => {
    const countdown = trialCountdown(3, '2026-09-12T09:00:00Z', 5)
    expect(countdown.headline).toBe('3 days left')
    expect(countdown.endsOn).toMatch(/September/)
    expect(countdown.urgent).toBe(false)
  })

  it('says "Ends today" on the last day rather than "1 day left"', () => {
    // `daysLeft` is rounded up on the server, so 1 means "within the day".
    const countdown = trialCountdown(1, '2026-09-12T09:00:00Z', 5)
    expect(countdown.headline).toBe('Ends today')
    expect(countdown.urgent).toBe(true)
  })

  it('says the days are up once they are', () => {
    expect(trialCountdown(0, '2026-09-12T09:00:00Z', 5)).toMatchObject({
      headline: 'Your five days are up',
      urgent: true,
    })
  })

  it('honours a window that is not five days', () => {
    expect(trialCountdown(null, null, 7).headline).toBe(
      'Your seven days start with your first consultation',
    )
  })

  it('never counts stations', () => {
    for (const days of [null, 0, 1, 2, 5]) {
      expect(trialCountdown(days, '2026-09-12T09:00:00Z', 5).headline).not.toMatch(/station/i)
    }
  })

  it('names the five in the same noun as the line above it', () => {
    // The title and the progress line count the same five things. Naming them
    // differently ("five stations" over "3 of 5 cases tried") reads as two
    // separate allowances.
    expect(trialTitleLine(5)).not.toMatch(/station/i)
    expect(trialProgressLine(3, 5)).not.toMatch(/station/i)
  })
})

describe('formatTrialEndDay', () => {
  it('names the day, not just the date', () => {
    // Deliberately not pinned to a timezone: this formats a real instant in the
    // READER's own, which is the true answer to "when does this stop working".
    // Asserting a fixed day here would only pin the machine the tests run on.
    expect(formatTrialEndDay('2026-09-11T12:00:00Z')).toMatch(/^\w+day \d{1,2} September$/)
  })

  it('returns nothing usable for a value that is not a date', () => {
    // The panel treats an empty string as "no date to show" rather than
    // rendering "Invalid Date" under a deadline.
    expect(formatTrialEndDay('not-a-date')).toBe('')
  })
})

describe('numberWord', () => {
  it('spells small numbers and gives up gracefully on large ones', () => {
    expect(numberWord(0)).toBe('no')
    expect(numberWord(5)).toBe('five')
    expect(numberWord(42)).toBe('42')
  })
})
