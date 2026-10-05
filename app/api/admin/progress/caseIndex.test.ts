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
  function client(response: { data: unknown; error: unknown }) {
    const from = vi.fn(() => ({
      select: () => ({ in: () => Promise.resolve(response) }),
    }));
    return { from, supabase: { from } as unknown as SupabaseClient };
  }

  it('skips the query when nothing archived was attempted', async () => {
    const { from, supabase } = client({ data: [], error: null });
    expect(await loadKeptPairs(supabase, [])).toEqual(new Set());
    expect(from).not.toHaveBeenCalled();
  });

  it('returns user:station pairs', async () => {
    const { supabase } = client({ data: [{ user_id: 'keeper', station_id: 'old' }], error: null });
    expect(await loadKeptPairs(supabase, ['old'])).toEqual(new Set(['keeper:old']));
  });

  it('fails closed to nobody keeps anything', async () => {
    const { supabase } = client({ data: null, error: { message: 'boom' } });
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    expect(await loadKeptPairs(supabase, ['old'])).toEqual(new Set());
    errorSpy.mockRestore();
  });
});
