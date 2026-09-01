import { beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * getUserStats fires three queries in order: profile, completed-session count,
 * visible-station count. The stub answers them from a queue — enough to pin
 * the behaviours the dashboard leans on: examDate passing through untouched
 * beside the floored countdown, and absent data degrading to zeros rather
 * than throwing. (The fourth query, the pass map, left with the home page's
 * passed-station tally.)
 */
const db = vi.hoisted(() => {
  const queue: Array<Record<string, unknown>> = [];

  interface Chain extends PromiseLike<Record<string, unknown>> {
    select(columns: string, options?: unknown): Chain;
    eq(column: string, value: unknown): Chain;
    in(column: string, value: unknown): Chain;
    single(): Chain;
  }

  const next = () => Promise.resolve(queue.shift() ?? { data: null, error: null });

  const chain: Chain = {
    select: () => chain,
    eq: () => chain,
    in: () => chain,
    single: () => chain,
    then: (onFulfilled) => next().then(onFulfilled),
  };

  return {
    client: { from: () => chain },
    queue(responses: Array<Record<string, unknown>>) {
      queue.length = 0;
      queue.push(...responses);
    },
  };
});

vi.mock('@/lib/supabase/client', () => ({ createClient: () => db.client }));

import { getUserStats } from './dashboard';

const completedCount = { count: 12, error: null };
const stationCount = { count: 78, error: null };

describe('getUserStats', () => {
  beforeEach(() => vi.restoreAllMocks());

  it('returns counts, streak and a null examDate when no date is set', async () => {
    db.queue([
      { data: { exam_date: null, current_streak: 4 }, error: null },
      completedCount,
      stationCount,
    ]);

    const stats = await getUserStats('user-1');

    expect(stats.completedStations).toBe(12);
    expect(stats.totalStations).toBe(78);
    expect(stats.currentStreak).toBe(4);
    expect(stats.examDate).toBeNull();
    expect(stats.examCountdownDays).toBe(0);
  });

  it('passes a stored exam date through beside its countdown', async () => {
    const future = new Date(Date.now() + 10 * 86_400_000).toISOString().slice(0, 10);
    db.queue([
      { data: { exam_date: future, current_streak: 0 }, error: null },
      completedCount,
      stationCount,
    ]);

    const stats = await getUserStats('user-1');

    // The date itself must come back verbatim: 0 countdown days is ambiguous
    // (no date vs a past date) and the dashboard disambiguates on examDate.
    expect(stats.examDate).toBe(future);
    expect(stats.examCountdownDays).toBeGreaterThanOrEqual(9);
    expect(stats.examCountdownDays).toBeLessThanOrEqual(10);
  });

  it('floors a past exam date to 0 while still returning the date', async () => {
    db.queue([
      { data: { exam_date: '2020-01-01', current_streak: 0 }, error: null },
      completedCount,
      stationCount,
    ]);

    const stats = await getUserStats('user-1');

    expect(stats.examCountdownDays).toBe(0);
    expect(stats.examDate).toBe('2020-01-01');
  });

  it('degrades to zeros when every query comes back empty', async () => {
    db.queue([
      { data: null, error: null },
      { count: null, error: null },
      { count: null, error: null },
    ]);

    const stats = await getUserStats('user-1');

    expect(stats).toEqual({
      currentStreak: 0,
      completedStations: 0,
      totalStations: 0,
      examCountdownDays: 0,
      examDate: null,
    });
  });
});
