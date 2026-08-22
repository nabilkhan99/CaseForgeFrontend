/**
 * The SCA pass mark, and the one place any surface asks "did this pass?".
 *
 * The marking engine decides the verdict server side
 * (CaseForgeAzure `app/utils/verdict.py`), from the three domain grades:
 *
 *     s = g(D1) + 1.5 * g(D2) + g(D3)    g(CP)=3, g(P)=2, g(F)=1, g(CF)=0
 *     Pass        s >= 7.0
 *     Bare Pass   s >= 6.0     <- the pass mark
 *     Bare Fail   s >= 4.5
 *     Fail        s <  4.5
 *
 * The number 6.0 used to exist only in that Python file, so the product could
 * tell a trainee "Bare Fail" but never "you were 0.5 short" — which is the
 * question anyone doing forty cases actually asks. Everything that renders a
 * score now reads the threshold from here.
 */
import {
  MAX_WEIGHTED_SCORE,
  PASSING_VERDICTS,
  type Grade,
  type Verdict,
} from './types';

/** Lowest weighted score that passes (the Bare Pass floor), out of 10.5. */
export const PASS_MARK = 6.0;
/** Lowest weighted score that reaches a clear Pass, out of 10.5. */
export const CLEAR_PASS_MARK = 7.0;
/** Lowest weighted score that reaches Bare Fail — below this is a clear Fail. */
export const BARE_FAIL_FLOOR = 4.5;

/** How a result should be coloured. Three tones only: green, amber, red. */
export type ResultTone = 'pass' | 'borderline' | 'fail';

/** Bar / fill classes per tone. Success green, primary amber, danger red. */
export const TONE_BAR_CLASS: Record<ResultTone, string> = {
  pass: 'bg-success',
  borderline: 'bg-primary',
  fail: 'bg-danger',
};

/** Inline colours for the same three tones (for `style` props). */
export const TONE_COLOUR: Record<ResultTone, string> = {
  pass: '#16A34A',
  borderline: '#B45309',
  fail: '#DC2626',
};

function isDefaultMax(maxScore: number): boolean {
  return Math.abs(maxScore - MAX_WEIGHTED_SCORE) < 0.001;
}

function round1(value: number): number {
  return Math.round(value * 10) / 10;
}

/**
 * The pass mark for a report scored out of `maxScore`. Every current report is
 * out of 10.5; a report on another scale is rescaled proportionally rather than
 * being told it passes at 6.0 out of something else.
 */
export function passMarkFor(maxScore: number = MAX_WEIGHTED_SCORE): number {
  if (!Number.isFinite(maxScore) || maxScore <= 0) return PASS_MARK;
  if (isDefaultMax(maxScore)) return PASS_MARK;
  return round1((PASS_MARK / MAX_WEIGHTED_SCORE) * maxScore);
}

/** The pass mark as a percentage of the maximum (57% of 10.5). */
export function passMarkPercent(maxScore: number = MAX_WEIGHTED_SCORE): number {
  const max = Number.isFinite(maxScore) && maxScore > 0 ? maxScore : MAX_WEIGHTED_SCORE;
  return Math.round((passMarkFor(max) / max) * 100);
}

/** The clear-fail boundary as a percentage of the maximum (43% of 10.5). */
export function bareFailPercent(maxScore: number = MAX_WEIGHTED_SCORE): number {
  const max = Number.isFinite(maxScore) && maxScore > 0 ? maxScore : MAX_WEIGHTED_SCORE;
  const floor = isDefaultMax(max) ? BARE_FAIL_FLOOR : (BARE_FAIL_FLOOR / MAX_WEIGHTED_SCORE) * max;
  return Math.round((floor / max) * 100);
}

/** One decimal place, always — "6.0", never "6". */
export function fmtMark(value: number): string {
  return value.toFixed(1);
}

/** "6.0 / 10.5 to pass" — the caption that sits next to a score. */
export function passMarkCaption(maxScore: number = MAX_WEIGHTED_SCORE): string {
  const max = Number.isFinite(maxScore) && maxScore > 0 ? maxScore : MAX_WEIGHTED_SCORE;
  return `${fmtMark(passMarkFor(max))} / ${fmtMark(max)} to pass`;
}

/** The verdict band a weighted score falls in (mirrors verdict_band()). */
export function verdictForScore(
  score: number,
  maxScore: number = MAX_WEIGHTED_SCORE
): Verdict {
  const max = Number.isFinite(maxScore) && maxScore > 0 ? maxScore : MAX_WEIGHTED_SCORE;
  const scale = isDefaultMax(max) ? 1 : MAX_WEIGHTED_SCORE / max;
  const normalised = score * scale;
  if (normalised >= CLEAR_PASS_MARK) return 'Pass';
  if (normalised >= PASS_MARK) return 'Bare Pass';
  if (normalised >= BARE_FAIL_FLOOR) return 'Bare Fail';
  return 'Fail';
}

/** True for the two passing verdict bands, tolerant of raw DB strings. */
export function isPassingVerdict(verdict: string | null | undefined): boolean {
  if (!verdict) return false;
  return (PASSING_VERDICTS as readonly string[]).includes(verdict);
}

export interface PassMargin {
  passed: boolean;
  /** Absolute distance from the pass mark, one decimal place. */
  margin: number;
}

/** How far a score sits from the pass mark, and on which side. */
export function passMargin(
  score: number,
  maxScore: number = MAX_WEIGHTED_SCORE
): PassMargin {
  const mark = passMarkFor(maxScore);
  const margin = round1(Math.abs(score - mark));
  return { passed: score >= mark, margin };
}

/**
 * The sentence the report puts under the verdict.
 *
 * "Pass mark 6.0 / 10.5 — 0.5 short." is a materially different fact from
 * "Bare Fail", and it is the one the trainee needs.
 */
export function passMarkSentence(
  score: number,
  maxScore: number = MAX_WEIGHTED_SCORE
): string {
  const max = Number.isFinite(maxScore) && maxScore > 0 ? maxScore : MAX_WEIGHTED_SCORE;
  const { passed, margin } = passMargin(score, max);
  const stem = `Pass mark ${fmtMark(passMarkFor(max))} / ${fmtMark(max)}`;
  if (margin === 0) return `${stem} — you finished exactly on it.`;
  return passed
    ? `${stem} — you were ${fmtMark(margin)} clear of it.`
    : `${stem} — you were ${fmtMark(margin)} short.`;
}

/** Colour tone for a domain grade: CP/P pass, F borderline, CF fail. */
export function gradeTone(grade: Grade): ResultTone {
  if (grade === 'CP' || grade === 'P') return 'pass';
  if (grade === 'F') return 'borderline';
  return 'fail';
}

/** Colour tone for an overall verdict band. */
export function verdictTone(verdict: Verdict): ResultTone {
  if (isPassingVerdict(verdict)) return 'pass';
  return verdict === 'Bare Fail' ? 'borderline' : 'fail';
}

/** Colour tone for a raw weighted score. */
export function scoreTone(
  score: number,
  maxScore: number = MAX_WEIGHTED_SCORE
): ResultTone {
  return verdictTone(verdictForScore(score, maxScore));
}

/**
 * Colour tone for a score already expressed as a percentage of the maximum.
 * 57% is the pass mark, not 70% — a badge that only turns green at 70% calls a
 * genuine pass a failure.
 */
export function toneForPercent(percent: number): ResultTone {
  if (percent >= passMarkPercent()) return 'pass';
  if (percent >= bareFailPercent()) return 'borderline';
  return 'fail';
}
