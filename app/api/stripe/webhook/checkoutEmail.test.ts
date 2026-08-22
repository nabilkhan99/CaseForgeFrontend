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
}))

vi.mock('server-only', () => ({}))

vi.mock('@/lib/commerce/stripe', () => ({
  getStripe: () => ({
    webhooks: { constructEventAsync: mocks.constructEventAsync },
    paymentIntents: { update: mocks.paymentIntentsUpdate },
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

  it('records an upgrade as a plain Complete purchase', async () => {
    // `complete_upgrade` never reaches the database: the row has to read
    // `complete` or the entitlement fold will not grant lectures.
    await deliver(
      completedSession({
        customerEmail: 'buyer@nhs.net',
        metadata: {
          plan: 'complete',
          upgrade_from: 'self_study',
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
