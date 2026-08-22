import { beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * getSessionHistory issues one query; the stub records what it was asked for
 * and answers with a canned PostgREST payload, which is enough to pin the
 * mapping (what counts as scored, marking, stalled or unfinished) and the
 * status filter.
 */
const db = vi.hoisted(() => {
  const state: {
    statuses: string[] | null;
    orderedBy: string | null;
    rows: unknown[];
  } = { statuses: null, orderedBy: null, rows: [] };

  const chain = {
    select: () => chain,
    eq: () => chain,
    in: (_column: string, values: string[]) => {
      state.statuses = values;
      return chain;
    },
    order: (column: string) => {
      state.orderedBy = column;
      return chain;
    },
    range: () => chain,
    then: (onFulfilled: (value: { data: unknown[] }) => unknown) =>
      Promise.resolve({ data: state.rows }).then(onFulfilled),
  };

  return {
    state,
    client: { from: () => chain },
    rows(rows: unknown[]) {
      state.rows = rows;
    },
  };
});

vi.mock('@/lib/supabase/client', () => ({ createClient: () => db.client }));

import { getSessionHistory } from './dashboard';

const station = { id: 'st-1', title: 'Chest pain', domains: { name: 'Cardiovascular' } };
const minutesAgo = (minutes: number) => new Date(Date.now() - minutes * 60_000).toISOString();

describe('getSessionHistory — status filter', () => {
  beforeEach(() => {
    db.rows([]);
    db.state.statuses = null;
  });

  it('leaves abandoned sessions out by default', async () => {
    await getSessionHistory('user-1');
    expect(db.state.statuses).toEqual(['completed', 'processing']);
  });

  it('includes them when asked', async () => {
    await getSessionHistory('user-1', 20, 0, { includeUnfinished: true });
    expect(db.state.statuses).toEqual(['completed', 'processing', 'abandoned']);
  });

  it('orders by started_at, which every row has', async () => {
    await getSessionHistory('user-1');
    // completed_at is null on processing and abandoned rows, and a NULL sorts
    // first on a descending order — they would all jump to the top of History.
    expect(db.state.orderedBy).toBe('started_at');
  });
});

describe('getSessionHistory — outcomes', () => {
  it('reads a marked session as scored', async () => {
    db.rows([
      {
        id: 's1',
        status: 'completed',
        started_at: minutesAgo(30),
        completed_at: minutesAgo(15),
        lastTurnMs: '694900',
        stations: station,
        session_results: { verdict: 'Bare Pass', weighted_score: 6.5, max_score: 10.5 },
      },
    ]);

    const [row] = await getSessionHistory('user-1');
    expect(row.outcome).toBe('scored');
    expect(row.scored).toBe(true);
    expect(row.passed).toBe(true);
    expect(row.weightedScore).toBe(6.5);
    expect(row.completedAt).not.toBe('');
  });

  it('treats a 0.0 verdict as unscored, not a red FAIL row', async () => {
    db.rows([
      {
        id: 's2',
        status: 'completed',
        started_at: minutesAgo(200),
        completed_at: minutesAgo(190),
        lastTurnMs: null,
        stations: station,
        session_results: { verdict: 'Fail', weighted_score: 0, max_score: 10.5 },
      },
    ]);

    const [row] = await getSessionHistory('user-1');
    expect(row.scored).toBe(false);
    expect(row.outcome).toBe('unscored');
  });

  it('keeps a recent processing session in the marking state, dating it from started_at', async () => {
    // Regression: ageMs was read off completed_at, which is null while a session
    // is processing, so every processing row was instantly "no feedback".
    db.rows([
      {
        id: 's3',
        status: 'processing',
        started_at: minutesAgo(3),
        completed_at: null,
        lastTurnMs: '160000',
        stations: station,
        session_results: null,
      },
    ]);

    const [row] = await getSessionHistory('user-1');
    expect(row.outcome).toBe('marking');
    expect(row.marking).toBe(true);
    expect(row.completedAt).toBe(row.startedAt);
  });

  it('calls a processing session older than an hour stalled', async () => {
    db.rows([
      {
        id: 's4',
        status: 'processing',
        started_at: minutesAgo(60 * 40),
        completed_at: null,
        lastTurnMs: '600000',
        stations: station,
        session_results: null,
      },
    ]);

    const [row] = await getSessionHistory('user-1');
    expect(row.outcome).toBe('stalled');
    expect(row.marking).toBe(false);
  });

  it('maps an abandoned session to unfinished with how far it got', async () => {
    db.rows([
      {
        id: 's5',
        status: 'abandoned',
        started_at: minutesAgo(90),
        completed_at: null,
        lastTurnMs: '184000',
        stations: station,
        session_results: null,
      },
    ]);

    const [row] = await getSessionHistory('user-1', 20, 0, { includeUnfinished: true });
    expect(row.outcome).toBe('unfinished');
    expect(row.elapsedMs).toBe(184000);
    expect(row.scored).toBe(false);
  });

  it('has no elapsed time for a session with no transcript at all', async () => {
    db.rows([
      {
        id: 's6',
        status: 'abandoned',
        started_at: minutesAgo(90),
        completed_at: null,
        lastTurnMs: null,
        stations: station,
        session_results: null,
      },
    ]);

    const [row] = await getSessionHistory('user-1', 20, 0, { includeUnfinished: true });
    expect(row.elapsedMs).toBeNull();
  });
});
