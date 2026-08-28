import { describe, expect, it } from 'vitest';
import {
  MIN_DELTA_CASES,
  summariseHistory,
  summaryStats,
  type SummarySession,
} from './historySummary';

/**
 * Two things get tested hard here.
 *
 * Day bucketing, because the strip sits directly above a column of "Today" /
 * "Yesterday" captions and any disagreement between them is visible on one
 * screen — and because calendar arithmetic breaks at month ends and clock
 * changes, which is exactly where nobody is looking.
 *
 * And the small-n tiers, because the median user has three sessions. Most of
 * this strip's life is spent rendering almost no data.
 */

/** Local wall clock, so the expectations hold in any timezone. */
function localIso(
  year: number,
  month: number,
  day: number,
  hour = 12,
  minute = 0,
): string {
  return new Date(year, month - 1, day, hour, minute).toISOString();
}

const NOW = new Date(2026, 7, 26, 9, 0); // 26 Aug 2026, 09:00 local

function scored(completedAt: string, weightedScore: number, maxScore = 10.5): SummarySession {
  return {
    completedAt,
    outcome: 'scored',
    weightedScore,
    maxScore,
    passed: weightedScore >= 6,
  };
}

function unfinished(completedAt: string): SummarySession {
  return { completedAt, outcome: 'unfinished', weightedScore: 0, maxScore: 10.5, passed: false };
}

describe('summariseHistory — the week window', () => {
  it('counts the last seven calendar days, today included', () => {
    const sessions = [
      unfinished(localIso(2026, 8, 26, 8, 30)), // today
      scored(localIso(2026, 8, 20, 9, 0), 6.0), // 6 days ago — inside
      scored(localIso(2026, 8, 19, 23, 59), 6.0), // 7 days ago — outside
    ];
    expect(summariseHistory(sessions, { now: NOW }).thisWeek).toBe(2);
  });

  it('counts a session at 23:00 last night, and does not call it today', () => {
    // The elapsed-milliseconds bucket this replaced put 23:00 yesterday in the
    // same day as 09:00 today. Both rows below are inside the week either way;
    // what matters is that the strip and the row caption agree on which day
    // each one belongs to.
    const sessions = [scored(localIso(2026, 8, 25, 23, 0), 6.5)];
    expect(summariseHistory(sessions, { now: NOW }).thisWeek).toBe(1);
  });

  it('holds across a month boundary', () => {
    const septMorning = new Date(2026, 8, 2, 7, 0); // 2 Sept
    const sessions = [
      scored(localIso(2026, 8, 31, 23, 30), 6.5), // 2 days ago
      scored(localIso(2026, 8, 27, 10, 0), 5.0), // 6 days ago — inside
      scored(localIso(2026, 8, 26, 10, 0), 5.0), // 7 days ago — outside
    ];
    expect(summariseHistory(sessions, { now: septMorning }).thisWeek).toBe(2);
  });

  it('counts nothing when everything loaded is older than a week', () => {
    const sessions = [scored(localIso(2026, 7, 1), 6.5), scored(localIso(2026, 6, 30), 4.0)];
    expect(summariseHistory(sessions, { now: NOW }).thisWeek).toBe(0);
  });
});

describe('summariseHistory — the week count is a floor when the page is short', () => {
  it('is complete when the pager has nothing left', () => {
    const sessions = [scored(localIso(2026, 8, 26), 6.5)];
    expect(summariseHistory(sessions, { now: NOW, hasMore: false }).thisWeekComplete).toBe(true);
  });

  it('is complete when the loaded page already reaches past the window', () => {
    const sessions = [scored(localIso(2026, 8, 26), 6.5), scored(localIso(2026, 6, 1), 5.0)];
    expect(summariseHistory(sessions, { now: NOW, hasMore: true }).thisWeekComplete).toBe(true);
  });

  it('is incomplete when every loaded row is inside the window and more exist', () => {
    const sessions = [scored(localIso(2026, 8, 26), 6.5), scored(localIso(2026, 8, 24), 5.0)];
    const summary = summariseHistory(sessions, { now: NOW, hasMore: true });
    expect(summary.thisWeekComplete).toBe(false);
    expect(summaryStats(summary)[0].value).toBe('2 sessions+');
  });
});

describe('summariseHistory — averages and the trend', () => {
  it('averages only marked cases, ignoring the ones the user walked out of', () => {
    const sessions = [scored(localIso(2026, 8, 26), 7.0), unfinished(localIso(2026, 8, 25)), scored(localIso(2026, 8, 24), 5.0)];
    const summary = summariseHistory(sessions, { now: NOW });
    expect(summary.scoredCount).toBe(2);
    expect(summary.average).toBe(6);
    expect(summary.loadedCount).toBe(3);
  });

  it('withholds a delta below six marked cases', () => {
    const sessions = Array.from({ length: MIN_DELTA_CASES - 1 }, (_, i) =>
      scored(localIso(2026, 8, 26 - i), 5 + i),
    );
    expect(summariseHistory(sessions, { now: NOW }).delta).toBeNull();
  });

  it('compares the newer half against the older half', () => {
    // Newest first: 7, 7, 7 then 4, 4, 4. Newer half 7.0, older half 4.0.
    const sessions = [
      scored(localIso(2026, 8, 26), 7),
      scored(localIso(2026, 8, 25), 7),
      scored(localIso(2026, 8, 24), 7),
      scored(localIso(2026, 8, 23), 4),
      scored(localIso(2026, 8, 22), 4),
      scored(localIso(2026, 8, 21), 4),
    ];
    expect(summariseHistory(sessions, { now: NOW }).delta).toBe(3);
  });

  it('drops the middle case on an odd count so neither half is favoured', () => {
    const sessions = [
      scored(localIso(2026, 8, 26), 8),
      scored(localIso(2026, 8, 25), 8),
      scored(localIso(2026, 8, 24), 8),
      scored(localIso(2026, 8, 23), 0), // the ignored middle
      scored(localIso(2026, 8, 22), 5),
      scored(localIso(2026, 8, 21), 5),
      scored(localIso(2026, 8, 20), 5),
    ];
    expect(summariseHistory(sessions, { now: NOW }).delta).toBe(3);
  });

  it('reports a falling trend as a fall', () => {
    const sessions = [
      scored(localIso(2026, 8, 26), 4),
      scored(localIso(2026, 8, 25), 4),
      scored(localIso(2026, 8, 24), 4),
      scored(localIso(2026, 8, 23), 6),
      scored(localIso(2026, 8, 22), 6),
      scored(localIso(2026, 8, 21), 6),
    ];
    const summary = summariseHistory(sessions, { now: NOW });
    expect(summary.delta).toBe(-2);
    expect(summaryStats(summary)[1].delta).toBe('-2.0');
  });

  it('says "level" rather than "+0.0"', () => {
    const sessions = Array.from({ length: 6 }, (_, i) => scored(localIso(2026, 8, 26 - i), 6));
    expect(summaryStats(summariseHistory(sessions, { now: NOW }))[1].delta).toBe('level');
  });

  it('takes the best mark and says whether it passed', () => {
    const sessions = [scored(localIso(2026, 8, 26), 4.5), scored(localIso(2026, 8, 25), 6.5)];
    const summary = summariseHistory(sessions, { now: NOW });
    expect(summary.best).toBe(6.5);
    expect(summary.bestPassed).toBe(true);
  });

  it('does not tick a best that never reached the pass mark', () => {
    const sessions = [scored(localIso(2026, 8, 26), 4.5), scored(localIso(2026, 8, 25), 5.5)];
    expect(summariseHistory(sessions, { now: NOW }).bestPassed).toBe(false);
  });

  it('never averages across two marking scales', () => {
    // The oldest sessions in the database are marked out of ~70. Mixing them
    // into a mean out of 10.5 would produce a number that means nothing.
    const sessions = [
      scored(localIso(2026, 8, 26), 7, 10.5),
      scored(localIso(2026, 8, 25), 5, 10.5),
      scored(localIso(2026, 6, 2), 52, 70),
    ];
    const summary = summariseHistory(sessions, { now: NOW });
    expect(summary.scoredCount).toBe(2);
    expect(summary.average).toBe(6);
    expect(summary.best).toBe(7);
    expect(summary.bestMaxScore).toBe(10.5);
  });
});

describe('summaryStats — how the strip reads with almost no data', () => {
  it('shows one honest figure and no empty scores at zero sessions', () => {
    const stats = summaryStats(summariseHistory([], { now: NOW }));
    expect(stats.map((s) => s.id)).toEqual(['week']);
    expect(stats[0].value).toBe('None yet');
  });

  it('shows no scores when sessions exist but none were marked', () => {
    const sessions = [unfinished(localIso(2026, 8, 26)), unfinished(localIso(2026, 8, 25))];
    const stats = summaryStats(summariseHistory(sessions, { now: NOW }));
    expect(stats.map((s) => s.id)).toEqual(['week']);
    expect(stats[0].value).toBe('2 sessions');
  });

  it('shows one score, not the same number twice, at one marked case', () => {
    const stats = summaryStats(summariseHistory([scored(localIso(2026, 8, 26), 6.5)], { now: NOW }));
    expect(stats.map((s) => s.id)).toEqual(['week', 'score']);
    expect(stats[0].value).toBe('1 session');
    expect(stats[1].value).toBe('6.5');
    expect(stats[1].suffix).toBe(' / 10.5');
    expect(stats[1].passed).toBe(true);
  });

  it('shows an average and a best, but no trend, at three marked cases', () => {
    const sessions = [
      scored(localIso(2026, 8, 26), 6.5),
      scored(localIso(2026, 8, 24), 4.0),
      scored(localIso(2026, 8, 22), 5.0),
    ];
    const stats = summaryStats(summariseHistory(sessions, { now: NOW }));
    expect(stats.map((s) => s.id)).toEqual(['week', 'avg', 'best']);
    expect(stats[0].value).toBe('3 sessions');
    expect(stats[1].value).toBe('5.2');
    expect(stats[1].delta).toBeNull();
    expect(stats[1].detail).toContain('A trend needs 6');
    expect(stats[2].value).toBe('6.5');
    expect(stats[2].passed).toBe(true);
  });

  it('says "1 session", never "1 sessions"', () => {
    const stats = summaryStats(summariseHistory([unfinished(localIso(2026, 8, 26))], { now: NOW }));
    expect(stats[0].value).toBe('1 session');
  });
});
