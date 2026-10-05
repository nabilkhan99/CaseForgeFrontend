import { describe, expect, it } from 'vitest'
import {
  decideCanRun,
  isStationLifecycle,
  redirectTargetFor,
  resolveCaseIndex,
  runRefusalMessage,
  type VersionedStation,
} from './caseVersions'

/**
 * The case-version rule (5 Oct 2026): a keeper of an old case sees and runs
 * ONLY the old case in its slot; everyone else sees and runs the replacement;
 * drafts are admins only.
 */

type Row = VersionedStation & { title: string }

const row = (id: string, lifecycle: Row['lifecycle'], replaces: string | null = null): Row => ({
  id,
  lifecycle,
  replaces_station_id: replaces,
  title: id,
})

// Bank: A (kept, untouched), N1 replaces O1, N2 replaces O2, B (untouched).
const A = row('A', 'live')
const O1 = row('O1', 'archived')
const N1 = row('N1', 'live', 'O1')
const O2 = row('O2', 'archived')
const N2 = row('N2', 'live', 'O2')
const B = row('B', 'live')
const LIVE = [A, N1, N2, B]

const ids = (rows: Row[]) => rows.map((r) => r.id)

describe('resolveCaseIndex', () => {
  it('gives a non-keeper exactly the live catalogue', () => {
    expect(ids(resolveCaseIndex(LIVE, []))).toEqual(['A', 'N1', 'N2', 'B'])
  })

  it('swaps a kept old case into its replacement slot, same position, same count', () => {
    expect(ids(resolveCaseIndex(LIVE, [O1]))).toEqual(['A', 'O1', 'N2', 'B'])
  })

  it('swaps every kept case', () => {
    expect(ids(resolveCaseIndex(LIVE, [O2, O1]))).toEqual(['A', 'O1', 'O2', 'B'])
  })

  it('never lists a kept case and its replacement together', () => {
    const index = ids(resolveCaseIndex(LIVE, [O1]))
    expect(index).toContain('O1')
    expect(index).not.toContain('N1')
  })

  it('keeps a kept case whose replacement is not live yet, at the end', () => {
    const draftReplacement = row('N3', 'draft', 'O3')
    const O3 = row('O3', 'archived')
    expect(ids(resolveCaseIndex([...LIVE, draftReplacement], [O3]))).toEqual(['A', 'N1', 'N2', 'B', 'O3'])
  })

  it('ignores rows in the wrong state rather than trusting the lists', () => {
    expect(ids(resolveCaseIndex([A, row('D', 'draft'), row('X', 'archived')], [row('L', 'live')]))).toEqual(['A'])
  })

  it('lists a kept case once even if two live rows claim it', () => {
    const twin = row('N1b', 'live', 'O1')
    expect(ids(resolveCaseIndex([N1, twin], [O1]))).toEqual(['O1'])
  })

  it('does not mutate its inputs', () => {
    const live = [...LIVE]
    resolveCaseIndex(live, [O1])
    expect(ids(live)).toEqual(['A', 'N1', 'N2', 'B'])
  })
})

describe('decideCanRun', () => {
  const nobody = { keptIds: new Set<string>(), isAdmin: false }
  const keeperOfO1 = { keptIds: new Set(['O1']), isAdmin: false }
  const admin = { keptIds: new Set<string>(), isAdmin: true }

  it('lets anyone run a live case that replaces nothing', () => {
    expect(decideCanRun(A, nobody)).toEqual({ allowed: true })
  })

  it('lets a non-keeper run a replacement', () => {
    expect(decideCanRun(N1, nobody)).toEqual({ allowed: true })
  })

  it('refuses a keeper the replacement of the case they keep', () => {
    expect(decideCanRun(N1, keeperOfO1)).toEqual({ allowed: false, reason: 'replaced_for_keeper' })
  })

  it('lets a keeper re-run the old case they keep', () => {
    expect(decideCanRun(O1, keeperOfO1)).toEqual({ allowed: true })
  })

  it('refuses an archived case to someone who does not keep it', () => {
    expect(decideCanRun(O1, nobody)).toEqual({ allowed: false, reason: 'archived_not_kept' })
    expect(decideCanRun(O2, keeperOfO1)).toEqual({ allowed: false, reason: 'archived_not_kept' })
  })

  it('refuses drafts to everyone but admins', () => {
    const draft = row('D', 'draft', 'O1')
    expect(decideCanRun(draft, nobody)).toEqual({ allowed: false, reason: 'draft' })
    expect(decideCanRun(draft, keeperOfO1)).toEqual({ allowed: false, reason: 'draft' })
    expect(decideCanRun(draft, admin)).toEqual({ allowed: true })
  })

  it('lets admins run anything, so Ishaq can try a draft before approving it', () => {
    expect(decideCanRun(O1, admin)).toEqual({ allowed: true })
    expect(decideCanRun(N1, { keptIds: new Set(['O1']), isAdmin: true })).toEqual({ allowed: true })
  })
})

describe('redirectTargetFor', () => {
  const replacementOf = new Map([['O1', 'N1']])

  it('sends a non-keeper asking for an old case to its replacement', () => {
    expect(redirectTargetFor(O1, 'archived_not_kept', replacementOf)).toBe('N1')
  })

  it('sends a keeper asking for the replacement back to their old case', () => {
    expect(redirectTargetFor(N1, 'replaced_for_keeper', replacementOf)).toBe('O1')
  })

  it('offers nothing for a draft, or an old case with no replacement', () => {
    expect(redirectTargetFor(row('D', 'draft'), 'draft', replacementOf)).toBeNull()
    expect(redirectTargetFor(O2, 'archived_not_kept', replacementOf)).toBeNull()
  })
})

describe('copy and guards', () => {
  it('words every refusal without ids or jargon', () => {
    for (const reason of ['draft', 'archived_not_kept', 'replaced_for_keeper'] as const) {
      const message = runRefusalMessage(reason)
      expect(message.length).toBeGreaterThan(10)
      expect(message).not.toMatch(/archiv|lifecycle|keeper|draft|—/i)
    }
  })

  it('recognises only the three lifecycle values', () => {
    expect(isStationLifecycle('live')).toBe(true)
    expect(isStationLifecycle('staged')).toBe(false)
    expect(isStationLifecycle(null)).toBe(false)
  })
})
