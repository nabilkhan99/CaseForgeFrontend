/**
 * The only part of a mark that is allowed out from behind the email gate.
 *
 * Roughly a quarter of people who finish the free consultation abandon at the
 * gate, having seen nothing at all of their own result — so the verdict, the
 * score and the one-line summary are shown above it. Everything that makes the
 * report worth the email stays behind it: the domain breakdown, the evidence
 * quotes, the focus areas and the "one change".
 *
 * This function is the boundary, written as an allowlist rather than a set of
 * deletions. A `session_results` row grows new columns over time — an evidence
 * map, capability links, timing — and a blocklist would leak each one on the
 * day it was added. Nothing reaches the wire unless it is named here.
 */
export interface TrialVerdictSummary {
  verdict: string;
  weightedScore: number;
  maxScore: number;
  oneLineSummary: string;
}

/** The columns this reads. Anything else on the row is deliberately ignored. */
interface VerdictSummarySource {
  verdict?: unknown;
  weighted_score?: unknown;
  max_score?: unknown;
  one_line_summary?: unknown;
}

function toNumber(value: unknown, fallback: number): number {
  const parsed = typeof value === 'string' ? Number(value) : value;
  return typeof parsed === 'number' && Number.isFinite(parsed) ? parsed : fallback;
}

/**
 * @param row A `session_results` row, or null when the mark has not landed.
 * @returns The four public fields, or null when there is no verdict to show.
 */
export function toVerdictSummary(row: unknown): TrialVerdictSummary | null {
  if (!row || typeof row !== 'object') return null;

  const source = row as VerdictSummarySource;
  // A row without a verdict is not a result anyone can be shown.
  if (typeof source.verdict !== 'string' || source.verdict.trim() === '') return null;

  const weightedScore = toNumber(source.weighted_score, 0);

  /**
   * Zero is the signature of an empty-transcript artefact, not of a
   * consultation. Marking used to run without a transcript guard, so
   * production holds rows like "Fail 0.0 — the consultation did not progress
   * beyond a brief opening", written against one or two turns. The rest of the
   * project already treats `weighted_score > 0` as the test for a real mark.
   *
   * Refused here specifically because of where this is shown: above the gate,
   * to someone deciding whether the marking is worth an email address. A
   * fabricated mark is bad everywhere and worst there. The full report behind
   * the gate is untouched — it still renders whatever the row says, and
   * explains itself in the process.
   */
  if (weightedScore <= 0) return null;

  return {
    verdict: source.verdict,
    weightedScore,
    maxScore: toNumber(source.max_score, 10.5),
    oneLineSummary:
      typeof source.one_line_summary === 'string' ? source.one_line_summary : '',
  };
}
