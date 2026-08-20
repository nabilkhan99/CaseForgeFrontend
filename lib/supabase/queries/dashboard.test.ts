import { beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * getUserStats fires four queries in order: profile, completed-session count,
 * visible-station count, then the pass map. The stub answers them from a queue,
 * which is enough to pin the one behaviour that matters here — what
 * `passedStations` becomes when the pass query fails.
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

const profile = { data: { exam_date: null, current_streak: 4 }, error: null };
const completedCount = { count: 12, error: null };
const stationCount = { count: 78, error: null };

describe('getUserStats — passedStations', () => {
  beforeEach(() => vi.restoreAllMocks());

  it('counts distinct passed stations when the pass query succeeds', async () => {
    db.queue([
      profile,
      completedCount,
      stationCount,
      {
        data: [
          { station_id: 'a', session_results: { verdict: 'Pass', weighted_score: 8.5 } },
          { station_id: 'a', session_results: { verdict: 'Fail', weighted_score: 3.0 } },
          { station_id: 'b', session_results: { verdict: 'Bare Pass', weighted_score: 6.1 } },
          { station_id: 'c', session_results: { verdict: 'Fail', weighted_score: 4.2 } },
        ],
        error: null,
      },
    ]);

    const stats = await getUserStats('user-1');

    expect(stats.passedStations).toBe(2);
    expect(stats.completedStations).toBe(12);
    expect(stats.totalStations).toBe(78);
  });

  it('reports null — not zero — when the pass query fails', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    db.queue([
      profile,
      completedCount,
      stationCount,
      { data: null, error: { message: 'permission denied' } },
    ]);

    // "Passed 0 of 78 stations" would be a fabricated fact for a user with 12
    // completed sessions; the dashboard hides the pill on null instead.
    const stats = await getUserStats('user-1');

    expect(stats.passedStations).toBeNull();
    expect(stats.completedStations).toBe(12);
  });
});
