import { beforeEach, describe, expect, it, vi } from 'vitest'

/**
 * POST /api/checkout/release: giving a coaching slot back when the buyer
 * returns from Stripe without paying.
 *
 * The failure that matters is releasing a slot someone may still pay for, so
 * each Stripe session state is pinned, and so is the young unlinked hold whose
 * checkout may still be creating its session.
 */

const HOLD_ID = '3f2b8c1e-7d4a-4e9b-9a61-0c5d2e8f1a37'

const mocks = vi.hoisted(() => ({
  hold: null as Record<string, unknown> | null,
  lookupError: null as unknown,
  deleteError: null as unknown,
  deletedRows: [{ id: 'x' }] as Array<{ id: string }>,
  deletes: [] as Array<Array<[string, string, unknown]>>,
  retrieve: vi.fn(),
  expire: vi.fn(),
}))

vi.mock('@/lib/commerce/stripe', () => ({
  getStripe: () => ({
    checkout: { sessions: { retrieve: mocks.retrieve, expire: mocks.expire } },
  }),
}))

vi.mock('@/lib/supabase/admin', () => ({
  getSupabaseAdmin: () => ({
    from: () => ({
      select: () => ({
        eq: () => ({
          maybeSingle: async () => ({ data: mocks.hold, error: mocks.lookupError }),
        }),
      }),
      delete: () => {
        const filters: Array<[string, string, unknown]> = []
        mocks.deletes.push(filters)
        const builder = {
          eq: (column: string, value: unknown) => {
            filters.push(['eq', column, value])
            return builder
          },
          is: (column: string, value: unknown) => {
            filters.push(['is', column, value])
            return builder
          },
          lt: (column: string, value: unknown) => {
            filters.push(['lt', column, value])
            return builder
          },
          select: async () => ({ data: mocks.deletedRows, error: mocks.deleteError }),
          then: (resolve: (value: unknown) => unknown) =>
            Promise.resolve({ error: mocks.deleteError }).then(resolve),
        }
        return builder
      },
    }),
  }),
}))

const { POST } = await import('./route')

async function release(body: unknown) {
  const response = await POST(
    new Request('https://www.fourteenfisherman.com/api/checkout/release', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: typeof body === 'string' ? body : JSON.stringify(body),
    }),
  )
  return { status: response.status, body: await response.json() }
}

function linkedHold(sessionId = 'cs_1') {
  return { id: HOLD_ID, stripe_session_id: sessionId, created_at: new Date().toISOString() }
}

beforeEach(() => {
  vi.clearAllMocks()
  vi.spyOn(console, 'error').mockImplementation(() => {})
  mocks.hold = null
  mocks.lookupError = null
  mocks.deleteError = null
  mocks.deletedRows = [{ id: HOLD_ID }]
  mocks.deletes = []
  mocks.expire.mockResolvedValue({ id: 'cs_1', status: 'expired' })
})

describe('input', () => {
  it.each([
    ['no body', 'not json'],
    ['no hold id', {}],
    ['a non-uuid hold id', { holdId: 'hold-1' }],
    ['a numeric hold id', { holdId: 42 }],
  ])('answers released:false for %s, and touches nothing', async (_label, body) => {
    const { status, body: response } = await release(body)

    expect(status).toBe(200)
    expect(response).toEqual({ released: false })
    expect(mocks.retrieve).not.toHaveBeenCalled()
    expect(mocks.deletes).toHaveLength(0)
  })

  it('answers released:false for a hold that no longer exists', async () => {
    const { body } = await release({ holdId: HOLD_ID })

    expect(body).toEqual({ released: false })
    expect(mocks.deletes).toHaveLength(0)
  })
})

describe('a hold linked to a Stripe session', () => {
  it('expires an open session first, then frees the slot', async () => {
    mocks.hold = linkedHold()
    mocks.retrieve.mockResolvedValue({ id: 'cs_1', status: 'open' })

    const { status, body } = await release({ holdId: HOLD_ID })

    expect(status).toBe(200)
    expect(body).toEqual({ released: true })
    expect(mocks.expire).toHaveBeenCalledWith('cs_1')
    expect(mocks.deletes).toEqual([[['eq', 'id', HOLD_ID]]])
  })

  it('keeps the hold when Stripe will not expire the session', async () => {
    // Most likely it completed a moment ago. Freeing the slot now could sell
    // it to somebody else while this buyer's payment is being recorded.
    mocks.hold = linkedHold()
    mocks.retrieve.mockResolvedValue({ id: 'cs_1', status: 'open' })
    mocks.expire.mockRejectedValue(new Error('This Checkout Session is not open'))

    const { status, body } = await release({ holdId: HOLD_ID })

    expect(status).toBe(200)
    expect(body).toEqual({ released: false })
    expect(mocks.deletes).toHaveLength(0)
  })

  it('frees the slot of an already expired session without calling expire', async () => {
    mocks.hold = linkedHold()
    mocks.retrieve.mockResolvedValue({ id: 'cs_1', status: 'expired' })

    const { body } = await release({ holdId: HOLD_ID })

    expect(body).toEqual({ released: true })
    expect(mocks.expire).not.toHaveBeenCalled()
    expect(mocks.deletes).toHaveLength(1)
  })

  it('leaves a completed session’s hold to the webhook', async () => {
    mocks.hold = linkedHold()
    mocks.retrieve.mockResolvedValue({ id: 'cs_1', status: 'complete' })

    const { body } = await release({ holdId: HOLD_ID })

    expect(body).toEqual({ released: false })
    expect(mocks.expire).not.toHaveBeenCalled()
    expect(mocks.deletes).toHaveLength(0)
  })

  it('answers released:false, not an error, when Stripe cannot be reached', async () => {
    mocks.hold = linkedHold()
    mocks.retrieve.mockRejectedValue(new Error('ECONNRESET'))

    const { status, body } = await release({ holdId: HOLD_ID })

    expect(status).toBe(200)
    expect(body).toEqual({ released: false })
  })

  it('answers released:false when the delete fails', async () => {
    mocks.hold = linkedHold()
    mocks.retrieve.mockResolvedValue({ id: 'cs_1', status: 'expired' })
    mocks.deleteError = { message: 'timeout' }

    const { status, body } = await release({ holdId: HOLD_ID })

    expect(status).toBe(200)
    expect(body).toEqual({ released: false })
  })
})

describe('a hold with no Stripe session yet', () => {
  it('is only deleted when unlinked and older than two minutes, checked in the delete itself', async () => {
    mocks.hold = { id: HOLD_ID, stripe_session_id: null, created_at: '2026-09-13T10:00:00Z' }
    const before = Date.now()

    const { body } = await release({ holdId: HOLD_ID })

    expect(body).toEqual({ released: true })
    expect(mocks.retrieve).not.toHaveBeenCalled()
    const [filters] = mocks.deletes
    expect(filters).toContainEqual(['eq', 'id', HOLD_ID])
    expect(filters).toContainEqual(['is', 'stripe_session_id', null])
    const cutoff = filters.find(([op]) => op === 'lt')
    expect(cutoff?.[1]).toBe('created_at')
    const ageMs = before - Date.parse(cutoff?.[2] as string)
    expect(ageMs).toBeGreaterThanOrEqual(2 * 60 * 1000 - 1000)
    expect(ageMs).toBeLessThanOrEqual(2 * 60 * 1000 + 1000)
  })

  it('reports released:false when the delete matched nothing (too young, or just linked)', async () => {
    mocks.hold = { id: HOLD_ID, stripe_session_id: null, created_at: new Date().toISOString() }
    mocks.deletedRows = []

    const { body } = await release({ holdId: HOLD_ID })

    expect(body).toEqual({ released: false })
  })
})
