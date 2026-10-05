import { beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * A table-aware PostgREST stub. Each `from()` call records its table, select
 * and filters, and resolves through a small in-memory database that applies
 * the filters the library uses (eq / in on plain columns). That lets the tests
 * assert both WHAT a person sees and HOW MANY queries it cost — the empty-
 * keeper path must not fire the kept-rows query at all.
 */
const db = vi.hoisted(() => {
  type Filter = [op: 'eq' | 'in', column: string, value: unknown];
  interface Call {
    table: string;
    select: string;
    filters: Filter[];
  }
  type Row = Record<string, unknown>;

  const state = {
    calls: [] as Call[],
    tables: {} as Record<string, Row[]>,
    errors: {} as Record<string, { message: string }>,
  };

  function matches(row: Row, [op, column, value]: Filter): boolean {
    if (op === 'eq') return row[column] === value;
    return (value as unknown[]).includes(row[column]);
  }

  function resolve(call: Call): { data: unknown; error: unknown } {
    const error = state.errors[call.table];
    if (error) return { data: null, error };
    const rows = (state.tables[call.table] ?? []).filter((row) =>
      call.filters.every((filter) => matches(row, filter)),
    );
    return { data: rows, error: null };
  }

  function from(table: string) {
    const call: Call = { table, select: '', filters: [] };
    state.calls.push(call);
    let single = false;
    const chain = {
      select(columns: string) {
        call.select = columns;
        return chain;
      },
      eq(column: string, value: unknown) {
        call.filters.push(['eq', column, value]);
        return chain;
      },
      in(column: string, value: unknown) {
        call.filters.push(['in', column, value]);
        return chain;
      },
      order() {
        return chain;
      },
      overrideTypes() {
        return chain;
      },
      single() {
        single = true;
        return chain;
      },
      then<T>(onFulfilled: (value: { data: unknown; error: unknown }) => T) {
        const result = resolve(call);
        const data = single && Array.isArray(result.data) ? (result.data[0] ?? null) : result.data;
        return Promise.resolve({ ...result, data }).then(onFulfilled);
      },
    };
    return chain;
  }

  return {
    state,
    client: { from },
    reset(tables: Record<string, Row[]>) {
      state.calls = [];
      state.tables = tables;
      state.errors = {};
    },
    callsTo(table: string) {
      return state.calls.filter((call) => call.table === table);
    },
  };
});

vi.mock('@/lib/supabase/client', () => ({ createClient: () => db.client }));

import {
  getAllStations,
  getRandomStation,
  getStationIndex,
  getStationsForDomain,
} from './station-library';

const CARDIO = 'domain-cardio';
const RESP = 'domain-resp';
const USER = 'user-keeper';
const OTHER = 'user-other';

function station(
  id: string,
  title: string,
  domainId: string,
  lifecycle: 'live' | 'archived' | 'draft' = 'live',
  replaces: string | null = null,
) {
  return {
    id,
    title,
    patient_name: `Patient ${id}`,
    domain_id: domainId,
    consultation_duration_seconds: 720,
    difficulty: 'intermediate',
    is_active: lifecycle === 'live',
    lifecycle,
    replaces_station_id: replaces,
    candidate_instructions: null,
  };
}

/**
 * Today's shape: everything live, nobody keeps anything. Rows are already in
 * title order, which is what `.order('title')` asks Postgres for.
 */
const TODAY = [
  station('a', 'Angina', CARDIO),
  station('b', 'Breathless', RESP),
  station('c', 'Chest pain', CARDIO),
];

/**
 * After a batch: 'c' (Chest pain) replaced by 'c2', and 'b' (a respiratory
 * case) replaced by 'b2' filed under cardiology — so its keeper must still
 * find the old case under respiratory. Plus a draft nobody but admins sees.
 */
const AFTER_BATCH = [
  station('a', 'Angina', CARDIO),
  station('b', 'Breathless', RESP, 'archived'),
  station('b2', 'Breathless again', CARDIO, 'live', 'b'),
  station('c', 'Chest pain', CARDIO, 'archived'),
  station('c2', 'Chest pain, new', CARDIO, 'live', 'c'),
  station('d', 'Dizziness', CARDIO, 'draft'),
];

const DOMAINS = [
  { id: CARDIO, name: 'Cardiovascular' },
  { id: RESP, name: 'Respiratory' },
];

function session(id: string, userId: string, stationId: string, verdict: string | null, score: number | null) {
  return {
    id,
    user_id: userId,
    station_id: stationId,
    status: 'completed',
    overall_score: score,
    started_at: '2026-09-01T10:00:00Z',
    completed_at: '2026-09-01T10:15:00Z',
    session_results: verdict ? { verdict, weighted_score: score, max_score: 10.5 } : null,
  };
}

const ids = (rows: { id: string }[]) => rows.map((row) => row.id);

describe('getStationIndex — today (all live, no keepers)', () => {
  beforeEach(() =>
    db.reset({ stations: TODAY, domains: DOMAINS, case_keepers: [], clinical_sessions: [] }),
  );

  it('returns exactly the live bank, in order', async () => {
    const index = await getStationIndex(USER);
    expect(ids(index)).toEqual(['a', 'b', 'c']);
    expect(index.map((s) => s.domain_name)).toEqual(['Cardiovascular', 'Respiratory', 'Cardiovascular']);
  });

  it('reads the live catalogue by lifecycle, not by staged-preview widening', async () => {
    await getStationIndex(USER);
    const [live] = db.callsTo('stations');
    expect(live.filters).toContainEqual(['eq', 'lifecycle', 'live']);
    expect(live.select).toContain('lifecycle');
    expect(live.select).toContain('replaces_station_id');
  });

  it('does not load kept rows when the person keeps nothing', async () => {
    await getStationIndex(USER);
    expect(db.callsTo('case_keepers')).toHaveLength(1);
    expect(db.callsTo('stations')).toHaveLength(1);
  });

  it('does not even look up keepers for a signed-out caller', async () => {
    await getStationIndex();
    expect(db.callsTo('case_keepers')).toHaveLength(0);
    expect(db.callsTo('clinical_sessions')).toHaveLength(0);
  });
});

describe('getStationIndex — after a batch', () => {
  beforeEach(() =>
    db.reset({
      stations: AFTER_BATCH,
      domains: DOMAINS,
      case_keepers: [{ user_id: USER, station_id: 'c' }],
      clinical_sessions: [
        session('s1', USER, 'c', 'Pass', 7.5),
        session('s2', USER, 'c', 'Fail', 4.0),
      ],
    }),
  );

  it("puts a keeper's old case in its slot, never beside its replacement", async () => {
    const index = await getStationIndex(USER);
    expect(ids(index)).toEqual(['a', 'b2', 'c']);
    expect(ids(index)).not.toContain('c2');
  });

  it('shows everyone else the replacement, and never a draft or an archived case', async () => {
    const index = await getStationIndex(OTHER);
    expect(ids(index)).toEqual(['a', 'b2', 'c2']);
  });

  it('keeps the count at the live count for keeper and non-keeper alike', async () => {
    const live = AFTER_BATCH.filter((s) => s.lifecycle === 'live').length;
    expect(await getStationIndex(USER)).toHaveLength(live);
    expect(await getStationIndex(OTHER)).toHaveLength(live);
  });

  it("keeps the old case's attempts and pass, keyed by its own id", async () => {
    const old = (await getStationIndex(USER)).find((s) => s.id === 'c');
    expect(old?.attempts.map((a) => a.sessionId)).toEqual(['s1', 's2']);
    expect(old?.passed).toBe(true);
    expect(old?.bestVerdict).toBe('Pass');
    expect(old?.bestScore).toBe(7.5);
    expect(old?.status).toBe('completed');
  });

  it('reads only archived rows for the kept ids, in one extra query', async () => {
    await getStationIndex(USER);
    const stationCalls = db.callsTo('stations');
    expect(stationCalls).toHaveLength(2);
    expect(stationCalls[1].filters).toEqual([
      ['in', 'id', ['c']],
      ['eq', 'lifecycle', 'archived'],
    ]);
  });

  it('falls back to the live catalogue if the keeper lookup fails', async () => {
    db.state.errors.case_keepers = { message: 'permission denied' };
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    expect(ids(await getStationIndex(USER))).toEqual(['a', 'b2', 'c2']);
    errorSpy.mockRestore();
  });
});

describe('getStationsForDomain', () => {
  it('today: the domain\'s live cases, with no kept-rows query', async () => {
    db.reset({ stations: TODAY, domains: DOMAINS, case_keepers: [], clinical_sessions: [] });
    expect(ids(await getStationsForDomain(CARDIO, USER))).toEqual(['a', 'c']);
    expect(db.callsTo('stations')).toHaveLength(1);
  });

  it('shows a kept old case under its own topic, even when its replacement is filed elsewhere', async () => {
    db.reset({
      stations: AFTER_BATCH,
      domains: DOMAINS,
      case_keepers: [
        { user_id: USER, station_id: 'b' },
        { user_id: USER, station_id: 'c' },
      ],
      clinical_sessions: [session('s3', USER, 'b', 'Bare Pass', 6.0)],
    });

    const resp = await getStationsForDomain(RESP, USER);
    expect(ids(resp)).toEqual(['b']);
    expect(resp[0].domain_name).toBe('Respiratory');
    expect(resp[0].passed).toBe(true);

    // Neither replacement shows to the person keeping the cases they replaced.
    expect(ids(await getStationsForDomain(CARDIO, USER))).toEqual(['a', 'c']);
  });

  it('shows a non-keeper the replacements and no old cases', async () => {
    db.reset({ stations: AFTER_BATCH, domains: DOMAINS, case_keepers: [], clinical_sessions: [] });
    expect(ids(await getStationsForDomain(CARDIO, OTHER))).toEqual(['a', 'b2', 'c2']);
    expect(await getStationsForDomain(RESP, OTHER)).toEqual([]);
  });

  it('agrees with the flat index, topic by topic', async () => {
    db.reset({
      stations: AFTER_BATCH,
      domains: DOMAINS,
      case_keepers: [
        { user_id: USER, station_id: 'b' },
        { user_id: USER, station_id: 'c' },
      ],
      clinical_sessions: [],
    });
    const index = await getStationIndex(USER);
    for (const domain of DOMAINS) {
      const topic = await getStationsForDomain(domain.id, USER);
      expect(new Set(ids(topic))).toEqual(
        new Set(ids(index.filter((s) => s.domain_id === domain.id))),
      );
    }
  });
});

describe('getAllStations / getRandomStation (Up next fallback)', () => {
  beforeEach(() =>
    db.reset({
      stations: AFTER_BATCH,
      domains: DOMAINS,
      case_keepers: [{ user_id: USER, station_id: 'c' }],
      clinical_sessions: [],
    }),
  );

  it('resolves the same index, so a keeper is never offered the replacement', async () => {
    expect(ids(await getAllStations(USER))).toEqual(['a', 'b2', 'c']);
    expect(ids(await getAllStations(OTHER))).toEqual(['a', 'b2', 'c2']);
  });

  it('never picks the replacement of a kept case', async () => {
    const random = vi.spyOn(Math, 'random');
    for (const value of [0, 0.4, 0.99]) {
      random.mockReturnValue(value);
      expect((await getRandomStation(USER))?.id).not.toBe('c2');
    }
    random.mockRestore();
  });
});
