import { describe, expect, it } from 'vitest'
import {
  DAY5_STALE_AFTER_DAYS,
  decideTrialEmail,
  isExcludedAddress,
  selectDueTrialEmails,
  windowEndsAt,
  type TrialEmailCandidate,
} from './dueRules'

const DAY = 86_400_000
const STARTED = new Date('2026-09-01T09:00:00Z')
const EXPIRES = new Date(STARTED.getTime() + 5 * DAY)

/** A trainee three days in, two stations marked, both near misses. */
function candidate(overrides: Partial<TrialEmailCandidate> = {}): TrialEmailCandidate {
  return {
    userId: 'user-1',
    email: 'trainee@nhs.net',
    firstName: 'Jane',
    allowance: 5,
    windowDays: 5,
    startedAt: STARTED,
    expiresAt: EXPIRES,
    marks: [{ verdict: 'Bare Fail' }, { verdict: 'Bare Fail' }],
    lastMarkAt: new Date(STARTED.getTime() + 2 * DAY),
    hasPurchase: false,
    alreadySent: [],
    ...overrides,
  }
}

const at = (days: number) => new Date(STARTED.getTime() + days * DAY)

describe('isExcludedAddress', () => {
  it('excludes our own addresses', () => {
    expect(isExcludedAddress('nabilkhan99@gmail.com')).toBe(true)
    expect(isExcludedAddress('ishaq.miah@example.com')).toBe(true)
    expect(isExcludedAddress('hello@useoffscript.com')).toBe(true)
    expect(isExcludedAddress('someone@shalimar-clinic.co.uk')).toBe(true)
    expect(isExcludedAddress('TEAM@useoffscript.com')).toBe(true)
  })

  it('excludes throwaway inboxes, including subdomains of them', () => {
    expect(isExcludedAddress('gp@mailinator.com')).toBe(true)
    expect(isExcludedAddress('gp@mail.yopmail.com')).toBe(true)
  })

  it('excludes anything that is not an address at all', () => {
    expect(isExcludedAddress('')).toBe(true)
    expect(isExcludedAddress('   ')).toBe(true)
    expect(isExcludedAddress('not-an-email')).toBe(true)
  })

  it('lets a real trainee through', () => {
    expect(isExcludedAddress('jane.smith@nhs.net')).toBe(false)
    expect(isExcludedAddress('  Jane.Smith@NHS.net ')).toBe(false)
  })
})

describe('windowEndsAt', () => {
  it('prefers the stamped expiry', () => {
    expect(windowEndsAt(candidate())).toEqual(EXPIRES)
  })

  it('derives one from started_at when the pair is missing', () => {
    expect(windowEndsAt(candidate({ expiresAt: null }))).toEqual(EXPIRES)
  })

  it('is null while the window has not opened', () => {
    expect(windowEndsAt(candidate({ startedAt: null, expiresAt: null }))).toBeNull()
  })
})

describe('decideTrialEmail — day 3', () => {
  it('is due on day 3 with stations left', () => {
    expect(decideTrialEmail(candidate(), at(3))).toEqual({
      due: true,
      kind: 'day3',
      remaining: 3,
      endsAt: EXPIRES,
    })
  })

  it('is not due before day 3', () => {
    expect(decideTrialEmail(candidate(), at(2.9))).toEqual({ due: false, reason: 'too_early' })
  })

  it('stops being sendable once the sentence "two days left" stops being true', () => {
    expect(decideTrialEmail(candidate(), at(4.01))).toEqual({
      due: false,
      reason: 'day3_window_missed',
    })
  })

  it('is not sent twice', () => {
    expect(decideTrialEmail(candidate({ alreadySent: ['day3'] }), at(3))).toEqual({
      due: false,
      reason: 'already_sent',
    })
  })

  it('is not sent to an account that has spent the allowance', () => {
    const spent = candidate({
      marks: Array.from({ length: 5 }, () => ({ verdict: 'Bare Fail' })),
    })
    // Day 5's email, on day 3: the trial is over even though the clock is not.
    expect(decideTrialEmail(spent, at(3))).toMatchObject({ due: true, kind: 'day5' })
  })
})

describe('decideTrialEmail — day 5', () => {
  it('is due once the window has run out', () => {
    expect(decideTrialEmail(candidate(), at(5))).toMatchObject({
      due: true,
      kind: 'day5',
      remaining: 3,
    })
  })

  it('is due the moment the fifth station is marked, whatever the clock says', () => {
    const spent = candidate({
      marks: Array.from({ length: 5 }, () => ({ verdict: 'Pass' })),
      lastMarkAt: at(1),
    })
    expect(decideTrialEmail(spent, at(1.1))).toMatchObject({ due: true, kind: 'day5', remaining: 0 })
  })

  it('is not sent twice', () => {
    expect(decideTrialEmail(candidate({ alreadySent: ['day5'] }), at(6))).toEqual({
      due: false,
      reason: 'already_sent',
    })
  })

  it('will not mail a window that ended a fortnight ago', () => {
    expect(decideTrialEmail(candidate(), at(5 + DAY5_STALE_AFTER_DAYS + 0.1))).toEqual({
      due: false,
      reason: 'day5_stale',
    })
  })

  it('measures staleness from the last mark when the allowance ran out first', () => {
    const spent = candidate({
      marks: Array.from({ length: 5 }, () => ({ verdict: 'Pass' })),
      lastMarkAt: at(1),
    })
    // Day 1 + 14 days is day 15, so day 15.1 is stale even though the window
    // itself only ended on day 5.
    expect(decideTrialEmail(spent, at(15.1))).toEqual({ due: false, reason: 'day5_stale' })
    expect(decideTrialEmail(spent, at(14.9))).toMatchObject({ due: true, kind: 'day5' })
  })
})

describe('decideTrialEmail — exclusions', () => {
  it('never mails a buyer, whatever the dates say', () => {
    expect(decideTrialEmail(candidate({ hasPurchase: true }), at(3))).toEqual({
      due: false,
      reason: 'buyer',
    })
    expect(decideTrialEmail(candidate({ hasPurchase: true }), at(6))).toEqual({
      due: false,
      reason: 'buyer',
    })
  })

  it('never mails one of our own addresses', () => {
    expect(decideTrialEmail(candidate({ email: 'nabilkhan99@gmail.com' }), at(3))).toEqual({
      due: false,
      reason: 'excluded_address',
    })
  })

  it('leaves a grant whose window never opened alone, however old it is', () => {
    const unstarted = candidate({ startedAt: null, expiresAt: null, marks: [], lastMarkAt: null })
    expect(decideTrialEmail(unstarted, at(90))).toEqual({ due: false, reason: 'not_started' })
  })
})

describe('selectDueTrialEmails', () => {
  it('splits a batch into who is due what, and who is not and why', () => {
    const batch: TrialEmailCandidate[] = [
      candidate({ userId: 'due-day3' }),
      candidate({ userId: 'due-day5', marks: Array.from({ length: 5 }, () => ({ verdict: 'Fail' })) }),
      candidate({ userId: 'bought', hasPurchase: true }),
      candidate({ userId: 'internal', email: 'hello@fourteenfisherman.com' }),
      candidate({ userId: 'sent', alreadySent: ['day3'] }),
      candidate({ userId: 'unstarted', startedAt: null, expiresAt: null }),
    ]

    const { due, skipped } = selectDueTrialEmails(batch, at(3))

    expect(due.map((row) => [row.candidate.userId, row.kind])).toEqual([
      ['due-day3', 'day3'],
      ['due-day5', 'day5'],
    ])
    expect(skipped.map((row) => [row.candidate.userId, row.reason])).toEqual([
      ['bought', 'buyer'],
      ['internal', 'excluded_address'],
      ['sent', 'already_sent'],
      ['unstarted', 'not_started'],
    ])
  })
})
