/**
 * The three numbers above the history list, and the rules for when a number is
 * worth showing at all.
 *
 * Kept out of the component because the interesting part is not the markup, it
 * is the arithmetic: which sessions count as "this week", what an average delta
 * is actually comparing, and — mostly — what to do when there is almost no data.
 * The median user has three sessions and several have one, so "reads gracefully
 * at n = 1" is the design constraint, not an edge case. A strip that renders
 * `AVG 0.0 · BEST 0.0` for a new user is worse than no strip.
 *
 * Everything here is computed from the rows the page has *loaded*, which is one
 * page of twenty by default. `summariseHistory` is told whether more exist so
 * the caller can say so rather than quietly present a partial count as a total.
 */
import { calendarDaysAgo } from '@/lib/utils';
import { passMarkFor } from '@/lib/clinical-master/scoring';

/** "This week" is today plus the six calendar days before it. */
export const WEEK_DAYS = 7;

/**
 * Fewest marked cases that can carry a trend.
 *
 * The delta compares the newer half of the marked cases against the older half,
 * so six is the floor at which each half is three cases — enough that one
 * unlucky station does not become "you are getting worse". Below it there is no
 * delta at all rather than a fabricated one.
 */
export const MIN_DELTA_CASES = 6;

/**
 * The fields the summary needs from a history row.
 *
 * Structural rather than importing SessionHistoryItem, so this module — and its
 * tests — stay clear of the Supabase query layer. SessionHistoryItem satisfies
 * it as-is.
 */
export interface SummarySession {
  /**
   * completed_at when there is one, else started_at.
   *
   * Deliberately the same field the row caption formats, so the strip and the
   * "Yesterday" sitting an inch below it can never bucket a session differently.
   */
  completedAt: string;
  outcome: string;
  weightedScore: number;
  maxScore: number;
  passed: boolean;
}

export interface HistorySummary {
  /** Sessions dated inside the last {@link WEEK_DAYS} local calendar days. */
  thisWeek: number;
  /**
   * False when the loaded page is entirely inside the week window and more rows
   * exist — `thisWeek` is then a floor, not a count, and must be shown as "3+".
   */
  thisWeekComplete: boolean;
  /** How many loaded rows carry a mark. */
  scoredCount: number;
  /** Mean weighted score across the marked cases, or null when there are none. */
  average: number | null;
  /** Newer-half mean minus older-half mean, or null when too few to mean anything. */
  delta: number | null;
  /** Highest weighted score across the marked cases, or null when there are none. */
  best: number | null;
  /** The scale `best` was marked out of. */
  bestMaxScore: number | null;
  /** True when `best` reached the pass mark for its own scale. */
  bestPassed: boolean;
  /** Rows the figures were computed from — every loaded row, filters ignored. */
  loadedCount: number;
}

export interface SummariseOptions {
  /** Defaults to now. Injected so the week window is testable. */
  now?: Date | number;
  /** Whether the pager has more rows behind the ones passed in. */
  hasMore?: boolean;
}

function round1(value: number): number {
  return Math.round(value * 10) / 10;
}

function mean(scores: number[]): number {
  return scores.reduce((sum, s) => sum + s, 0) / scores.length;
}

/**
 * @param sessions Newest first, as the history page holds them.
 */
export function summariseHistory(
  sessions: readonly SummarySession[],
  options: SummariseOptions = {},
): HistorySummary {
  const now = options.now ?? Date.now();
  const hasMore = options.hasMore ?? false;

  const withinWeek = (session: SummarySession): boolean => {
    const days = calendarDaysAgo(session.completedAt, now);
    return days !== null && days < WEEK_DAYS;
  };

  const thisWeek = sessions.filter(withinWeek).length;

  // Rows arrive newest-first, so the page only undercounts the week when its
  // *oldest* row is still inside the window and there are more behind it.
  const oldest = sessions[sessions.length - 1];
  const thisWeekComplete = !hasMore || (oldest !== undefined && !withinWeek(oldest));

  // Only cases marked on the current scale. Every mark since June 2026 is out
  // of 10.5, but the earliest sessions in the database are out of ~70, and a
  // mean taken across both scales is not a smaller number — it is a meaningless
  // one. The newest mark sets the scale; anything marked differently is left
  // out of the average, the best and the count that explains them.
  const marked = sessions.filter((s) => s.outcome === 'scored');
  const scale = marked[0]?.maxScore;
  const scored = marked.filter((s) => Math.abs(s.maxScore - scale) < 0.001);
  const scores = scored.map((s) => s.weightedScore);

  if (scores.length === 0) {
    return {
      thisWeek,
      thisWeekComplete,
      scoredCount: 0,
      average: null,
      delta: null,
      best: null,
      bestMaxScore: null,
      bestPassed: false,
      loadedCount: sessions.length,
    };
  }

  // Halves, with the middle case dropped on an odd count so neither side is
  // weighted by an accident of parity.
  let delta: number | null = null;
  if (scores.length >= MIN_DELTA_CASES) {
    const half = Math.floor(scores.length / 2);
    delta = round1(mean(scores.slice(0, half)) - mean(scores.slice(scores.length - half)));
  }

  const bestSession = scored.reduce((top, s) => (s.weightedScore > top.weightedScore ? s : top));

  return {
    thisWeek,
    thisWeekComplete,
    scoredCount: scored.length,
    average: round1(mean(scores)),
    delta,
    best: round1(bestSession.weightedScore),
    bestMaxScore: bestSession.maxScore,
    bestPassed: bestSession.weightedScore >= passMarkFor(bestSession.maxScore),
    loadedCount: sessions.length,
  };
}

/** One figure in the strip. */
export interface SummaryStat {
  id: 'week' | 'avg' | 'best' | 'score';
  /** The eyebrow above the figure. */
  label: string;
  value: string;
  /** " / 10.5" where a bare score would be unreadable, else null. */
  suffix: string | null;
  /** "+0.4", "-0.3", "level", or null when there is no honest trend to show. */
  delta: string | null;
  /** Renders the pass tick. */
  passed: boolean;
  /** The sentence that explains the figure — hover title and screen-reader text. */
  detail: string;
}

function plural(count: number, noun: string): string {
  return `${count} ${noun}${count === 1 ? '' : 's'}`;
}

function formatDelta(delta: number): string {
  if (Math.abs(delta) < 0.05) return 'level';
  return `${delta > 0 ? '+' : '-'}${Math.abs(delta).toFixed(1)}`;
}

/**
 * Which figures the strip should show, given how much data there is.
 *
 * Three tiers, so the strip is a sentence about the user rather than a form
 * with empty fields:
 *   no marks   — the week count alone; nothing else can be said honestly.
 *   one mark   — one score. Showing AVG and BEST here prints the same number
 *                twice and dresses a single case up as a track record.
 *   two or more— average and best, with a delta once six cases can support one.
 */
export function summaryStats(summary: HistorySummary): SummaryStat[] {
  const week: SummaryStat = {
    id: 'week',
    label: 'This week',
    value:
      summary.thisWeek === 0
        ? 'None yet'
        : `${plural(summary.thisWeek, 'session')}${summary.thisWeekComplete ? '' : '+'}`,
    suffix: null,
    delta: null,
    passed: false,
    detail: summary.thisWeekComplete
      ? 'Sessions in the last 7 days.'
      : 'Sessions in the last 7 days, across the sessions loaded so far — load more for the full count.',
  };

  if (summary.scoredCount === 0 || summary.best === null || summary.average === null) {
    return [week];
  }

  const outOf = summary.bestMaxScore === null ? null : ` / ${summary.bestMaxScore.toFixed(1)}`;

  if (summary.scoredCount === 1) {
    return [
      week,
      {
        id: 'score',
        label: 'Your mark',
        value: summary.best.toFixed(1),
        suffix: outOf,
        delta: null,
        passed: summary.bestPassed,
        detail: 'Your only marked case so far.',
      },
    ];
  }

  return [
    week,
    {
      id: 'avg',
      label: 'Average',
      value: summary.average.toFixed(1),
      suffix: outOf,
      delta: summary.delta === null ? null : formatDelta(summary.delta),
      passed: false,
      detail:
        summary.delta === null
          ? `Mean of your ${summary.scoredCount} marked cases. A trend needs ${MIN_DELTA_CASES}.`
          : `Mean of your ${summary.scoredCount} marked cases. The change compares your newer half against your older half.`,
    },
    {
      id: 'best',
      label: 'Best',
      value: summary.best.toFixed(1),
      suffix: outOf,
      delta: null,
      passed: summary.bestPassed,
      detail: summary.bestPassed
        ? 'Your highest mark so far, and a pass.'
        : 'Your highest mark so far.',
    },
  ];
}
