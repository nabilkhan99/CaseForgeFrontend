/**
 * The cross-case development report, v2.
 *
 * Shared contract with the Azure trend engine, which writes these rows into
 * Supabase `trend_reports`. The shape is deliberately small: everything the
 * report says has to be something a trainee can act on, and every number the
 * page shows is computed from `session_results` rather than asked of a model.
 *
 * The v1 shape (recurring_themes / style_patterns / consistent_strengths /
 * next_steps / caution / confidence) is gone on both sides. Rows in that shape
 * may still be sitting in the table, so nothing here is optional-by-default —
 * `isTrendReportV2` is the gate, and anything that fails it is treated as no
 * report at all rather than partially rendered.
 */

/** The three SCA marking domains, as the engine names them. */
export type TrendDomain = 'data_gathering' | 'clinical_management' | 'relating_to_others';

export type TrendTrajectory = 'improving' | 'steady' | 'declining';

/** One case the pattern actually showed up in, with the line that proves it. */
export interface TrendEvidence {
  /** A `clinical_sessions.id`. Resolved to a station title for display. */
  case_id: string;
  quote: string;
}

/**
 * One thing costing marks, stated as a change to make.
 *
 * The pairing is the point: `your_quote` is what they said, `model_line` is
 * what a passing candidate says at that same moment. Neither reads as advice
 * without the other.
 */
export interface TrendPattern {
  /** Imperative, at most seven words. */
  headline: string;
  domain: TrendDomain;
  /** How many cases in the window it appeared in. */
  frequency: number;
  your_quote: string;
  quote_gloss: string;
  model_line: string;
  model_gloss: string;
  the_change: string;
  evidence: TrendEvidence[];
}

export interface TrendWindow {
  cases_included: number;
  from: string;
  to: string;
}

export interface TrendReportV2 {
  version: 2;
  candidate_id: string;
  /** Stamped by Postgres on insert — how old this picture is. */
  created_at?: string | null;
  window: TrendWindow;
  overall_trajectory: TrendTrajectory;
  overall_narrative: string;
  /** One to three, already in priority order. */
  patterns: TrendPattern[];
}

/**
 * Whether a `trend_reports` row is the shape this product renders.
 *
 * Checks the two things that decide it — the version stamp and that `patterns`
 * is an array — rather than validating every field. A v2 row with a missing
 * gloss is still a v2 row and renders fine; a v1 row has neither marker and
 * must never reach the page, because its fields mean different things.
 */
export function isTrendReportV2(value: unknown): value is TrendReportV2 {
  if (typeof value !== 'object' || value === null) return false;
  const candidate = value as { version?: unknown; patterns?: unknown };
  return candidate.version === 2 && Array.isArray(candidate.patterns);
}

/** Display names for the domain chip, in the wording the marking report uses. */
export const TREND_DOMAIN_LABELS: Record<TrendDomain, string> = {
  data_gathering: 'Data gathering',
  clinical_management: 'Clinical management',
  relating_to_others: 'Relating to others',
};
