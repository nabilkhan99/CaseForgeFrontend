import { beforeEach, describe, expect, it, vi } from 'vitest'

/**
 * The subscription contract, now that every plan is one.
 *
 * Three things can silently cost money or access here, and each has a test:
 * 1. A fixed-term plan whose renewal is never disarmed charges £299 again in
 *    three months.
 * 2. A recorded period that never gets written leaves the entitlement guessing.
 * 3. A Customer Portal plan switch that is not followed leaves a paying
 *    Complete customer on Self-Study — the price id is the only evidence of it,
 *    because subscription events carry no session metadata.
 *
 * Driven through POST, because the routing IS the behaviour.
 */

const mocks = vi.hoisted(() => ({
  constructEventAsync: vi.fn(),
  subscriptionsRetrieve: vi.fn(),
  subscriptionsUpdate: vi.fn(),
  paymentIntentsUpdate: vi.fn(),
  insert: vi.fn(),
  updates: [] as Array<Record<string, unknown>>,
  filters: [] as Array<[string, string, unknown]>,
}))

vi.mock('server-only', () => ({}))

vi.mock('@/lib/commerce/stripe', () => ({
  getStripe: () => ({
    webhooks: { constructEventAsync: mocks.constructEventAsync },
    paymentIntents: { update: mocks.paymentIntentsUpdate },
    subscriptions: { retrieve: mocks.subscriptionsRetrieve, update: mocks.subscriptionsUpdate },
  }),
}))

vi.mock('@/lib/email/referralEmail', () => ({ sendReferralEmail: vi.fn() }))
vi.mock('@/lib/email/purchaseEmail', () => ({ sendPurchaseEmail: vi.fn(async () => ({ sent: true })) }))
vi.mock('@/lib/marketing/preorderContact', () => ({ pushPreorderContactToBrevo: vi.fn(async () => ({})) }))
vi.mock('@/lib/auth/provisionBuyer', () => ({ provisionBuyerAccount: vi.fn(async () => ({})) }))

vi.mock('@supabase/supabase-js', () => ({
  createClient: () => ({
    from: () => ({
      delete: () => ({ eq: async () => ({ error: null }) }),
      insert: (values: Record<string, unknown>) => {
        mocks.insert(values)
        return { select: () => ({ single: async () => ({ data: { id: 'p1' }, error: null }) }) }
      },
      update: (values: Record<string, unknown>) => {
        mocks.updates.push(values)
        const builder = {
          eq: (column: string, value: unknown) => {
            mocks.filters.push(['eq', column, value])
            return builder
          },
          neq: (column: string, value: unknown) => {
            mocks.filters.push(['neq', column, value])
            return Object.assign(Promise.resolve({ error: null }), builder)
          },
          select: async () => ({ data: [{ id: 'p1' }], error: null }),
        }
        return builder
      },
    }),
  }),
}))

const { POST } = await import('./route')

/** 22 Aug 2026 -> 22 Nov 2026, the worked pre-launch example. */
const PERIOD_START = Date.UTC(2026, 7, 22) / 1000
const PERIOD_END = Date.UTC(2026, 10, 22) / 1000

function subscription(over: Record<string, unknown> = {}, priceId = 'price_self_study') {
  return {
    id: 'sub_123',
    status: 'active',
    cancel_at: null,
    cancel_at_period_end: false,
    items: {
      data: [
        {
          price: { id: priceId },
          current_period_start: PERIOD_START,
          current_period_end: PERIOD_END,
        },
      ],
    },
    ...over,
  }
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

function completedSession(plan: string) {
  return {
    type: 'checkout.session.completed',
    data: {
      object: {
        id: 'cs_1',
        payment_status: 'paid',
        customer_details: { email: 'buyer@nhs.net', name: 'A Buyer' },
        amount_total: 29900,
        currency: 'gbp',
        subscription: 'sub_123',
        metadata: { plan, ...(plan === 'complete' ? { coaching_day: '2026-09-12' } : {}) },
      },
    },
  }
}

/** The single patch written onto `preorders` by the last delivery, if any. */
function lastUpdate(): Record<string, unknown> | undefined {
  return mocks.updates[mocks.updates.length - 1]
}

beforeEach(() => {
  vi.clearAllMocks()
  mocks.updates = []
  mocks.filters = []
  vi.stubEnv('STRIPE_WEBHOOK_SECRET', 'whsec_test')
  vi.stubEnv('STRIPE_PRICE_SELF_STUDY', 'price_self_study')
  vi.stubEnv('STRIPE_PRICE_SELF_STUDY_MONTHLY', 'price_self_study_monthly')
  vi.stubEnv('STRIPE_PRICE_COMPLETE', 'price_complete')
  mocks.subscriptionsRetrieve.mockResolvedValue(subscription())
  mocks.subscriptionsUpdate.mockResolvedValue({})
})

describe('checkout.session.completed — fixed-term plans', () => {
  it('disarms the renewal and records the Stripe period', async () => {
    // Stripe Checkout cannot express "nothing renews": `subscription_data` has
    // no cancel_at / cancel_at_period_end in API 2026-06-24.dahlia. If this
    // call never happens, the customer is charged £299 again in three months.
    const { status } = await deliver(completedSession('self_study'))

    expect(status).toBe(200)
    expect(mocks.subscriptionsUpdate).toHaveBeenCalledWith('sub_123', {
      cancel_at_period_end: true,
    })
    expect(lastUpdate()).toEqual({
      access_starts_at: '2026-08-22T00:00:00.000Z',
      access_ends_at: '2026-11-22T00:00:00.000Z',
    })
  })

  it('does the same for Complete', async () => {
    await deliver(completedSession('complete'))

    expect(mocks.subscriptionsUpdate).toHaveBeenCalledWith('sub_123', {
      cancel_at_period_end: true,
    })
  })

  it('leaves the rolling plan renewing', async () => {
    await deliver(completedSession('self_study_monthly'))

    expect(mocks.subscriptionsUpdate).not.toHaveBeenCalled()
    // The period is still recorded — it is the "next payment" date.
    expect(lastUpdate()).toMatchObject({ access_ends_at: '2026-11-22T00:00:00.000Z' })
  })

  it('is idempotent under a Stripe retry', async () => {
    // Already disarmed: one read, no write. `cancel_at` is the flexible-billing
    // signal; `cancel_at_period_end` is the classic one. Either counts.
    mocks.subscriptionsRetrieve.mockResolvedValue(
      subscription({ cancel_at: PERIOD_END, cancel_at_period_end: false }),
    )

    await deliver(completedSession('self_study'))

    expect(mocks.subscriptionsUpdate).not.toHaveBeenCalled()
  })

  it('reads a legacy top-level period, for an older webhook API version', async () => {
    // Webhook payloads render at the ENDPOINT's API version, which may predate
    // the move of current_period_* onto the SubscriptionItem.
    mocks.subscriptionsRetrieve.mockResolvedValue({
      id: 'sub_123',
      status: 'active',
      cancel_at: null,
      cancel_at_period_end: true,
      items: { data: [] },
      current_period_start: PERIOD_START,
      current_period_end: PERIOD_END,
    })

    await deliver(completedSession('self_study'))

    expect(lastUpdate()).toMatchObject({ access_ends_at: '2026-11-22T00:00:00.000Z' })
  })

  it('asks Stripe to retry when the renewal could not be disarmed', async () => {
    // A 500 here buys Stripe's retries. The alternative is a customer charged
    // £299 again in three months, so it is worth the noise.
    const error = vi.spyOn(console, 'error').mockImplementation(() => {})
    mocks.subscriptionsUpdate.mockRejectedValue(new Error('stripe down'))

    const { status } = await deliver(completedSession('self_study'))

    expect(status).toBe(500)
    expect(error).toHaveBeenCalledWith(
      '[stripe-webhook] CRITICAL: could not disarm renewal on a fixed-term plan',
      expect.objectContaining({ subscriptionId: 'sub_123' }),
    )
    error.mockRestore()
  })

  it('still records the order before it asks for a retry', async () => {
    // The money has already moved. Everything above the Stripe step is
    // idempotent, so the retry costs nothing and the order is never lost.
    const error = vi.spyOn(console, 'error').mockImplementation(() => {})
    mocks.subscriptionsRetrieve.mockRejectedValue(new Error('stripe down'))

    const { status } = await deliver(completedSession('self_study'))

    expect(status).toBe(500)
    expect(mocks.insert).toHaveBeenCalledWith(expect.objectContaining({ plan: 'self_study' }))
    error.mockRestore()
  })
})

describe('customer.subscription.updated', () => {
  function updated(over: Record<string, unknown> = {}, priceId = 'price_self_study') {
    return {
      type: 'customer.subscription.updated',
      data: { object: subscription(over, priceId) },
    }
  }

  it('follows a Portal plan switch by price id', async () => {
    // The Portal upgrade path. This event carries no session metadata, so the
    // price is the only evidence the customer is now on Complete — and the row
    // has to say `complete` or the entitlement fold withholds the lectures.
    await deliver(updated({ cancel_at: PERIOD_END }, 'price_complete'))

    expect(mocks.updates[0]).toMatchObject({
      plan: 'complete',
      access_ends_at: '2026-11-22T00:00:00.000Z',
    })
    expect(mocks.filters).toContainEqual(['eq', 'stripe_subscription_id', 'sub_123'])
    // A refund is a decision about the order; a late subscription event must
    // not quietly undo it.
    expect(mocks.filters).toContainEqual(['neq', 'status', 'refunded'])
  })

  it('leaves the plan alone when the price is unrecognised, loudly', async () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => {})

    await deliver(updated({ cancel_at: PERIOD_END }, 'price_someone_elses'))

    expect(mocks.updates[0]).not.toHaveProperty('plan')
    expect(error).toHaveBeenCalledWith(
      '[stripe-webhook] unknown price id on subscription — plan left unchanged',
      expect.objectContaining({ priceId: 'price_someone_elses' }),
    )
    error.mockRestore()
  })

  it('re-disarms a fixed-term subscription the customer un-cancelled', async () => {
    // Stripe's Portal shows a "don't cancel" affordance on a subscription due
    // to end, and no configuration flag hides it. "Nothing renews" is a promise
    // the pricing page makes, so we put the flag back.
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})

    await deliver(updated({ cancel_at: null, cancel_at_period_end: false }))

    expect(mocks.subscriptionsUpdate).toHaveBeenCalledWith('sub_123', {
      cancel_at_period_end: true,
    })
    warn.mockRestore()
  })

  it('does not touch a rolling subscription’s renewal', async () => {
    await deliver(updated({}, 'price_self_study_monthly'))

    expect(mocks.subscriptionsUpdate).not.toHaveBeenCalled()
    expect(mocks.updates[0]).toMatchObject({ plan: 'self_study_monthly' })
  })

  it('flips a dunning-dead subscription to canceled', async () => {
    // `unpaid` never emits `deleted`, so without this the row keeps its paid
    // status — and its entitlement — behind a card that stopped working.
    const { body } = await deliver(updated({ status: 'unpaid', cancel_at: PERIOD_END }))

    expect(mocks.updates).toContainEqual({ status: 'canceled' })
    expect(body).toEqual({ received: true, canceled: 1 })
  })

  it('flips a recovered subscription back to paid', async () => {
    const { body } = await deliver(updated({ status: 'active', cancel_at: PERIOD_END }))

    expect(mocks.updates).toContainEqual({ status: 'paid' })
    expect(body).toEqual({ received: true, recovered: 1 })
  })

  it('leaves a subscription in dunning alone', async () => {
    const { body } = await deliver(updated({ status: 'past_due', cancel_at: PERIOD_END }))

    // The period is still refreshed; only the status arm is skipped.
    expect(mocks.updates).not.toContainEqual({ status: 'canceled' })
    expect(mocks.updates).not.toContainEqual({ status: 'paid' })
    expect(body).toEqual({ received: true, ignored: 'past_due' })
  })
})

describe('invoice.paid', () => {
  it('refreshes the period on a monthly renewal', async () => {
    // The rolling plan's next-payment date has to follow Stripe, and this is
    // the event that carries a renewal.
    const { body } = await deliver({
      type: 'invoice.paid',
      data: {
        object: {
          id: 'in_1',
          billing_reason: 'subscription_cycle',
          parent: { subscription_details: { subscription: 'sub_123' } },
        },
      },
    })

    expect(mocks.subscriptionsRetrieve).toHaveBeenCalledWith('sub_123')
    expect(mocks.updates[0]).toMatchObject({ access_ends_at: '2026-11-22T00:00:00.000Z' })
    expect(body).toEqual({ received: true, refreshed: 'sub_123' })
  })

  it('reads the legacy flat subscription field too', async () => {
    // `invoice.subscription` moved to `parent.subscription_details` in dahlia,
    // but the webhook endpoint may still render the older shape.
    await deliver({
      type: 'invoice.paid',
      data: { object: { id: 'in_1', subscription: 'sub_123' } },
    })

    expect(mocks.subscriptionsRetrieve).toHaveBeenCalledWith('sub_123')
  })

  it('ignores an invoice with no subscription behind it', async () => {
    const { body } = await deliver({ type: 'invoice.paid', data: { object: { id: 'in_1' } } })

    expect(mocks.subscriptionsRetrieve).not.toHaveBeenCalled()
    expect(body).toEqual({ received: true, ignored: 'no_subscription' })
  })
})
