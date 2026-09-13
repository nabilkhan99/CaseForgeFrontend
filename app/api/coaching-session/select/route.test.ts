import { beforeEach, describe, expect, it, vi } from 'vitest'

/**
 * POST /api/coaching-session/select: booking a one to one coaching session for
 * a Complete customer who has none yet.
 *
 * Ownership is decided here (the signed-in account's own paid Complete rows,
 * oldest first); scarcity is decided in the database by
 * `book_coaching_slot_for_order`. Both halves are pinned, plus every outcome
 * the RPC can answer with.
 */

const mocks = vi.hoisted(() => ({
  user: { id: 'user-1', email: 'Buyer@NHS.net' } as { id: string; email?: string } | null,
  orders: [] as Array<{ id: string; coaching_day: string | null }>,
  ordersError: null as unknown,
  outcome: 'booked' as unknown,
  rpcError: null as unknown,
  rpc: vi.fn(),
  orderFilters: [] as Array<[string, string, unknown]>,
}))

vi.mock('@/lib/commerce/serverEntitlement', () => ({
  getServerEntitlement: async () => ({ user: mocks.user }),
}))

vi.mock('@/lib/supabase/admin', () => ({
  getSupabaseAdmin: () => ({
    rpc: async (name: string, params: unknown) => {
      mocks.rpc(name, params)
      return { data: mocks.outcome, error: mocks.rpcError }
    },
    from: () => {
      const builder = {
        select: () => builder,
        ilike: (column: string, value: unknown) => {
          mocks.orderFilters.push(['ilike', column, value])
          return builder
        },
        eq: (column: string, value: unknown) => {
          mocks.orderFilters.push(['eq', column, value])
          return builder
        },
        order: async (column: string, options: unknown) => {
          mocks.orderFilters.push(['order', column, options])
          return { data: mocks.orders, error: mocks.ordersError }
        },
      }
      return builder
    },
  }),
}))

const { POST } = await import('./route')

async function select(body: unknown) {
  const response = await POST(
    new Request('https://www.fourteenfisherman.com/api/coaching-session/select', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: typeof body === 'string' ? body : JSON.stringify(body),
    }),
  )
  return { status: response.status, body: await response.json() }
}

const CHOICE = { coachingDate: '2026-11-07', coachingSlot: 'afternoon' }

beforeEach(() => {
  vi.clearAllMocks()
  vi.spyOn(console, 'error').mockImplementation(() => {})
  mocks.user = { id: 'user-1', email: 'Buyer@NHS.net' }
  mocks.orders = [{ id: 'order-1', coaching_day: null }]
  mocks.ordersError = null
  mocks.outcome = 'booked'
  mocks.rpcError = null
  mocks.orderFilters = []
})

describe('who may book', () => {
  it('answers 401 when nobody is signed in', async () => {
    mocks.user = null

    const { status } = await select(CHOICE)

    expect(status).toBe(401)
    expect(mocks.rpc).not.toHaveBeenCalled()
  })

  it('looks only at the account’s own paid Complete orders, oldest first', async () => {
    await select(CHOICE)

    expect(mocks.orderFilters).toContainEqual(['eq', 'plan', 'complete'])
    expect(mocks.orderFilters).toContainEqual(['eq', 'status', 'paid'])
    expect(mocks.orderFilters).toContainEqual(['order', 'created_at', { ascending: true }])
    const emailFilter = mocks.orderFilters.find(([op]) => op === 'ilike')
    expect(emailFilter?.[1]).toBe('email')
    expect(String(emailFilter?.[2]).toLowerCase()).toContain('buyer@nhs')
  })

  it('answers 403 when the account has no paid Complete order', async () => {
    mocks.orders = []

    const { status, body } = await select(CHOICE)

    expect(status).toBe(403)
    expect(body.error).toMatch(/Complete/)
    expect(mocks.rpc).not.toHaveBeenCalled()
  })

  it('answers 409 already_booked when every Complete order already has a session', async () => {
    mocks.orders = [{ id: 'order-1', coaching_day: '2026-10-04' }]

    const { status, body } = await select(CHOICE)

    expect(status).toBe(409)
    expect(body).toEqual({
      error: 'Your coaching session is already booked. Email hello@fourteenfisherman.com to move it.',
      code: 'already_booked',
    })
    expect(mocks.rpc).not.toHaveBeenCalled()
  })

  it('fills the oldest order that has no session yet', async () => {
    mocks.orders = [
      { id: 'order-old', coaching_day: '2026-10-04' },
      { id: 'order-new', coaching_day: null },
    ]

    await select(CHOICE)

    expect(mocks.rpc).toHaveBeenCalledWith('book_coaching_slot_for_order', {
      p_order_id: 'order-new',
      p_day: '2026-11-07',
      p_slot: 'afternoon',
    })
  })
})

describe('what is booked', () => {
  it.each([
    ['no body', 'not json'],
    ['no slot', { coachingDate: '2026-11-07' }],
    ['an unknown slot', { coachingDate: '2026-11-07', coachingSlot: 'evening' }],
    ['a malformed date', { coachingDate: '7 November', coachingSlot: 'morning' }],
  ])('answers 400 for %s', async (_label, body) => {
    const { status, body: response } = await select(body)

    expect(status).toBe(400)
    expect(response.error).toBe('Please choose a date and time for your coaching session.')
    expect(mocks.rpc).not.toHaveBeenCalled()
  })

  it('returns the date, slot and label on success', async () => {
    const { status, body } = await select(CHOICE)

    expect(status).toBe(200)
    expect(body).toEqual({
      coachingDate: '2026-11-07',
      coachingSlot: 'afternoon',
      label: 'Saturday 7 November 2026, 13:00 to 16:00',
    })
  })

  it.each([
    ['taken', 'slot_taken', 'That slot has just been booked. Please choose another.'],
    ['closed', 'slot_closed', 'Bookings for that date have closed. Please choose another.'],
    [
      'already_booked',
      'already_booked',
      'Your coaching session is already booked. Email hello@fourteenfisherman.com to move it.',
    ],
  ])('maps the %s outcome to a 409 %s', async (outcome, code, error) => {
    mocks.outcome = outcome

    const { status, body } = await select(CHOICE)

    expect(status).toBe(409)
    expect(body).toEqual({ error, code })
  })

  it('answers 403 when the order stopped being a paid Complete one mid-request', async () => {
    mocks.outcome = 'not_found'

    const { status } = await select(CHOICE)

    expect(status).toBe(403)
  })

  it('answers 500 when the booking call fails', async () => {
    mocks.rpcError = { message: 'connection reset' }

    const { status, body } = await select(CHOICE)

    expect(status).toBe(500)
    expect(body.error).toBeTruthy()
  })

  it('answers 500 on an outcome it does not recognise', async () => {
    mocks.outcome = 'mystery'

    const { status } = await select(CHOICE)

    expect(status).toBe(500)
  })

  it('answers 500 when the order lookup fails', async () => {
    mocks.ordersError = { message: 'timeout' }

    const { status } = await select(CHOICE)

    expect(status).toBe(500)
    expect(mocks.rpc).not.toHaveBeenCalled()
  })
})
