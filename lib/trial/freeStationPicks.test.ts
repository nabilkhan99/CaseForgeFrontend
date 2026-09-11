import { describe, expect, it, vi } from 'vitest'
import type { SupabaseClient } from '@supabase/supabase-js'
import {
  DEFAULT_STATION_MINUTES,
  caseCtaFor,
  listFreeStations,
  startHref,
  stationMeta,
  stationMinutes,
  toPickerStations,
} from './freeStationPicks'

/**
 * What /free lists, and where each Start button goes.
 *
 * The page has one job — five cases, in Ishaq's order, each one click from a
 * live patient — and two ways to fail it silently: listing the wrong flag's
 * stations, and losing the order. Neither throws. Both are checked here.
 */

interface Row {
  id: string
  title: string | null
  consultation_type?: string | null
  consultation_duration_seconds?: number | null
  domains?: { name: string } | { name: string }[] | null
}

const ROWS: Row[] = [
  {
    id: '2b077e48-0d12-442e-b004-c5dc3817c192',
    title: 'Diabetic man with burning feet at night',
    consultation_type: 'video',
    consultation_duration_seconds: 720,
    domains: { name: 'Metabolic Problems and Endocrinology' },
  },
  {
    id: '53cb2651-fcd9-46e7-80e9-287721c0eb56',
    title: "Father phoning about his daughter's rash",
    consultation_type: 'telephone',
    consultation_duration_seconds: 720,
    domains: [{ name: 'Patient < 19 years old' }],
  },
]

/** Whether this attempt is the ordered one, and what it should answer with. */
interface Bank {
  rows: Row[]
  /** Returned instead of rows when the query orders by `free_trial_order`. */
  orderedError?: { code?: string } | null
}

/**
 * A stand-in for the PostgREST builder:
 * every filter returns the builder and records itself, and awaiting it answers
 * from what the test set up. The builder is a thenable because that is what
 * supabase-js returns — the query runs when it is awaited, not on a terminal
 * method.
 */
function fakeAdmin(bank: Bank) {
  const calls = { tables: [] as string[], filters: {} as Record<string, unknown>, orders: [] as string[][] }
  let orders: string[] = []

  const settle = () => {
    if (bank.orderedError && orders.includes('free_trial_order')) {
      return { data: null, error: bank.orderedError }
    }
    return { data: bank.rows, error: null }
  }

  const builder: Record<string, unknown> = {
    select: () => builder,
    eq: (column: string, value: unknown) => {
      calls.filters[column] = value
      return builder
    },
    order: (column: string) => {
      orders.push(column)
      return builder
    },
    then: (resolve: (value: unknown) => unknown) => {
      calls.orders.push(orders)
      const result = settle()
      orders = []
      return Promise.resolve(result).then(resolve)
    },
  }

  const admin = {
    from: (table: string) => {
      calls.tables.push(table)
      return builder
    },
  } as unknown as SupabaseClient

  return { admin, calls }
}

describe('a picker row', () => {
  it('sends Start straight into a consultation on that case', () => {
    // The guest door, not an account form: one click and the patient is
    // there. Identity is asked for afterwards, while it is being marked.
    expect(startHref('abc-123')).toBe('/try/talk?station=abc-123')
  })

  it('escapes an id rather than pasting it into the query string', () => {
    expect(startHref('a b&c')).toBe('/try/talk?station=a%20b%26c')
  })

  it('reads "<domain> · 12 min"', () => {
    expect(stationMeta(ROWS[0])).toBe('Metabolic Problems and Endocrinology · 12 min')
  })

  it('names the modality only when it is a phone call', () => {
    expect(stationMeta(ROWS[1])).toBe('Patient < 19 years old · 12 min · telephone')
  })

  it('falls back to twelve minutes when the row does not say', () => {
    expect(stationMinutes(null)).toBe(DEFAULT_STATION_MINUTES)
    expect(stationMinutes(0)).toBe(DEFAULT_STATION_MINUTES)
    expect(stationMinutes(720)).toBe(12)
    expect(stationMinutes(600)).toBe(10)
  })

  it('drops the domain rather than the row when there is no domain', () => {
    expect(stationMeta({ ...ROWS[0], domains: null })).toBe('12 min')
  })

  it('drops a row with no title, because the title is the row', () => {
    expect(toPickerStations([{ id: 'x', title: null }, ROWS[0]])).toHaveLength(1)
  })
})

describe('what /free lists', () => {
  it('asks for the free-trial stations in free_trial_order', async () => {
    const { admin, calls } = fakeAdmin({ rows: ROWS })
    await listFreeStations(admin)

    expect(calls.tables).toEqual(['stations'])
    expect(calls.filters).toMatchObject({ is_free_trial: true, is_active: true })
    expect(calls.orders[0]).toEqual(['free_trial_order', 'title'])
  })

  it('never lists a staged station', async () => {
    // /free is the public mouth of the guest funnel: the live bank only, so a
    // staged case cannot be reached anonymously from a preview deployment.
    const { admin, calls } = fakeAdmin({ rows: ROWS })
    await listFreeStations(admin)
    expect(calls.filters.is_active).toBe(true)
  })

  it('keeps the order the query returned and links each Start to its station', async () => {
    const { admin } = fakeAdmin({ rows: ROWS })
    const stations = await listFreeStations(admin)

    expect(stations.map((station) => station.id)).toEqual([ROWS[0].id, ROWS[1].id])
    for (const station of stations) {
      expect(station.href).toBe(`/try/talk?station=${station.id}`)
    }
    expect(stations[0].title).toBe(ROWS[0].title)
    expect(stations[1].meta).toContain('telephone')
  })

  it('still lists the five when free_trial_order does not exist yet', async () => {
    // Between a deploy and its migration, PostgREST answers a select ordering
    // on the missing column with 42703. The page must show five cases in the
    // wrong order rather than none in the right one.
    const quiet = vi.spyOn(console, 'error').mockImplementation(() => {})
    const { admin, calls } = fakeAdmin({ rows: ROWS, orderedError: { code: '42703' } })

    const stations = await listFreeStations(admin)

    expect(stations).toHaveLength(2)
    expect(calls.orders[1]).toEqual(['title'])
    expect(quiet).not.toHaveBeenCalled()
    quiet.mockRestore()
  })

  it('returns nothing, loudly, when the query fails for any other reason', async () => {
    const quiet = vi.spyOn(console, 'error').mockImplementation(() => {})
    const { admin } = fakeAdmin({ rows: ROWS, orderedError: { code: '08006' } })

    expect(await listFreeStations(admin)).toEqual([])
    expect(quiet).toHaveBeenCalled()
    quiet.mockRestore()
  })
})

describe('the call to action on a public case page', () => {
  it('offers THIS case when it is one of the five', () => {
    // Somebody reading a chlamydia results case wants to sit that case, and
    // the guest door will open it because the flag says it may.
    expect(caseCtaFor({ id: 'abc-123', isFree: true })).toEqual({
      label: 'Practise this case free',
      href: '/try/talk?station=abc-123',
    })
  })

  it('offers the five, not this one, when this one is not free', () => {
    // The guest door opens free cases ONLY — asked for another it falls back
    // to the first of the five — so "practise this case free" on the other
    // ~195 would be a promise it cannot keep.
    expect(caseCtaFor({ id: 'abc-123', isFree: false })).toEqual({
      label: 'Try 5 free cases',
      href: '/free',
    })
  })

  it('never sends a paid case id to the guest door', () => {
    expect(caseCtaFor({ id: 'abc-123', isFree: false }).href).not.toContain('abc-123')
  })
})
