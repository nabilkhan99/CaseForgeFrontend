import { beforeEach, describe, expect, it, vi } from 'vitest'

/**
 * What the webhook actually delivers when a payment clears.
 *
 * Driven through POST, because the thing that can regress is the WIRING: which
 * Stripe field becomes which receipt token, and what happens when a receipt
 * cannot be produced at all. `provisionBuyerAccount` is stubbed to invoke its
 * `deliver` callback immediately — its own locking is covered in
 * lib/auth/provisionBuyer.test.ts, and what is under test here is the callback.
 */

const mocks = vi.hoisted(() => ({
  constructEventAsync: vi.fn(),
  paymentIntentsUpdate: vi.fn(),
  subscriptionsRetrieve: vi.fn(),
  subscriptionsUpdate: vi.fn(),
  issueReceipt: vi.fn(),
  sendReceiptEmail: vi.fn(),
  sendSetPasswordEmail: vi.fn(),
  provisionBuyerAccount: vi.fn(),
  rpc: vi.fn(),
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
vi.mock('@/lib/marketing/preorderContact', () => ({ pushPreorderContactToBrevo: vi.fn(async () => ({})) }))
vi.mock('@/lib/receipts/issueReceipt', () => ({ issueReceipt: mocks.issueReceipt }))
vi.mock('@/lib/email/receiptEmail', () => ({ sendReceiptEmail: mocks.sendReceiptEmail }))
vi.mock('@/lib/email/accountEmail', () => ({ sendSetPasswordEmail: mocks.sendSetPasswordEmail }))

// Run the callback the webhook hands in, which is the code under test.
vi.mock('@/lib/auth/provisionBuyer', () => ({
  provisionBuyerAccount: async (
    _supabase: unknown,
    args: { deliver: (a: { setupUrl: string | null }) => Promise<unknown> },
  ) => {
    mocks.provisionBuyerAccount(args)
    await args.deliver({ setupUrl: SETUP_URL })
  },
}))

vi.mock('@supabase/supabase-js', () => ({
  createClient: () => ({
    rpc: mocks.rpc,
    from: () => ({
      delete: () => ({ eq: async () => ({ error: null }) }),
      insert: () => ({ select: () => ({ single: async () => ({ data: { id: 'p1' }, error: null }) }) }),
      update: () => {
        const b = { eq: () => b, neq: async () => ({ error: null }), select: async () => ({ data: [], error: null }) }
        return b
      },
      select: () => {
        const b = { eq: () => b, neq: () => b, maybeSingle: async () => ({ data: null, error: null }) }
        return b
      },
    }),
  }),
}))

const SETUP_URL = 'https://www.fourteenfisherman.com/auth/set-password?token_hash=tok&email=b%40x.com'

const { POST } = await import('./route')

/** 27 August 2026, 10:30 UTC — the event's own timestamp. */
const EVENT_CREATED = 1787826600

function checkoutSession(overrides: Record<string, unknown> = {}) {
  return {
    type: 'checkout.session.completed',
    created: EVENT_CREATED,
    data: {
      object: {
        id: 'cs_test_123',
        payment_status: 'paid',
        amount_total: 59900,
        currency: 'gbp',
        payment_method_types: ['card'],
        customer_details: { email: 'buyer@x.com', name: 'Jane Okonkwo' },
        metadata: {
          plan: 'complete',
          coaching_day: '2026-09-12',
          coaching_day_label: 'Saturday 12 September 2026',
        },
        ...overrides,
      },
    },
  }
}

async function deliver(event: unknown) {
  mocks.constructEventAsync.mockResolvedValue(event)
  return POST(
    new Request('https://www.fourteenfisherman.com/api/stripe/webhook', {
      method: 'POST',
      headers: { 'stripe-signature': 'sig' },
      body: '{}',
    }),
  )
}

beforeEach(() => {
  vi.clearAllMocks()
  vi.spyOn(console, 'error').mockImplementation(() => {})
  vi.stubEnv('STRIPE_WEBHOOK_SECRET', 'whsec_test')
  mocks.issueReceipt.mockResolvedValue({
    receiptNumber: 'FF-26-4478',
    pdf: Buffer.from('%PDF'),
    fileName: 'Fourteen-Fisherman-receipt-FF-26-4478.pdf',
    periodEnd: null,
    content: {},
  })
  mocks.sendReceiptEmail.mockResolvedValue({ sent: true })
  mocks.sendSetPasswordEmail.mockResolvedValue({ sent: true })
})

describe('a completed checkout issues and sends a receipt', () => {
  it('keys the receipt on the checkout session id', async () => {
    // The idempotency key. Same session, same number, however many times
    // Stripe redelivers this event.
    await deliver(checkoutSession())

    expect(mocks.issueReceipt.mock.calls[0][1]).toMatchObject({
      stripeEventKey: 'cs_test_123',
      preorderId: 'p1',
      email: 'buyer@x.com',
      customerName: 'Jane Okonkwo',
      planKey: 'complete',
      amountPence: 59900,
      kind: 'purchase',
    })
  })

  it("dates the payment from the EVENT's timestamp, not from now", async () => {
    // Stable across Stripe's retries: a redelivery three days later must not
    // re-date the receipt. `session.created` would be when the customer opened
    // Checkout, which can be a different day again.
    await deliver(checkoutSession())

    expect(mocks.issueReceipt.mock.calls[0][1].paidAt).toEqual(new Date(EVENT_CREATED * 1000))
  })

  it('keeps the coaching day out of the payment date', async () => {
    const args = (await deliver(checkoutSession()), mocks.issueReceipt.mock.calls[0][1])

    expect(args.coachingDayLabel).toBe('Saturday 12 September 2026')
    expect(args.paidAt).not.toEqual(new Date('2026-09-12'))
  })

  it('reads the payment method off the session', async () => {
    await deliver(checkoutSession({ payment_method_types: ['customer_balance'] }))
    expect(mocks.issueReceipt.mock.calls[0][1].paymentMethod).toBe('Bank transfer')
  })

  it('emails the PDF with the setup link as the action', async () => {
    await deliver(checkoutSession())

    expect(mocks.sendReceiptEmail).toHaveBeenCalledWith(
      expect.objectContaining({
        toEmail: 'buyer@x.com',
        planKey: 'complete',
        sessionDate: 'Saturday 12 September 2026',
        setupUrl: SETUP_URL,
        hasSetupLink: true,
        fileName: 'Fourteen-Fisherman-receipt-FF-26-4478.pdf',
      }),
    )
  })

  it('sends no separate purchase-confirmation email any more', async () => {
    // One mail, not two. The account email is now only a fallback.
    await deliver(checkoutSession())

    expect(mocks.sendReceiptEmail).toHaveBeenCalledTimes(1)
    expect(mocks.sendSetPasswordEmail).not.toHaveBeenCalled()
  })
})

describe('when no receipt can be produced', () => {
  it('still gets the buyer into their account', async () => {
    // The failure this defends against is deploying ahead of the migration:
    // `issue_receipt` would not exist and EVERY buyer would get a null receipt.
    // Sending nothing would strand a paying customer with no account at all,
    // which is worse than the two-email flow this replaced.
    mocks.issueReceipt.mockResolvedValue(null)

    await deliver(checkoutSession())

    expect(mocks.sendReceiptEmail).not.toHaveBeenCalled()
    expect(mocks.sendSetPasswordEmail).toHaveBeenCalledWith({
      toEmail: 'buyer@x.com',
      toName: 'Jane Okonkwo',
      setPasswordUrl: SETUP_URL,
    })
  })

  it('says loudly that the buyer is owed a receipt', async () => {
    mocks.issueReceipt.mockResolvedValue(null)
    const error = vi.spyOn(console, 'error').mockImplementation(() => {})

    await deliver(checkoutSession())

    expect(error.mock.calls.flat().join(' ')).toContain('owed one')
  })

  it('falls back for a plan with no receipt template, rather than sending nothing', async () => {
    // Unreachable today — /api/checkout rejects a non-checkout plan — but a
    // buyer must never be left with neither a receipt nor an account.
    await deliver(checkoutSession({ metadata: { plan: 'intensive' } }))

    expect(mocks.issueReceipt).not.toHaveBeenCalled()
    expect(mocks.sendSetPasswordEmail).toHaveBeenCalled()
  })
})

describe('the monthly plan needs its billing period before the receipt renders', () => {
  it('passes the period Stripe reported into the receipt', async () => {
    mocks.subscriptionsRetrieve.mockResolvedValue({
      id: 'sub_1',
      status: 'active',
      cancel_at: null,
      cancel_at_period_end: false,
      items: {
        data: [
          {
            current_period_start: 1787826600, // 27 Aug 2026
            current_period_end: 1790418600, // 26 Sep 2026
            price: { id: 'price_monthly', unit_amount: 12900 },
          },
        ],
      },
      latest_invoice: { status: 'paid', payments: { data: [] } },
    })

    await deliver(
      checkoutSession({
        subscription: 'sub_1',
        amount_total: 12900,
        metadata: { plan: 'self_study_monthly' },
      }),
    )

    const args = mocks.issueReceipt.mock.calls[0][1]
    expect(args.planKey).toBe('self_study_monthly')
    expect(args.periodStart).toEqual(new Date(1787826600 * 1000))
    expect(args.periodEnd).toEqual(new Date(1790418600 * 1000))
  })

  it('does not email at all when the subscription could not be finalised', async () => {
    // The period is unknown, so the receipt would print "Billing period [start
    // date] to [end date]". Better to 500 and let Stripe retry: everything
    // before this point is idempotent and replays for free.
    mocks.subscriptionsRetrieve.mockRejectedValue(new Error('stripe down'))

    const response = await deliver(
      checkoutSession({ subscription: 'sub_1', metadata: { plan: 'self_study_monthly' } }),
    )

    expect(response.status).toBe(500)
    expect(mocks.issueReceipt).not.toHaveBeenCalled()
    expect(mocks.sendReceiptEmail).not.toHaveBeenCalled()
  })
})
