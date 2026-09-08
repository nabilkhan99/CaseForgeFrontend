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

/** A trainee three days in, two of the five cases sat, both near misses. */
function candidate(overrides: Partial<TrialEmailCandidate> = {}): TrialEmailCandidate {
  return {
    userId: 'user-1',
    email: 'trainee@nhs.net',
    firstName: 'Jane',
    casesTotal: 5,
    casesTried: 2,
    windowDays: 5,
    startedAt: STARTED,
    expiresAt: EXPIRES,
    marks: [{ verdict: 'Bare Fail' }, { verdict: 'Bare Fail' }],
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
  it('is due on day 3, carrying the days left and the cases tried', () => {
    expect(decideTrialEmail(candidate(), at(3))).toEqual({
      due: true,
      kind: 'day3',
      daysLeft: 2,
      casesTried: 2,
      casesTotal: 5,
      endsAt: EXPIRES,
    })
  })

  it('rounds the days left up, so an afternoon still counts as a day', () => {
    // The subject line says the number. A window with eight hours in it must
    // not tell somebody they have zero days left of a trial they can still use.
    expect(decideTrialEmail(candidate(), at(3.7))).toMatchObject({ daysLeft: 2 })
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

  it('is still due for somebody who has sat all five cases', () => {
    // THE RULE THAT CHANGED. Under the allowance, five marks ended the trial
    // and this person got day 5 on day 3. Attempts are unlimited now, so
    // trying every case is not using anything up — they have two days left and
    // the email that says so is the useful one.
    const everyCase = candidate({
      casesTried: 5,
      marks: Array.from({ length: 9 }, () => ({ verdict: 'Bare Fail' })),
    })
    expect(decideTrialEmail(everyCase, at(3))).toMatchObject({
      due: true,
      kind: 'day3',
      casesTried: 5,
    })
  })

  it('clamps cases tried to the number of cases there are', () => {
    expect(decideTrialEmail(candidate({ casesTried: 9 }), at(3))).toMatchObject({ casesTried: 5 })
  })
})

describe('decideTrialEmail — day 5', () => {
  it('is due once the window has run out, and only then', () => {
    // EXPIRY IS THE WHOLE RULE. There is no allowance left to exhaust, so the
    // calendar is the only thing that can bring somebody here.
    expect(decideTrialEmail(candidate(), at(5))).toMatchObject({
      due: true,
      kind: 'day5',
      daysLeft: 0,
      casesTried: 2,
      casesTotal: 5,
    })
  })

  it('is never due early, however much practice has been done', () => {
    const busy = candidate({
      casesTried: 5,
      marks: Array.from({ length: 20 }, () => ({ verdict: 'Pass' })),
    })
    expect(decideTrialEmail(busy, at(4.9))).not.toMatchObject({ kind: 'day5' })
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

  it('measures staleness from the end of the window, for everybody', () => {
    // The old rule measured from the last mark when the allowance had run out
    // first. With expiry as the only ending there is one clock, which is the
    // one on the grant.
    expect(decideTrialEmail(candidate(), at(5 + DAY5_STALE_AFTER_DAYS - 0.1))).toMatchObject({
      due: true,
      kind: 'day5',
    })
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
    const unstarted = candidate({ startedAt: null, expiresAt: null, marks: [], casesTried: 0 })
    expect(decideTrialEmail(unstarted, at(90))).toEqual({ due: false, reason: 'not_started' })
  })
})

describe('selectDueTrialEmails', () => {
  it('splits a batch into who is due what, and who is not and why', () => {
    const batch: TrialEmailCandidate[] = [
      candidate({ userId: 'due-day3' }),
      // Expired four days ago, so day 5 is what they are due.
      candidate({
        userId: 'due-day5',
        startedAt: at(-2),
        expiresAt: at(3),
      }),
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
