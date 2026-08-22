import { beforeEach, describe, expect, it, vi } from 'vitest'

/**
 * Which email a completed checkout is filed under.
 *
 * Entitlements match `preorders.email` to the signed-in account, so this one
 * field decides whether the buyer can use what they paid for. Driven through
 * POST rather than the pure resolver (which has its own tests) because the
 * thing that can regress is the WIRING: reading `metadata.account_email` off
 * the session and writing the result onto the row.
 */

const mocks = vi.hoisted(() => ({
  constructEventAsync: vi.fn(),
  paymentIntentsUpdate: vi.fn(),
  insert: vi.fn(),
  update: vi.fn(),
  subscriptionsRetrieve: vi.fn(),
  subscriptionsUpdate: vi.fn(),
}))

vi.mock('server-only', () => ({}))

vi.mock('@/lib/commerce/stripe', () => ({
  getStripe: () => ({
    webhooks: { constructEventAsync: mocks.constructEventAsync },
    paymentIntents: { update: mocks.paymentIntentsUpdate },
    subscriptions: {
      retrieve: mocks.subscriptionsRetrieve,
      update: mocks.subscriptionsUpdate,
    },
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
        mocks.update(values)
        const builder = {
          eq: () => builder,
          neq: async () => ({ error: null }),
          select: async () => ({ data: [{ id: 'p1' }], error: null }),
        }
        return builder
      },
    }),
  }),
}))

const { POST } = await import('./route')

interface SessionOverrides {
  customerEmail?: string | null
  metadata?: Record<string, string>
}

function completedSession(over: SessionOverrides) {
  return {
    type: 'checkout.session.completed',
    data: {
      object: {
        id: 'cs_1',
        payment_status: 'paid',
        customer_details: { email: over.customerEmail, name: 'A Buyer' },
        amount_total: 29900,
        currency: 'gbp',
        // Every plan is a subscription now, so every completed session carries
        // one — and the webhook reads its period back off Stripe.
        subscription: 'sub_1',
        metadata: over.metadata ?? {},
      },
    },
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

/** The `email` written onto the preorder row by the last delivery. */
function recordedEmail(): string {
  return mocks.insert.mock.calls[0][0].email as string
}

beforeEach(() => {
  vi.clearAllMocks()
  vi.stubEnv('STRIPE_WEBHOOK_SECRET', 'whsec_test')
  vi.stubEnv('STRIPE_PRICE_SELF_STUDY', 'price_self_study')
  vi.stubEnv('STRIPE_PRICE_COMPLETE', 'price_complete')
  mocks.subscriptionsRetrieve.mockResolvedValue({
    id: 'sub_1',
    status: 'active',
    cancel_at: null,
    cancel_at_period_end: false,
    items: {
      data: [
        {
          price: { id: 'price_self_study' },
          current_period_start: 1_755_820_800, // 22 Aug 2026
          current_period_end: 1_763_769_600, // 22 Nov 2026
        },
      ],
    },
    // A subscription session has no payment_intent of its own; the id a refund
    // matches on is read off the first invoice.
    latest_invoice: {
      id: 'in_1',
      payments: { data: [{ is_default: true, payment: { payment_intent: 'pi_1' } }] },
    },
  })
  mocks.subscriptionsUpdate.mockResolvedValue({})
})

describe('checkout.session.completed — purchase email', () => {
  it('files a signed-out purchase under the address Stripe collected', async () => {
    await deliver(completedSession({ customerEmail: 'Buyer@NHS.net', metadata: { plan: 'self_study' } }))

    expect(recordedEmail()).toBe('buyer@nhs.net')
  })

  it('normalises a case-only difference silently', async () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => {})

    await deliver(
      completedSession({
        customerEmail: 'Buyer@NHS.net',
        metadata: { plan: 'self_study', account_email: 'buyer@nhs.net' },
      }),
    )

    expect(recordedEmail()).toBe('buyer@nhs.net')
    expect(error).not.toHaveBeenCalled()
    error.mockRestore()
  })

  it('files a mismatched purchase under the signed-in account, loudly', async () => {
    // The buyer paid with a different address. Recording that address would
    // strand them outside the product they just bought.
    const error = vi.spyOn(console, 'error').mockImplementation(() => {})

    const { status } = await deliver(
      completedSession({
        customerEmail: 'partner@gmail.com',
        metadata: { plan: 'self_study', account_email: 'buyer@nhs.net' },
      }),
    )

    expect(status).toBe(200)
    expect(recordedEmail()).toBe('buyer@nhs.net')
    expect(error).toHaveBeenCalledWith(
      '[stripe-webhook] checkout email differs from the signed-in account',
      expect.objectContaining({ stripeEmail: 'partner@gmail.com', recordedAs: 'buyer@nhs.net' }),
    )
    error.mockRestore()
  })

  it('records a Complete purchase with its coaching day', async () => {
    await deliver(
      completedSession({
        customerEmail: 'buyer@nhs.net',
        metadata: {
          plan: 'complete',
          coaching_day: '2026-09-12',
          account_email: 'buyer@nhs.net',
        },
      }),
    )

    expect(mocks.insert).toHaveBeenCalledWith(
      expect.objectContaining({ plan: 'complete', coaching_day: '2026-09-12', email: 'buyer@nhs.net' }),
    )
  })

  it('still rejects a session with no usable email at all', async () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => {})

    const { body } = await deliver(completedSession({ customerEmail: null, metadata: { plan: 'self_study' } }))

    expect(body.error).toBe('missing_fields')
    expect(mocks.insert).not.toHaveBeenCalled()
    error.mockRestore()
  })
})
