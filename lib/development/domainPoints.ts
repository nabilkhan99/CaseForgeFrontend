/**
 * Reading `session_results.domains` — the one place that knows the shape of
 * that blob and how to turn it into weighted points.
 *
 * Lifted out of lib/supabase/queries/development.ts when the trainer overview
 * needed the same reading. That module imports the BROWSER Supabase client, so
 * a route handler cannot pull anything out of it; without this split the
 * server would have had a second, drifting copy of the grade weighting — and a
 * trainer's chart disagreeing with their student's own by a decimal place is
 * precisely the kind of bug nobody can explain afterwards.
 *
 * Pure: no client, no I/O, safe in every runtime.
 */

import type { DomainKey } from '@/lib/clinical-master/types';

/** CP/P/F/CF as grade points; clinical management carries a 1.5x weight. */
const CLINICAL_MANAGEMENT_WEIGHT = 1.5;

const DOMAIN_KEYS: readonly DomainKey[] = [
  'data_gathering',
  'clinical_management',
  'relating_to_others',
];

/** One entry of `session_results.domains`, as much of it as we read. */
export interface GradedDomain {
  domain?: unknown;
  grade_points?: unknown;
  weighted_points?: unknown;
}

export function isDomainKey(value: unknown): value is DomainKey {
  return typeof value === 'string' && (DOMAIN_KEYS as readonly string[]).includes(value);
}

/**
 * Weighted points for one graded domain.
 *
 * Prefers the engine's own `weighted_points` and falls back to applying the
 * weight here, the same way the feedback report does — older result rows
 * predate the field, and recomputing it is exact rather than approximate.
 */
export function weightedPointsOf(entry: GradedDomain, domain: DomainKey): number | null {
  const stored = Number(entry.weighted_points);
  if (Number.isFinite(stored) && entry.weighted_points != null) return stored;

  const raw = Number(entry.grade_points);
  if (!Number.isFinite(raw) || entry.grade_points == null) return null;
  return domain === 'clinical_management' ? raw * CLINICAL_MANAGEMENT_WEIGHT : raw;
}

/** The three domains' weighted points from one result row's `domains` blob. */
export function pointsFromResult(domains: unknown): Partial<Record<DomainKey, number>> {
  if (!Array.isArray(domains)) return {};
  return domains.reduce<Partial<Record<DomainKey, number>>>((accumulated, entry) => {
    if (typeof entry !== 'object' || entry === null) return accumulated;
    const graded = entry as GradedDomain;
    if (!isDomainKey(graded.domain)) return accumulated;
    const points = weightedPointsOf(graded, graded.domain);
    if (points === null) return accumulated;
    return { ...accumulated, [graded.domain]: points };
  }, {});
}
