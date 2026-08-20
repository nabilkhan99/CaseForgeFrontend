import { beforeEach, describe, expect, it, vi } from 'vitest'

/**
 * `customer.subscription.updated` — the only webhook arm that can silently
 * strand a paying customer in both directions.
 *
 * Driven through POST rather than through the handler, because the arm IS the
 * routing: which status maps to which write is the thing that was wrong.
 */

const mocks = vi.hoisted(() => ({
  constructEventAsync: vi.fn(),
  update: vi.fn(),
  filters: [] as Array<[string, unknown]>,
}))

vi.mock('server-only', () => ({}))

vi.mock('@/lib/commerce/stripe', () => ({
  getStripe: () => ({ webhooks: { constructEventAsync: mocks.constructEventAsync } }),
}))

vi.mock('@/lib/email/referralEmail', () => ({ sendReferralEmail: vi.fn() }))
vi.mock('@/lib/email/purchaseEmail', () => ({ sendPurchaseEmail: vi.fn() }))
vi.mock('@/lib/marketing/preorderContact', () => ({ pushPreorderContactToBrevo: vi.fn() }))
vi.mock('@/lib/auth/provisionBuyer', () => ({ provisionBuyerAccount: vi.fn() }))

vi.mock('@supabase/supabase-js', () => ({
  createClient: () => ({
    from: () => ({
      update: (values: Record<string, unknown>) => {
        mocks.update(values)
        const builder = {
          eq: (column: string, value: unknown) => {
            mocks.filters.push([column, value])
            return builder
          },
          select: async () => ({ data: [{ id: 'p1' }], error: null }),
        }
        return builder
      },
    }),
  }),
}))

const { POST } = await import('./route')

function subscriptionUpdated(status: string) {
  return {
    type: 'customer.subscription.updated',
    data: { object: { id: 'sub_123', status } },
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

beforeEach(() => {
  vi.clearAllMocks()
  mocks.filters = []
  vi.stubEnv('STRIPE_WEBHOOK_SECRET', 'whsec_test')
})

describe('customer.subscription.updated', () => {
  it('flips a dunning-dead subscription to canceled', async () => {
    // `unpaid` never emits `deleted`, so without this the row keeps its paid
    // status — and its entitlement — behind a card that stopped working.
    const { body } = await deliver(subscriptionUpdated('unpaid'))

    expect(mocks.update).toHaveBeenCalledWith({ status: 'canceled' })
    expect(mocks.filters).toEqual([
      ['stripe_subscription_id', 'sub_123'],
      ['status', 'paid'],
    ])
    expect(body).toEqual({ received: true, canceled: 1 })
  })

  it('flips a recovered subscription back to paid', async () => {
    // `unpaid` is a dead end for us but NOT for Stripe: paying the outstanding
    // invoice revives the subscription. Nothing else in the codebase ever
    // writes `paid` back onto a row, so without this arm the customer is billed
    // monthly and locked out permanently, with no self-service way back.
    const { body } = await deliver(subscriptionUpdated('active'))

    expect(mocks.update).toHaveBeenCalledWith({ status: 'paid' })
    expect(body).toEqual({ received: true, recovered: 1 })
  })

  it('only revives rows that are actually canceled', async () => {
    // Idempotent, and it must never resurrect a refunded purchase.
    await deliver(subscriptionUpdated('trialing'))

    expect(mocks.filters).toEqual([
      ['stripe_subscription_id', 'sub_123'],
      ['status', 'canceled'],
    ])
  })

  it('leaves a subscription in dunning alone', async () => {
    // Stripe is still retrying the card; the buyer keeps access meanwhile.
    const { body } = await deliver(subscriptionUpdated('past_due'))

    expect(mocks.update).not.toHaveBeenCalled()
    expect(body).toEqual({ received: true, ignored: 'past_due' })
  })

  it('leaves an incomplete signup alone', async () => {
    const { body } = await deliver(subscriptionUpdated('incomplete'))

    expect(mocks.update).not.toHaveBeenCalled()
    expect(body).toEqual({ received: true, ignored: 'incomplete' })
  })
})
