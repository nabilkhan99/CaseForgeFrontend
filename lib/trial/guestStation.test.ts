import { beforeEach, describe, expect, it, vi } from 'vitest'

/**
 * Contract C2, the rule that keeps the anonymous Azure mint pointed at five
 * cases instead of two hundred.
 *
 * The version of this module that shipped in September had a third fallback —
 * "any active case at all" — so that a deployment whose `is_free_trial` flags
 * were not set yet still had a door that opened. That is exactly the bug worth
 * pinning against: a guest consultation spends real realtime minutes against no
 * account, so a fallback that reaches past the five hands the paid bank to
 * anyone who can edit a query string. An empty free list must end in a page
 * that says so.
 */

vi.mock('server-only', () => ({}))

const FREE = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
const FIRST_FREE = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'
const PAID = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc'

const state = {
  /** Rows in the fake `stations` table. */
  rows: [] as { id: string; is_free_trial: boolean; is_active: boolean; title: string }[],
  /** Set to make an `order('free_trial_order')` fail the way PostgREST does. */
  orderError: null as { code?: string } | null,
  /** Every set of filters a query applied, so the test can assert on them. */
  queries: [] as Record<string, unknown>[],
}

/** A stand-in for the PostgREST builder: filters accumulate, terminals answer. */
function stations() {
  const filters: Record<string, unknown> = {}
  const orders: string[] = []
  state.queries.push(filters)

  const rows = () =>
    state.rows
      .filter((row) =>
        Object.entries(filters).every(
          ([column, value]) => (row as unknown as Record<string, unknown>)[column] === value,
        ),
      )
      .sort((a, b) => a.title.localeCompare(b.title))
      .map((row) => ({ id: row.id }))

  const builder = {
    select: () => builder,
    eq: (column: string, value: unknown) => {
      filters[column] = value
      return builder
    },
    order: (column: string) => {
      orders.push(column)
      return builder
    },
    maybeSingle: async () => ({ data: rows()[0] ?? null, error: null }),
    limit: async (n: number) => {
      if (state.orderError && orders.includes('free_trial_order')) {
        return { data: null, error: state.orderError }
      }
      return { data: rows().slice(0, n), error: null }
    },
  }
  return builder
}

const admin = { from: () => stations() } as never

const { firstFreeStationId, freeStationId, pickGuestStationId } = await import('./guestStation')

beforeEach(() => {
  vi.spyOn(console, 'error').mockImplementation(() => {})
  state.orderError = null
  state.queries = []
  state.rows = [
    { id: FIRST_FREE, is_free_trial: true, is_active: true, title: 'A first free case' },
    { id: FREE, is_free_trial: true, is_active: true, title: 'Z another free case' },
    { id: PAID, is_free_trial: false, is_active: true, title: 'A paid case' },
  ]
})

describe('pickGuestStationId — C2', () => {
  it('opens the case asked for when it is one of the free ones', async () => {
    expect(await pickGuestStationId(admin, FREE)).toBe(FREE)
  })

  it('falls back to the first free case when a PAID one is asked for', async () => {
    // Never the paid one. This is the whole rule.
    expect(await pickGuestStationId(admin, PAID)).toBe(FIRST_FREE)
  })

  it('falls back to the first free case when the one asked for is retired', async () => {
    state.rows = state.rows.map((row) =>
      row.id === FREE ? { ...row, is_active: false } : row,
    )
    expect(await pickGuestStationId(admin, FREE)).toBe(FIRST_FREE)
  })

  it('falls back to the first free case with nothing asked for', async () => {
    expect(await pickGuestStationId(admin, null)).toBe(FIRST_FREE)
  })

  it('ignores a station id that is not a uuid rather than asking PostgREST about it', async () => {
    expect(await pickGuestStationId(admin, 'not-a-uuid')).toBe(FIRST_FREE)
    expect(state.queries.some((filters) => filters.id === 'not-a-uuid')).toBe(false)
  })

  it('returns null when no case is free, rather than reaching for a paid one', async () => {
    state.rows = [{ id: PAID, is_free_trial: false, is_active: true, title: 'A paid case' }]
    expect(await pickGuestStationId(admin, PAID)).toBeNull()
    expect(await pickGuestStationId(admin, null)).toBeNull()
  })

  it('asks for both flags on every lookup it makes', async () => {
    await pickGuestStationId(admin, FREE)
    for (const filters of state.queries) {
      expect(filters.is_free_trial).toBe(true)
      expect(filters.is_active).toBe(true)
    }
  })

  it('survives free_trial_order not existing yet', async () => {
    // 20260906_trial_grants.sql adds the column; between a deploy and its
    // migration PostgREST answers a select naming it with 42703. Ordering by
    // title is a different order, not no door.
    state.orderError = { code: '42703' }
    expect(await pickGuestStationId(admin, null)).toBe(FIRST_FREE)
    expect(console.error).not.toHaveBeenCalled()
  })

  it('refuses rather than guesses when the free lookup fails for any other reason', async () => {
    state.orderError = { code: '08006' }
    expect(await firstFreeStationId(admin)).toBeNull()
    expect(console.error).toHaveBeenCalled()
  })
})

describe('freeStationId — the explicit-station question', () => {
  it('answers with the id for a free active case and null for anything else', async () => {
    expect(await freeStationId(admin, FREE)).toBe(FREE)
    expect(await freeStationId(admin, PAID)).toBeNull()
    expect(await freeStationId(admin, null)).toBeNull()
    expect(await freeStationId(admin, 'not-a-uuid')).toBeNull()
  })
})
