import type { TrainerSession, TrainerStudent } from '@/app/api/trainer/overview/route';
import { MAX_WEIGHTED_SCORE } from '@/lib/clinical-master/types';

/**
 * The arithmetic behind the Students tab — the stat band, and the series the
 * chart draws.
 *
 * Pure, and separate from the page for the same reason
 * lib/development/domainAverages.ts is: these are the four numbers a trainer
 * will quote to a student, they are recomputed on every filter change, and
 * "sessions" meaning something different from the length of the list below it
 * is the kind of quiet wrong that survives for months.
 */

/**
 * One colour per student, by cohort join order.
 *
 * Amber is the product's own primary, so the trainer's first student reads as
 * part of the page rather than as a chart legend bolted onto it; teal and blue
 * are the two hues that stay distinguishable from it and from each other at a
 * 2.5px stroke, without either reading as a pass/fail signal — green and red
 * are spoken for by the verdict pills three inches below.
 *
 * A fourth student wraps around. That is a deliberate limit rather than an
 * oversight: this is a three-student pilot, and inventing a fourth colour that
 * has not been checked against the other three would be a worse failure than
 * two students sharing one.
 */
export const STUDENT_COLOURS = ['#B45309', '#0D9488', '#1D4ED8'] as const;

export function studentColour(index: number): string {
  return STUDENT_COLOURS[index % STUDENT_COLOURS.length];
}

/** A student's display name — their own, their email's local part, or nothing. */
export function studentName(student: TrainerStudent): string {
  if (student.fullName?.trim()) return student.fullName.trim();
  const local = student.email?.split('@')[0];
  return local?.trim() || 'Student';
}

/** Seven days, the window "This week" means. Rolling, not calendar. */
const WEEK_MS = 7 * 24 * 60 * 60 * 1000;

export interface CohortStats {
  /** Every session sat, marked or not — it has to match the list below it. */
  sessions: number;
  /** Mean weighted score across MARKED sessions only; null when none are. */
  averageScore: number | null;
  maxScore: number;
  /** Passed as a percentage of marked sessions; null when none are. */
  passRate: number | null;
  /** Sessions started in the last seven days. */
  thisWeek: number;
}

/**
 * True when a session carries a real mark.
 *
 * A score of zero is excluded, matching the rule the Development page's domain
 * dials apply: those rows are the engine having marked an empty transcript, and
 * folding them in would drag a cohort average down for consultations that never
 * happened.
 */
export function isScored(session: TrainerSession): boolean {
  return session.weightedScore !== null && session.weightedScore > 0;
}

/** Still being marked — the amber pill, not a missing score. */
export function isMarking(session: TrainerSession): boolean {
  return !isScored(session) && session.status === 'processing';
}

/**
 * The stat band's four numbers over whatever the filter left.
 *
 * Sessions counts everything; the average and the pass rate count only what was
 * marked. Two denominators on one row is a real risk of being misread, which is
 * why the band labels the middle two "of N marked" rather than leaving a reader
 * to assume they share the first figure.
 */
export function summariseCohort(
  sessions: readonly TrainerSession[],
  now: Date = new Date(),
): CohortStats {
  const scored = sessions.filter(isScored);
  const total = scored.reduce((sum, session) => sum + (session.weightedScore ?? 0), 0);
  const cutoff = now.getTime() - WEEK_MS;

  return {
    sessions: sessions.length,
    averageScore: scored.length > 0 ? total / scored.length : null,
    // Every current report is out of 10.5; a mixed set falls back to the
    // default rather than averaging two different denominators together.
    maxScore: scored[0]?.maxScore ?? MAX_WEIGHTED_SCORE,
    passRate:
      scored.length > 0
        ? Math.round((scored.filter((session) => session.passed).length / scored.length) * 100)
        : null,
    thisWeek: sessions.filter((session) => {
      const started = new Date(session.startedAt).getTime();
      return Number.isFinite(started) && started >= cutoff;
    }).length,
  };
}

/** How many of these sessions carry a real mark — the band's second denominator. */
export function markedCount(sessions: readonly TrainerSession[]): number {
  return sessions.filter(isScored).length;
}

/** Every visible student's sessions in one list, newest first. */
export function mergeSessions(students: readonly TrainerStudent[]): TrainerSession[] {
  return students
    .flatMap((student) => student.sessions)
    .slice()
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
}
