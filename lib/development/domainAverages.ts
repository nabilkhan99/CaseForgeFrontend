/**
 * The per-domain figures on the Development page.
 *
 * Every number here is arithmetic over `session_results`, never anything the
 * trend model said. That separation is deliberate: the model writes the words,
 * the database writes the numbers, and a trainee comparing the two should never
 * find them disagreeing. It also means the averages appear the moment a case is
 * marked, rather than waiting on the next report build.
 *
 * Scale. The SCA grades each domain CP/P/F/CF = 3/2/1/0, and clinical
 * management is weighted 1.5x — which is why its column is out of 4.5 while the
 * other two are out of 3, and why the caption says so rather than leaving
 * someone to wonder how one domain scored 4.
 */

import type { DomainKey } from '@/lib/clinical-master/types';

/** One marked case's contribution, oldest-first once assembled into a series. */
export interface DomainCasePoints {
  sessionId: string;
  /** Weighted points per domain — clinical management already carries its 1.5x. */
  points: Partial<Record<DomainKey, number>>;
}

/** Which way the last few cases are going, relative to what came before. */
export type DomainTrajectory = 'improving' | 'steady' | 'slipping';

export interface DomainAverage {
  domain: DomainKey;
  label: string;
  /** Mean weighted points across the window, or null when nothing is graded. */
  mean: number | null;
  max: number;
  /** Per-case values, oldest → newest, for the sparkline. */
  series: number[];
  trajectory: DomainTrajectory;
}

/**
 * How many cases at the end of the window count as "recently".
 *
 * Three is the smallest run that can't be one bad morning, and small enough
 * that a change made two cases ago still shows up. Below four cases in total
 * there is no "earlier" to compare against and the answer is always 'steady'.
 */
const RECENT_CASES = 3;

/**
 * How much a mean has to move before it is a direction rather than noise.
 *
 * 0.3 of a grade point on a 0–3 scale: a tenth of the range, and roughly what
 * one case shifting by a full grade does to a three-case mean. Anything smaller
 * would flicker between arrows on data that hasn't meaningfully changed.
 */
const TRAJECTORY_THRESHOLD = 0.3;

export const DOMAIN_MAX_POINTS: Record<DomainKey, number> = {
  data_gathering: 3,
  clinical_management: 4.5,
  relating_to_others: 3,
};

export const DOMAIN_DISPLAY_NAMES: Record<DomainKey, string> = {
  data_gathering: 'Data gathering',
  clinical_management: 'Clinical management',
  relating_to_others: 'Relating to others',
};

/** Fixed left-to-right order, matching the marking report's domain nav. */
export const DOMAIN_ORDER: readonly DomainKey[] = [
  'data_gathering',
  'clinical_management',
  'relating_to_others',
];

export function mean(values: readonly number[]): number | null {
  if (values.length === 0) return null;
  return values.reduce((total, value) => total + value, 0) / values.length;
}

/**
 * Whether the tail of the series beats what came before it.
 *
 * Compares the last `RECENT_CASES` against every case before them, rather than
 * first-vs-last: one exceptional case at either end of a window should not be
 * able to declare a direction on its own.
 */
export function trajectoryOf(series: readonly number[]): DomainTrajectory {
  if (series.length <= RECENT_CASES) return 'steady';
  const recent = mean(series.slice(-RECENT_CASES));
  const earlier = mean(series.slice(0, -RECENT_CASES));
  if (recent === null || earlier === null) return 'steady';
  const delta = recent - earlier;
  if (delta >= TRAJECTORY_THRESHOLD) return 'improving';
  if (delta <= -TRAJECTORY_THRESHOLD) return 'slipping';
  return 'steady';
}

/**
 * Roll a window of marked cases up into the three columns.
 *
 * Cases missing a grade for a domain are skipped for that domain only — a
 * result row that graded two domains still contributes the two it has, rather
 * than being dropped or counted as a zero it never scored.
 */
export function summariseDomains(cases: readonly DomainCasePoints[]): DomainAverage[] {
  return DOMAIN_ORDER.map((domain) => {
    const series = cases
      .map((entry) => entry.points[domain])
      .filter((value): value is number => typeof value === 'number' && Number.isFinite(value));

    return {
      domain,
      label: DOMAIN_DISPLAY_NAMES[domain],
      mean: mean(series),
      max: DOMAIN_MAX_POINTS[domain],
      series,
      trajectory: trajectoryOf(series),
    };
  });
}

/**
 * `points` for a sparkline `<polyline>`, oldest → newest, in the given box.
 *
 * The y-scale is pinned to the domain's own maximum rather than to the values
 * present, so a run of identical grades draws a flat line instead of an
 * invented mountain range — and so the three sparklines are comparable to each
 * other. A single point draws a short flat segment: a lone dot at a corner
 * reads as a glitch, and there is no trend in one case anyway.
 */
export function sparklinePoints(
  series: readonly number[],
  max: number,
  width: number,
  height: number,
): string {
  if (series.length === 0 || max <= 0) return '';
  const scaleY = (value: number) =>
    height - Math.max(0, Math.min(1, value / max)) * height;
  if (series.length === 1) {
    const y = scaleY(series[0]).toFixed(1);
    return `0,${y} ${width},${y}`;
  }
  return series
    .map((value, index) => {
      const x = (index / (series.length - 1)) * width;
      return `${x.toFixed(1)},${scaleY(value).toFixed(1)}`;
    })
    .join(' ');
}
