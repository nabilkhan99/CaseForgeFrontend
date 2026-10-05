import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { SupabaseClient } from '@supabase/supabase-js'
import { personalAllowlist, stationsForAllowlist, type AllowlistSlots } from './caseVersionsAllowlist'
import { personaliseAllowlist } from './caseVersionsAllowlistData'
import { fakeDb, type FakeDb } from './caseVersionsFakeDb'

/**
 * Trial and cohort allowlists, read per person by SLOT.
 *
 * An allowlisted id X also covers the archived case X replaced (for its
 * keeper), and the live replacement of an archived X (for everyone else). A
 * keeper must be able to run their kept old case whichever version the list
 * names; a non-keeper must be able to run the replacement when the list names
 * the old case. Today (all live, nothing replaced) the list is unchanged.
 */

// PLAIN: today's shape. OLD → NEW: a switched pair. GONE: archived, no live
// replacement. DRAFT replaces PLAIN2 (not switched on).
const STATIONS = [
  { id: 'PLAIN', lifecycle: 'live', replaces_station_id: null },
  { id: 'OLD', lifecycle: 'archived', replaces_station_id: null },
  { id: 'NEW', lifecycle: 'live', replaces_station_id: 'OLD' },
  { id: 'GONE', lifecycle: 'archived', replaces_station_id: null },
  { id: 'PLAIN2', lifecycle: 'live', replaces_station_id: null },
  { id: 'DRAFT', lifecycle: 'draft', replaces_station_id: 'PLAIN2' },
] as const

function slots(ids: string[]): AllowlistSlots {
  const stations = STATIONS.filter((s) => ids.includes(s.id)).map((s) => ({ ...s }))
  const replacementOf = new Map<string, string>()
  for (const s of STATIONS) {
    if (s.lifecycle === 'live' && s.replaces_station_id && ids.includes(s.replaces_station_id)) {
      replacementOf.set(s.replaces_station_id, s.id)
    }
  }
  return { stations, replacementOf }
}

const NOBODY = new Set<string>()
const KEEPER = new Set(['OLD'])

describe('personalAllowlist', () => {
  it('is the list unchanged for today\'s bank', () => {
    expect(personalAllowlist(['PLAIN', 'PLAIN2'], slots(['PLAIN', 'PLAIN2']), NOBODY)).toEqual(['PLAIN', 'PLAIN2'])
  })

  it('opens the replacement to a non-keeper when the list names the old case', () => {
    expect(personalAllowlist(['PLAIN', 'OLD'], slots(['PLAIN', 'OLD']), NOBODY)).toEqual(['PLAIN', 'OLD', 'NEW'])
  })

  it('keeps a keeper on their old case when the list names the old case', () => {
    expect(personalAllowlist(['OLD'], slots(['OLD']), KEEPER)).toEqual(['OLD'])
  })

  it('opens the kept old case to its keeper when the list names the replacement', () => {
    expect(personalAllowlist(['NEW', 'PLAIN'], slots(['NEW', 'PLAIN']), KEEPER)).toEqual(['NEW', 'OLD', 'PLAIN'])
  })

  it('opens nothing extra to a non-keeper when the list names the replacement', () => {
    expect(personalAllowlist(['NEW'], slots(['NEW']), NOBODY)).toEqual(['NEW'])
  })

  it('opens nothing extra for an archived case with no live replacement', () => {
    expect(personalAllowlist(['GONE'], slots(['GONE']), NOBODY)).toEqual(['GONE'])
  })

  it('never follows a draft: it is not live, so it is no replacement yet', () => {
    expect(personalAllowlist(['PLAIN2'], slots(['PLAIN2']), NOBODY)).toEqual(['PLAIN2'])
  })

  it('lists each id once when both versions of a slot are named', () => {
    expect(personalAllowlist(['OLD', 'NEW'], slots(['OLD', 'NEW']), NOBODY)).toEqual(['OLD', 'NEW'])
    expect(personalAllowlist(['NEW', 'OLD'], slots(['NEW', 'OLD']), KEEPER)).toEqual(['NEW', 'OLD'])
  })

  it('keeps an id it knows nothing about', () => {
    expect(personalAllowlist(['nope'], slots([]), NOBODY)).toEqual(['nope'])
  })
})

describe('stationsForAllowlist (the trial panel)', () => {
  const index = (ids: string[]) => ids.map((id) => ({ id }))

  it('shows each slot once, as the version in this person\'s index', () => {
    // Non-keeper: index holds NEW, the list names OLD → panel shows NEW.
    expect(stationsForAllowlist(['PLAIN', 'OLD', 'NEW'], index(['NEW', 'PLAIN']))).toEqual([{ id: 'PLAIN' }, { id: 'NEW' }])
    // Keeper: index holds OLD, the list names NEW → panel shows OLD.
    expect(stationsForAllowlist(['NEW', 'OLD', 'PLAIN'], index(['OLD', 'PLAIN']))).toEqual([{ id: 'OLD' }, { id: 'PLAIN' }])
  })

  it('is the five in list order today', () => {
    const five = ['a', 'b', 'c', 'd', 'e']
    expect(stationsForAllowlist(five, index(['e', 'd', 'c', 'b', 'a', 'z'])).map((s) => s.id)).toEqual(five)
  })
})

describe('personaliseAllowlist (service-role reads)', () => {
  let db: FakeDb
  const client = () => db.client as unknown as SupabaseClient

  beforeEach(() => {
    db = fakeDb({
      stations: STATIONS.map((s) => ({ ...s })),
      case_keepers: [{ user_id: 'keeper', station_id: 'OLD' }],
    })
    vi.spyOn(console, 'error').mockImplementation(() => {})
  })

  it('returns today\'s list unchanged without reading keepers', async () => {
    expect(await personaliseAllowlist(client(), ['PLAIN', 'PLAIN2'], 'user-1')).toEqual(['PLAIN', 'PLAIN2'])
    // One read: the listed stations' own version columns. Nothing else.
    expect(db.reads).toEqual(['stations'])
  })

  it('reads nothing for an empty list', async () => {
    expect(await personaliseAllowlist(client(), [], 'user-1')).toEqual([])
    expect(db.reads).toEqual([])
  })

  it('widens per person: replacement for a non-keeper, old case for its keeper', async () => {
    expect(await personaliseAllowlist(client(), ['OLD'], 'user-1')).toEqual(['OLD', 'NEW'])
    expect(await personaliseAllowlist(client(), ['NEW'], 'keeper')).toEqual(['NEW', 'OLD'])
    expect(await personaliseAllowlist(client(), ['OLD'], 'keeper')).toEqual(['OLD'])
  })

  it('falls back to the list as written (never more) when a read fails', async () => {
    db.failing.add('case_keepers')
    expect(await personaliseAllowlist(client(), ['NEW'], 'keeper')).toEqual(['NEW'])
    db.failing.delete('case_keepers')
    db.failing.add('stations')
    expect(await personaliseAllowlist(client(), ['OLD'], 'user-1')).toEqual(['OLD'])
  })
})
