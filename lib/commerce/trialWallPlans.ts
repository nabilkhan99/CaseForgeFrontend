import type { PlanKey } from './plans'

/**
 * Which two plans the trial wall offers, chosen by how close the exam is.
 *
 * Two, not four. Someone who has just used their five stations is deciding
 * whether to keep going, not comparing a catalogue — and the right pair depends
 * entirely on one fact: an exam six weeks out makes a three-month term
 * expensive for the time it buys, while an exam six months out makes a rolling
 * monthly plan expensive for the time it will run. So:
 *
 *   exam within ~6 weeks → £129 rolling monthly + Complete
 *   exam further out, or unknown → £299 Self-Study (3 months) + Complete
 *
 * Complete is on both because it is the only tier that carries the lectures and
 * the coaching day, and that argument does not change with the date.
 *
 * A quiet "see all plans" link belongs beside whichever pair this returns; the
 * point is to make a choice easy, not to hide the other two.
 */

/** Inside this many days to the SCA, the rolling monthly plan is the honest offer. */
export const IMMINENT_EXAM_DAYS = 42

const DAY_MS = 86_400_000

export type ExamProximity = 'imminent' | 'later' | 'unknown'

export interface WallPlans {
  /** The plan to lead with. */
  primary: PlanKey
  /** Complete, always — the tier argument is date-independent. */
  secondary: PlanKey
  proximity: ExamProximity
  /** Days to the exam, when one is known. Negative if it has already been sat. */
  daysToExam: number | null
}

/**
 * A representative date for each `trial_leads.sca_sitting` answer.
 *
 * The questionnaire records a WINDOW ("Early 2027 (January to April)"), not a
 * date, so this maps each answer to the point in it that a plan decision should
 * be made against: the published sittings to the month they run in, the
 * open-ended periods to the START of the period, because starting to revise for
 * a May exam in January is right and the reverse is not.
 *
 * `not_sure` and `later_2028` are deliberately absent — both mean "no useful
 * date", and inventing one would put somebody on the wrong plan on the strength
 * of a shrug. They fall through to `unknown`, which is the £299 pair.
 *
 * Values checked against SCA_TARGETS in lib/trial/leadFields.ts. A value that
 * is not here simply returns null, so adding a sitting there before adding it
 * here degrades to "unknown" rather than crashing.
 */
export const SCA_SITTING_DATES: Readonly<Record<string, string>> = Object.freeze({
  sep_2026: '2026-09-15',
  oct_2026: '2026-10-15',
  nov_2026: '2026-11-15',
  early_2027: '2027-01-15',
  mid_2027: '2027-05-15',
  late_2027: '2027-09-15',
})

/** The date behind a questionnaire sitting answer, or null when it names no useful one. */
export function examDateFromSitting(sitting: string | null | undefined): string | null {
  if (!sitting) return null
  return SCA_SITTING_DATES[sitting] ?? null
}

/** Whole days from `now` to a `YYYY-MM-DD` exam date, or null when it is not a date. */
export function daysToExam(examDate: string | null | undefined, now: Date): number | null {
  if (!examDate) return null
  const when = new Date(examDate)
  if (Number.isNaN(when.getTime())) return null
  return Math.ceil((when.getTime() - now.getTime()) / DAY_MS)
}

/**
 * The two plans to put on the wall.
 *
 * An exam date already in the past reads as `later`, not `imminent`: it is
 * either stale or they have sat and are waiting on a result, and in neither case
 * is "your exam is in -3 days" a reason to sell a one-month plan.
 */
export function chooseWallPlans(examDate: string | null | undefined, now: Date = new Date()): WallPlans {
  const days = daysToExam(examDate, now)
  const proximity: ExamProximity =
    days === null ? 'unknown' : days > 0 && days <= IMMINENT_EXAM_DAYS ? 'imminent' : 'later'

  return {
    primary: proximity === 'imminent' ? 'self_study_monthly' : 'self_study',
    secondary: 'complete',
    proximity,
    daysToExam: days,
  }
}
