import { describe, expect, it, vi } from 'vitest';
import type { SupabaseClient } from '@supabase/supabase-js';
import {
  archivedStationIds,
  countsTowardsIndex,
  keptPairKey,
  loadKeptPairs,
  type IndexedSession,
} from './caseIndex';

function attempt(userId: string, stationId: string, lifecycle: string | null): IndexedSession {
  return { user_id: userId, station_id: stationId, stations: lifecycle ? { lifecycle } : null };
}

describe('countsTowardsIndex', () => {
  const kept = new Set([keptPairKey('keeper', 'old')]);

  it('counts every live case, for everyone (today: every attempt)', () => {
    expect(countsTowardsIndex(attempt('anyone', 'live-case', 'live'), new Set())).toBe(true);
  });

  it('counts an archived case only for the person who keeps it', () => {
    expect(countsTowardsIndex(attempt('keeper', 'old', 'archived'), kept)).toBe(true);
    expect(countsTowardsIndex(attempt('someone-else', 'old', 'archived'), kept)).toBe(false);
  });

  it('never counts a draft', () => {
    expect(countsTowardsIndex(attempt('admin', 'draft-case', 'draft'), kept)).toBe(false);
  });
});

describe('archivedStationIds', () => {
  it('is empty while everything is live, so no keeper query runs', () => {
    expect(archivedStationIds([attempt('u', 'a', 'live'), attempt('u', 'b', 'live')])).toEqual([]);
  });

  it('lists each archived case once', () => {
    expect(
      archivedStationIds([
        attempt('u', 'old', 'archived'),
        attempt('v', 'old', 'archived'),
        attempt('u', 'a', 'live'),
      ]),
    ).toEqual(['old']);
  });
});

describe('loadKeptPairs', () => {
  /**
   * A chain that answers each page by its `.range(from, to)`: `pages[n]` is
   * the n-th page's rows (or an error). Records each range asked for.
   */
  function client(pages: { data: unknown; error: unknown }[]) {
    const ranges: [number, number][] = [];
    const from = vi.fn(() => {
      const chain = {
        select: () => chain,
        in: () => chain,
        order: () => chain,
        range: (start: number, end: number) => {
          ranges.push([start, end]);
          return Promise.resolve(pages[ranges.length - 1] ?? { data: [], error: null });
        },
      };
      return chain;
    });
    return { from, ranges, supabase: { from } as unknown as SupabaseClient };
  }

  it('skips the query when nothing archived was attempted', async () => {
    const { from, supabase } = client([{ data: [], error: null }]);
    expect(await loadKeptPairs(supabase, [])).toEqual(new Set());
    expect(from).not.toHaveBeenCalled();
  });

  it('returns user:station pairs', async () => {
    const { supabase } = client([{ data: [{ user_id: 'keeper', station_id: 'old' }], error: null }]);
    expect(await loadKeptPairs(supabase, ['old'])).toEqual(new Set(['keeper:old']));
  });

  it('pages past the 1000-row response cap', async () => {
    const full = Array.from({ length: 1000 }, (_, i) => ({ user_id: `u${i}`, station_id: 'old' }));
    const rest = Array.from({ length: 3 }, (_, i) => ({ user_id: `v${i}`, station_id: 'old' }));
    const { ranges, supabase } = client([
      { data: full, error: null },
      { data: rest, error: null },
    ]);
    const pairs = await loadKeptPairs(supabase, ['old']);
    expect(pairs.size).toBe(1003);
    expect(pairs.has('v2:old')).toBe(true);
    expect(ranges).toEqual([
      [0, 999],
      [1000, 1999],
    ]);
  });

  it('fails closed to nobody keeps anything', async () => {
    const { supabase } = client([{ data: null, error: { message: 'boom' } }]);
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    expect(await loadKeptPairs(supabase, ['old'])).toEqual(new Set());
    errorSpy.mockRestore();
  });

  it('fails closed on a later page too, rather than counting half the keepers', async () => {
    const full = Array.from({ length: 1000 }, (_, i) => ({ user_id: `u${i}`, station_id: 'old' }));
    const { supabase } = client([
      { data: full, error: null },
      { data: null, error: { message: 'boom' } },
    ]);
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    expect(await loadKeptPairs(supabase, ['old'])).toEqual(new Set());
    errorSpy.mockRestore();
  });
});
