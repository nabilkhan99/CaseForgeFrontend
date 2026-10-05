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

describe('rollUpDomains (per-domain totals over the person\'s index)', () => {
  const DOMAINS = [
    { id: 'heart', name: 'Heart' },
    { id: 'mind', name: 'Mind' },
  ];

  it('counts today\'s bank exactly as a live-row count would', async () => {
    const { rollUpDomains } = await import('./dashboard');
    const index = [
      { id: 'a', domain_id: 'heart' },
      { id: 'b', domain_id: 'heart' },
      { id: 'c', domain_id: 'mind' },
    ];
    const rows = rollUpDomains(DOMAINS, index, [{ station_id: 'a', overall_score: 7 }]);
    expect(rows.map((r) => [r.name, r.total, r.completed])).toEqual([
      ['Heart', 2, 1],
      ['Mind', 1, 0],
    ]);
    expect(rows[0].percentage).toBe(Math.round((7 / 10.5) * 100));
  });

  it('credits a keeper\'s old case to its own domain, even when the replacement moved topic', async () => {
    const { rollUpDomains } = await import('./dashboard');
    // The keeper's index holds OLD (heart); the live replacement NEW is filed
    // under mind and is not in their index at all.
    const keeperIndex = [
      { id: 'OLD', domain_id: 'heart' },
      { id: 'c', domain_id: 'mind' },
    ];
    const rows = rollUpDomains(DOMAINS, keeperIndex, [
      { station_id: 'OLD', overall_score: 8 },
      // An attempt on a case outside the index is not progress through it.
      { station_id: 'NEW', overall_score: 9 },
    ]);
    expect(rows.map((r) => [r.name, r.total, r.completed])).toEqual([
      ['Heart', 1, 1],
      ['Mind', 1, 0],
    ]);
  });

  it('keeps unscored legacy attempts out of the average but in the count', async () => {
    const { rollUpDomains } = await import('./dashboard');
    const rows = rollUpDomains(DOMAINS, [{ id: 'a', domain_id: 'heart' }], [
      { station_id: 'a', overall_score: null },
      { station_id: 'a', overall_score: 0 },
    ]);
    expect(rows[0]).toMatchObject({ completed: 2, percentage: 0 });
  });
});
