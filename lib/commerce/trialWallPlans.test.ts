import { describe, expect, it } from 'vitest'
import {
  IMMINENT_EXAM_DAYS,
  chooseWallPlans,
  daysToExam,
  examDateFromSitting,
} from './trialWallPlans'
import { SCA_TARGETS } from '@/lib/trial/leadFields'
import { getPlan } from './plans'

const NOW = new Date('2026-09-10T12:00:00Z')

/** `days` from NOW, as the `YYYY-MM-DD` the exam date is stored in. */
function examIn(days: number): string {
  return new Date(NOW.getTime() + days * 86_400_000).toISOString().slice(0, 10)
}

describe('chooseWallPlans', () => {
  it('offers the rolling monthly plan when the exam is close', () => {
    const wall = chooseWallPlans(examIn(20), NOW)
    expect(wall.primary).toBe('self_study_monthly')
    expect(wall.secondary).toBe('complete')
    expect(wall.proximity).toBe('imminent')
  })

  it('offers the three-month term when the exam is further out', () => {
    const wall = chooseWallPlans(examIn(120), NOW)
    expect(wall.primary).toBe('self_study')
    expect(wall.proximity).toBe('later')
  })

  it('falls back to the three-month term when no date is known', () => {
    for (const unknown of [null, undefined, '', 'not a date']) {
      const wall = chooseWallPlans(unknown, NOW)
      expect(wall.primary).toBe('self_study')
      expect(wall.proximity).toBe('unknown')
      expect(wall.daysToExam).toBeNull()
    }
  })

  it('treats a date already past as "later", never as urgent', () => {
    // Stale, or they have sat and are waiting on a result. "Your exam is in -3
    // days" is not a reason to sell a one-month plan.
    const wall = chooseWallPlans(examIn(-3), NOW)
    expect(wall.primary).toBe('self_study')
    expect(wall.proximity).toBe('later')
    expect(wall.daysToExam).toBeLessThan(0)
  })

  it('puts the boundary itself inside the imminent window', () => {
    expect(chooseWallPlans(examIn(IMMINENT_EXAM_DAYS), NOW).proximity).toBe('imminent')
    expect(chooseWallPlans(examIn(IMMINENT_EXAM_DAYS + 1), NOW).proximity).toBe('later')
  })

  it('only ever names plans the catalogue actually sells', () => {
    for (const date of [examIn(10), examIn(200), null]) {
      const wall = chooseWallPlans(date, NOW)
      expect(getPlan(wall.primary)?.cta).toBe('checkout')
      expect(getPlan(wall.secondary)?.cta).toBe('checkout')
    }
  })
})

describe('examDateFromSitting', () => {
  it('maps every published sitting to a date inside it', () => {
    expect(daysToExam(examDateFromSitting('sep_2026'), NOW)).toBeLessThan(IMMINENT_EXAM_DAYS)
    expect(examDateFromSitting('nov_2026')).toBe('2026-11-15')
    expect(examDateFromSitting('mid_2027')).toBe('2027-05-15')
  })

  it('refuses to invent a date for the answers that name none', () => {
    // "I'm not sure yet" and "2028 or later" are shrugs. Turning either into a
    // date would put somebody on the wrong plan on the strength of one.
    expect(examDateFromSitting('not_sure')).toBeNull()
    expect(examDateFromSitting('later_2028')).toBeNull()
    expect(examDateFromSitting(null)).toBeNull()
    expect(examDateFromSitting('sep_2029')).toBeNull()
  })

  it('covers every questionnaire option, or deliberately returns null for it', () => {
    // Guards the drift this file is most exposed to: a new SCA sitting added to
    // the questionnaire and not here would silently send every candidate for it
    // to the "unknown" pair.
    const undated = new Set(['not_sure', 'later_2028'])
    for (const option of SCA_TARGETS) {
      const date = examDateFromSitting(option.value)
      if (undated.has(option.value)) expect(date).toBeNull()
      else expect(date, `no date mapped for SCA sitting "${option.value}"`).not.toBeNull()
    }
  })

  it('sends a near sitting to the monthly plan and a far one to the term', () => {
    expect(chooseWallPlans(examDateFromSitting('sep_2026'), NOW).primary).toBe('self_study_monthly')
    expect(chooseWallPlans(examDateFromSitting('mid_2027'), NOW).primary).toBe('self_study')
    expect(chooseWallPlans(examDateFromSitting('not_sure'), NOW).primary).toBe('self_study')
  })
})
