import { beforeEach, describe, expect, it, vi } from 'vitest'

/**
 * GET /api/coaching-sessions: the contract the booking picker builds against.
 *
 * Capacity is one booking per slot, so the two things pinned hardest are that
 * the response is never cached and that it asks the view for upcoming slots in
 * date then slot order.
 */

const mocks = vi.hoisted(() => ({
  rows: [] as Array<Record<string, unknown>>,
  error: null as unknown,
  throws: false,
  calls: [] as Array<[string, ...unknown[]]>,
}))

vi.mock('@/lib/supabase/admin', () => ({
  getSupabaseAdmin: () => {
    if (mocks.throws) throw new Error('Missing SUPABASE_SERVICE_ROLE_KEY')
    const builder = {
      select: (columns: string) => {
        mocks.calls.push(['select', columns])
        return builder
      },
      eq: (column: string, value: unknown) => {
        mocks.calls.push(['eq', column, value])
        return builder
      },
      order: (column: string, options: unknown) => {
        mocks.calls.push(['order', column, options])
        return builder
      },
      then: (resolve: (value: unknown) => unknown) =>
        Promise.resolve({ data: mocks.rows, error: mocks.error }).then(resolve),
    }
    return {
      from: (table: string) => {
        mocks.calls.push(['from', table])
        return builder
      },
    }
  },
}))

const { GET } = await import('./route')

const OPEN_MORNING = {
  day: '2026-11-07',
  slot: 'morning',
  cutoff_at: '2026-11-07T00:00:00+00:00',
  status: 'booked',
}
const OPEN_AFTERNOON = { ...OPEN_MORNING, slot: 'afternoon', status: 'open' }

beforeEach(() => {
  mocks.rows = []
  mocks.error = null
  mocks.throws = false
  mocks.calls = []
  vi.spyOn(console, 'error').mockImplementation(() => {})
})

describe('GET /api/coaching-sessions', () => {
  it('returns the slots in the public shape, with no-store caching', async () => {
    mocks.rows = [OPEN_MORNING, OPEN_AFTERNOON]

    const response = await GET()

    expect(response.status).toBe(200)
    expect(response.headers.get('Cache-Control')).toBe('no-store')
    expect(await response.json()).toEqual({ slots: [OPEN_MORNING, OPEN_AFTERNOON] })
  })

  it('reads upcoming slots from the view, ordered by date then slot', async () => {
    await GET()

    expect(mocks.calls).toEqual([
      ['from', 'coaching_slot_availability'],
      ['select', 'day, slot, cutoff_at, status'],
      ['eq', 'past', false],
      ['order', 'day', { ascending: true }],
      ['order', 'slot_order', { ascending: true }],
    ])
  })

  it('drops a row it could not render correctly rather than offering it', async () => {
    mocks.rows = [OPEN_MORNING, { ...OPEN_AFTERNOON, slot: 'evening' }, { ...OPEN_AFTERNOON, status: 'sold_out' }]

    const body = await (await GET()).json()

    expect(body.slots).toEqual([OPEN_MORNING])
  })

  it('answers 500 with an error when the query fails', async () => {
    mocks.error = { message: 'relation does not exist' }

    const response = await GET()

    expect(response.status).toBe(500)
    expect(response.headers.get('Cache-Control')).toBe('no-store')
    expect(await response.json()).toEqual({ error: 'Failed to load coaching sessions' })
  })

  it('answers 500 when the admin client cannot be built', async () => {
    mocks.throws = true

    const response = await GET()

    expect(response.status).toBe(500)
    expect((await response.json()).error).toBeTruthy()
  })
})
