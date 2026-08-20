import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * A minimal PostgREST builder stub. It records the select string and every
 * filter so the tests can assert the SHAPE of the query — specifically that the
 * station-visibility join is present, which is the whole of finding #1.
 */
const db = vi.hoisted(() => {
  const state = {
    select: '',
    filters: [] as Array<[string, string, unknown]>,
    response: { data: [] as unknown, error: null as unknown },
  };

  interface Chain extends PromiseLike<{ data: unknown; error: unknown }> {
    select(columns: string): Chain;
    eq(column: string, value: unknown): Chain;
    in(column: string, value: unknown): Chain;
  }

  const chain: Chain = {
    select(columns) {
      state.select = columns;
      return chain;
    },
    eq(column, value) {
      state.filters.push(['eq', column, value]);
      return chain;
    },
    in(column, value) {
      state.filters.push(['in', column, value]);
      return chain;
    },
    then(onFulfilled) {
      return Promise.resolve(state.response).then(onFulfilled);
    },
  };

  return {
    state,
    client: { from: () => chain },
    reset(response: { data?: unknown; error?: unknown } = {}) {
      state.select = '';
      state.filters = [];
      state.response = { data: response.data ?? [], error: response.error ?? null };
    },
  };
});

vi.mock('@/lib/supabase/client', () => ({ createClient: () => db.client }));

import {
  flattenSessionRows,
  getStationPassMap,
  passedStationIds,
  reduceStationPassMap,
  type StationAttemptRow,
} from './passTracking';

function attempt(overrides: Partial<StationAttemptRow> = {}): StationAttemptRow {
  return {
    station_id: 'station-a',
    verdict: 'Pass',
    weighted_score: 8.5,
    ...overrides,
  };
}

describe('reduceStationPassMap — empty and unusable input', () => {
  it('returns an empty map for no attempts', () => {
    expect(reduceStationPassMap([]).size).toBe(0);
  });

  it('ignores rows with no station', () => {
    expect(reduceStationPassMap([attempt({ station_id: null })]).size).toBe(0);
  });
});

describe('reduceStationPassMap — a single scored pass', () => {
  const state = reduceStationPassMap([attempt({ verdict: 'Bare Pass', weighted_score: 6.2 })]).get(
    'station-a',
  );

  it('marks the station passed', () => {
    expect(state?.passed).toBe(true);
  });

  it('records the verdict and score of that attempt', () => {
    expect(state?.bestVerdict).toBe('Bare Pass');
    expect(state?.bestScore).toBe(6.2);
    expect(state?.attempts).toBe(1);
  });
});

describe('reduceStationPassMap — best attempt wins', () => {
  const map = reduceStationPassMap([
    attempt({ verdict: 'Fail', weighted_score: 3.1 }),
    attempt({ verdict: 'Pass', weighted_score: 9.0 }),
    attempt({ verdict: 'Bare Fail', weighted_score: 5.0 }),
  ]);
  const state = map.get('station-a');

  it('keeps the pass even though a later attempt failed', () => {
    expect(state?.passed).toBe(true);
    expect(state?.bestVerdict).toBe('Pass');
  });

  it('reports the winning attempt score, not the latest', () => {
    expect(state?.bestScore).toBe(9.0);
  });

  it('counts every attempt', () => {
    expect(state?.attempts).toBe(3);
  });
});

describe('reduceStationPassMap — score belongs to the verdict beside it', () => {
  // The marking engine's verdict is not guaranteed to be monotone in
  // weighted_score (domain-level CF rules can fail a high-scoring attempt), so a
  // score ranked independently could be printed under someone else's verdict.
  const state = reduceStationPassMap([
    attempt({ verdict: 'Bare Pass', weighted_score: 5.8, max_score: 10.5 }),
    attempt({ verdict: 'Fail', weighted_score: 9.4, max_score: 10.5 }),
  ]).get('station-a');

  it('keeps the passing verdict', () => {
    expect(state?.passed).toBe(true);
    expect(state?.bestVerdict).toBe('Bare Pass');
  });

  it('never lends the failing attempt score to the passing verdict', () => {
    expect(state?.bestScore).toBe(5.8);
  });

  it('takes the higher score when two attempts share the winning band', () => {
    const tied = reduceStationPassMap([
      attempt({ verdict: 'Pass', weighted_score: 7.1 }),
      attempt({ verdict: 'Pass', weighted_score: 8.9 }),
    ]).get('station-a');

    expect(tied?.bestScore).toBe(8.9);
  });
});

describe('reduceStationPassMap — max_score denominator', () => {
  it('carries the winning attempt own denominator', () => {
    const state = reduceStationPassMap([
      attempt({ verdict: 'Fail', weighted_score: 40, max_score: 70 }),
      attempt({ verdict: 'Pass', weighted_score: 8.5, max_score: 10.5 }),
    ]).get('station-a');

    expect(state?.bestScore).toBe(8.5);
    expect(state?.bestMaxScore).toBe(10.5);
  });

  it('leaves the denominator null when the column was not selected', () => {
    expect(reduceStationPassMap([attempt()]).get('station-a')?.bestMaxScore).toBeNull();
  });

  it('rejects a zero or non-numeric denominator rather than dividing by it', () => {
    const state = reduceStationPassMap([
      attempt({ verdict: 'Pass', weighted_score: 8.5, max_score: 0 }),
    ]).get('station-a');

    expect(state?.bestMaxScore).toBeNull();
  });
});

describe('reduceStationPassMap — attempted but never passed', () => {
  const state = reduceStationPassMap([
    attempt({ verdict: 'Fail', weighted_score: 2.0 }),
    attempt({ verdict: 'Bare Fail', weighted_score: 5.4 }),
  ]).get('station-a');

  it('does not mark the station passed', () => {
    expect(state?.passed).toBe(false);
  });

  it('surfaces the best fail band so the UI can show how close it was', () => {
    expect(state?.bestVerdict).toBe('Bare Fail');
    expect(state?.bestScore).toBe(5.4);
  });
});

describe('reduceStationPassMap — legacy zero-score artefacts', () => {
  // A verdict with weighted_score 0 is the engine marking an empty pre-engine
  // transcript, not a consultation the user actually failed.
  it('never lets an artefact fail set a verdict or a score', () => {
    const state = reduceStationPassMap([
      attempt({ verdict: 'Fail', weighted_score: 0 }),
      attempt({ verdict: 'Fail', weighted_score: -1 }),
    ]).get('station-a');

    expect(state?.passed).toBe(false);
    expect(state?.bestVerdict).toBeNull();
    expect(state?.bestScore).toBeNull();
    expect(state?.attempts).toBe(2);
  });

  it('never lets an artefact PASS count as a pass', () => {
    const state = reduceStationPassMap([attempt({ verdict: 'Pass', weighted_score: 0 })]).get(
      'station-a',
    );

    expect(state?.passed).toBe(false);
    expect(state?.bestVerdict).toBeNull();
  });

  it('leaves a real pass intact when an artefact sits alongside it', () => {
    const state = reduceStationPassMap([
      attempt({ verdict: 'Fail', weighted_score: 0 }),
      attempt({ verdict: 'Pass', weighted_score: 7.7 }),
    ]).get('station-a');

    expect(state?.passed).toBe(true);
    expect(state?.bestScore).toBe(7.7);
  });
});

describe('reduceStationPassMap — unmarked and malformed rows', () => {
  it('counts an unmarked session as an attempt with no verdict', () => {
    const state = reduceStationPassMap([
      attempt({ verdict: null, weighted_score: null }),
    ]).get('station-a');

    expect(state?.passed).toBe(false);
    expect(state?.bestVerdict).toBeNull();
    expect(state?.attempts).toBe(1);
  });

  it('ignores a verdict string the schema does not know', () => {
    const state = reduceStationPassMap([
      attempt({ verdict: 'Merit', weighted_score: 9.9 }),
    ]).get('station-a');

    expect(state?.bestVerdict).toBeNull();
    expect(state?.bestScore).toBeNull();
  });

  it('reads numeric scores that arrive as strings', () => {
    // Postgres numeric columns can surface as strings through PostgREST.
    const state = reduceStationPassMap([
      attempt({ verdict: 'Pass', weighted_score: '8.25' }),
    ]).get('station-a');

    expect(state?.passed).toBe(true);
    expect(state?.bestScore).toBe(8.25);
  });
});

describe('reduceStationPassMap — several stations', () => {
  const map = reduceStationPassMap([
    attempt({ station_id: 'station-a', verdict: 'Pass', weighted_score: 8.5 }),
    attempt({ station_id: 'station-b', verdict: 'Fail', weighted_score: 4.0 }),
    attempt({ station_id: 'station-c', verdict: 'Fail', weighted_score: 0 }),
  ]);

  it('keeps each station tally separate', () => {
    expect(map.get('station-a')?.passed).toBe(true);
    expect(map.get('station-b')?.passed).toBe(false);
    expect(map.get('station-c')?.bestVerdict).toBeNull();
  });

  it('lists only the passed stations', () => {
    expect(passedStationIds(map)).toEqual(new Set(['station-a']));
  });
});

describe('flattenSessionRows', () => {
  it('flattens the 1:1 object shape PostgREST returns', () => {
    expect(
      flattenSessionRows([
        { station_id: 'station-a', session_results: { verdict: 'Pass', weighted_score: 8.5 } },
      ]),
    ).toEqual([
      { station_id: 'station-a', verdict: 'Pass', weighted_score: 8.5, max_score: null },
    ]);
  });

  it('tolerates the array shape', () => {
    expect(
      flattenSessionRows([
        { station_id: 'station-a', session_results: [{ verdict: 'Fail', weighted_score: 3 }] },
      ]),
    ).toEqual([{ station_id: 'station-a', verdict: 'Fail', weighted_score: 3, max_score: null }]);
  });

  it('turns a session with no result into an unscored attempt', () => {
    expect(
      flattenSessionRows([{ station_id: 'station-a', session_results: null }]),
    ).toEqual([
      { station_id: 'station-a', verdict: null, weighted_score: null, max_score: null },
    ]);
  });

  it('returns nothing when the query errored and handed back no array', () => {
    expect(flattenSessionRows(null)).toEqual([]);
  });

  it('carries max_score through the join', () => {
    expect(
      flattenSessionRows([
        {
          station_id: 'station-a',
          session_results: { verdict: 'Pass', weighted_score: 8.5, max_score: 10.5 },
        },
      ]),
    ).toEqual([
      { station_id: 'station-a', verdict: 'Pass', weighted_score: 8.5, max_score: 10.5 },
    ]);
  });
});

describe('getStationPassMap — query shape', () => {
  const staged = process.env.NEXT_PUBLIC_SHOW_STAGED_STATIONS;

  beforeEach(() => db.reset());
  afterEach(() => {
    process.env.NEXT_PUBLIC_SHOW_STAGED_STATIONS = staged;
  });

  it('filters sessions by the same station visibility the denominators use', async () => {
    delete process.env.NEXT_PUBLIC_SHOW_STAGED_STATIONS;
    await getStationPassMap('user-1');

    expect(db.state.select).toContain('stations!inner(is_active)');
    expect(db.state.filters).toContainEqual(['in', 'stations.is_active', [true]]);
  });

  it('widens with the deployment when staged stations are visible', async () => {
    process.env.NEXT_PUBLIC_SHOW_STAGED_STATIONS = '1';
    await getStationPassMap('user-1');

    expect(db.state.filters).toContainEqual(['in', 'stations.is_active', [true, false]]);
  });

  it('scopes to the user own completed sessions', async () => {
    await getStationPassMap('user-1');

    expect(db.state.filters).toContainEqual(['eq', 'user_id', 'user-1']);
    expect(db.state.filters).toContainEqual(['eq', 'status', 'completed']);
  });

  it('selects the max_score denominator alongside the verdict', async () => {
    await getStationPassMap('user-1');

    expect(db.state.select).toContain('session_results(verdict, weighted_score, max_score)');
  });

  it('returns null on query failure so callers can hide the number', async () => {
    db.reset({ data: null, error: { message: 'permission denied' } });

    // An empty Map would be indistinguishable from "passed nothing", which the
    // dashboard would then state as fact.
    expect(await getStationPassMap('user-1')).toBeNull();
  });

  it('returns a real map when the query succeeds', async () => {
    db.reset({
      data: [
        {
          station_id: 'station-a',
          session_results: { verdict: 'Pass', weighted_score: 8.5, max_score: 10.5 },
        },
      ],
    });

    const map = await getStationPassMap('user-1');
    expect(map?.get('station-a')?.passed).toBe(true);
    expect(map?.get('station-a')?.bestMaxScore).toBe(10.5);
  });
});
