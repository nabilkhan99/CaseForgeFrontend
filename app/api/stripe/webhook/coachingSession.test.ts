import { beforeEach, describe, expect, it, vi } from 'vitest'

/**
 * The webhook's half of one to one coaching slots.
 *
 * A slot takes one booking. Checkout holds it while the buyer pays; this is
 * where the hold turns into a booking (a paid order) or is given back (the
 * session expired, or its delayed payment failed). The things pinned hardest:
 * the paid order is written BEFORE the hold is deleted, so the slot is never
 * free between the two, and a paying customer is recorded even if the slot was
 * somehow sold twice.
 */

const mocks = vi.hoisted(() => ({
  constructEventAsync: vi.fn(),
  /** Every write, in order, as "table:operation". */
  writes: [] as string[],
  insert: vi.fn(),
  holdDeletes: [] as Array<[string, unknown]>,
  holdDeleteError: null as unknown,
  insertError: null as unknown,
  /** Paid Complete orders already on the date, for the double-booking check. */
  sameDayOrders: [] as Array<Record<string, unknown>>,
}))

vi.mock('server-only', () => ({}))

vi.mock('@/lib/commerce/stripe', () => ({
  getStripe: () => ({
    webhooks: { constructEventAsync: mocks.constructEventAsync },
    paymentIntents: { update: vi.fn(async () => ({})) },
    subscriptions: { retrieve: vi.fn(), update: vi.fn() },
  }),
}))

vi.mock('@/lib/email/referralEmail', () => ({ sendReferralEmail: vi.fn() }))
vi.mock('@/lib/email/receiptEmail', () => ({ sendReceiptEmail: vi.fn(async () => ({ sent: true })) }))
vi.mock('@/lib/receipts/issueReceipt', () => ({ issueReceipt: vi.fn(async () => null) }))
vi.mock('@/lib/marketing/preorderContact', () => ({ pushPreorderContactToBrevo: vi.fn(async () => ({})) }))
vi.mock('@/lib/auth/provisionBuyer', () => ({ provisionBuyerAccount: vi.fn(async () => ({})) }))

vi.mock('@supabase/supabase-js', () => ({
  createClient: () => ({
    from: (table: string) => ({
      delete: () => ({
        eq: async (column: string, value: unknown) => {
          mocks.writes.push(`${table}:delete`)
          if (table === 'checkout_holds') mocks.holdDeletes.push([column, value])
          return { error: mocks.holdDeleteError }
        },
      }),
      insert: (values: Record<string, unknown>) => {
        mocks.writes.push(`${table}:insert`)
        mocks.insert(values)
        return {
          select: () => ({
            single: async () =>
              mocks.insertError
                ? { data: null, error: mocks.insertError }
                : { data: { id: 'p1' }, error: null },
          }),
        }
      },
      select: () => {
        const builder = {
          eq: () => builder,
          maybeSingle: async () => ({ data: { id: 'p1' }, error: null }),
          then: (resolve: (value: unknown) => unknown) =>
            Promise.resolve({ data: mocks.sameDayOrders, error: null }).then(resolve),
        }
        return builder
      },
    }),
  }),
}))

const { POST } = await import('./route')

function completed(metadata: Record<string, string>, over: Record<string, unknown> = {}) {
  return {
    type: 'checkout.session.completed',
    created: 1787826600,
    data: {
      object: {
        id: 'cs_1',
        payment_status: 'paid',
        customer_details: { email: 'buyer@nhs.net', name: 'A Buyer' },
        amount_total: 59900,
        currency: 'gbp',
        payment_intent: 'pi_1',
        subscription: null,
        metadata,
        ...over,
      },
    },
  }
}

const COMPLETE_METADATA = {
  plan: 'complete',
  coaching_date: '2026-11-07',
  coaching_slot: 'morning',
  coaching_session_label: 'Saturday 7 November 2026, 09:00 to 12:00',
}

function sessionEvent(type: string) {
  return { type, created: 1787826600, data: { object: { id: 'cs_gone', payment_status: 'unpaid' } } }
}

async function deliver(event: unknown) {
  mocks.constructEventAsync.mockResolvedValue(event)
  const response = await POST(
    new Request('https://www.fourteenfisherman.com/api/stripe/webhook', {
      method: 'POST',
      headers: { 'stripe-signature': 'sig' },
      body: '{}',
    }),
  )
  return { status: response.status, body: await response.json() }
}

beforeEach(() => {
  vi.clearAllMocks()
  vi.stubEnv('STRIPE_WEBHOOK_SECRET', 'whsec_test')
  mocks.writes = []
  mocks.holdDeletes = []
  mocks.holdDeleteError = null
  mocks.insertError = null
  mocks.sameDayOrders = []
})

describe('checkout.session.completed books the slot', () => {
  it('writes the order with its date and slot, and only then deletes the hold', async () => {
    const { status } = await deliver(completed(COMPLETE_METADATA))

    expect(status).toBe(200)
    expect(mocks.insert).toHaveBeenCalledWith(
      expect.objectContaining({ plan: 'complete', coaching_day: '2026-11-07', coaching_slot: 'morning' }),
    )
    expect(mocks.writes.slice(0, 2)).toEqual(['preorders:insert', 'checkout_holds:delete'])
    expect(mocks.holdDeletes).toEqual([['stripe_session_id', 'cs_1']])
  })

  it('keeps the hold when the order could not be written, so Stripe’s retry still owns the slot', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    mocks.insertError = { code: '08006', message: 'connection failure' }

    const { status } = await deliver(completed(COMPLETE_METADATA))

    expect(status).toBe(500)
    expect(mocks.holdDeletes).toHaveLength(0)
  })

  it('still retires the hold on a retry that finds the order already recorded', async () => {
    mocks.insertError = { code: '23505', message: 'duplicate key' }

    const { status } = await deliver(completed(COMPLETE_METADATA))

    expect(status).toBe(200)
    expect(mocks.holdDeletes).toEqual([['stripe_session_id', 'cs_1']])
  })

  it('records a session opened by the previous deploy under its date, with no slot', async () => {
    await deliver(
      completed({
        plan: 'complete',
        coaching_day: '2026-09-12',
        coaching_day_label: 'Saturday 12 September 2026',
      }),
    )

    expect(mocks.insert).toHaveBeenCalledWith(
      expect.objectContaining({ coaching_day: '2026-09-12', coaching_slot: null }),
    )
  })

  it('never writes an unknown slot value', async () => {
    await deliver(completed({ ...COMPLETE_METADATA, coaching_slot: 'evening' }))

    expect(mocks.insert).toHaveBeenCalledWith(
      expect.objectContaining({ coaching_day: '2026-11-07', coaching_slot: null }),
    )
  })

  it('writes no slot on a Self-Study order', async () => {
    await deliver(completed({ plan: 'self_study' }, { amount_total: 29900 }))

    expect(mocks.insert).toHaveBeenCalledWith(
      expect.objectContaining({ plan: 'self_study', coaching_day: null, coaching_slot: null }),
    )
  })

  it('records a second paid booking on the same slot anyway, and says so loudly', async () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => {})
    mocks.sameDayOrders = [
      { id: 'p0', email: 'first@nhs.net', coaching_slot: 'morning', stripe_session_id: 'cs_0' },
    ]

    const { status } = await deliver(completed(COMPLETE_METADATA))

    expect(status).toBe(200)
    expect(mocks.insert).toHaveBeenCalled()
    expect(error).toHaveBeenCalledWith(
      '[stripe-webhook] CRITICAL: coaching slot booked twice, the order was recorded anyway',
      expect.objectContaining({ sessionId: 'cs_1', date: '2026-11-07', slot: 'morning' }),
    )
  })

  it('counts a hand-entered booking with no session id, and a legacy whole-date booking', async () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => {})
    mocks.sameDayOrders = [
      { id: 'p-hand', email: 'comp@nhs.net', coaching_slot: 'morning', stripe_session_id: null },
      { id: 'p-legacy', email: 'old@nhs.net', coaching_slot: null, stripe_session_id: 'cs_old' },
    ]

    await deliver(completed(COMPLETE_METADATA))

    const [, details] = error.mock.calls.find(([message]) =>
      String(message).includes('booked twice'),
    ) as [string, { otherOrders: Array<{ id: string }> }]
    expect(details.otherOrders.map((o) => o.id)).toEqual(['p-hand', 'p-legacy'])
  })

  it('does not flag the other slot on the same date, or the order itself', async () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => {})
    mocks.sameDayOrders = [
      { id: 'p-afternoon', email: 'pm@nhs.net', coaching_slot: 'afternoon', stripe_session_id: 'cs_9' },
      { id: 'p1', email: 'buyer@nhs.net', coaching_slot: 'morning', stripe_session_id: 'cs_1' },
    ]

    await deliver(completed(COMPLETE_METADATA))

    expect(error).not.toHaveBeenCalledWith(
      '[stripe-webhook] CRITICAL: coaching slot booked twice, the order was recorded anyway',
      expect.anything(),
    )
  })

  it('leaves an unpaid completed session deferred: no order, and the hold untouched', async () => {
    const { body } = await deliver(completed(COMPLETE_METADATA, { payment_status: 'unpaid' }))

    expect(body).toEqual({ received: true, deferred: 'cs_1' })
    expect(mocks.insert).not.toHaveBeenCalled()
    expect(mocks.holdDeletes).toHaveLength(0)
  })
})

describe.each(['checkout.session.expired', 'checkout.session.async_payment_failed'])(
  '%s gives the slot back',
  (type) => {
    it('deletes the hold behind that session and acknowledges', async () => {
      const { status, body } = await deliver(sessionEvent(type))

      expect(status).toBe(200)
      expect(body).toEqual({ received: true })
      expect(mocks.holdDeletes).toEqual([['stripe_session_id', 'cs_gone']])
      expect(mocks.insert).not.toHaveBeenCalled()
    })

    it('asks Stripe to retry when the hold could not be deleted', async () => {
      vi.spyOn(console, 'error').mockImplementation(() => {})
      mocks.holdDeleteError = { message: 'timeout' }

      const { status } = await deliver(sessionEvent(type))

      expect(status).toBe(500)
    })
  },
)
