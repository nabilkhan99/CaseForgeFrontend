import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { Entitlement } from '@/lib/commerce/entitlements'

/**
 * The commerce-correctness rules this endpoint enforces:
 *
 * 1. Each plan opens a session in the mode it is sold in: the course terms are
 *    one-off `payment` sessions, the rolling monthly is a `subscription`.
 * 2. A signed-in buyer's ACCOUNT email is what Stripe collects, because
 *    entitlements match purchases to accounts by email.
 * 3. That buyer gets ONE Stripe Customer, resolved server-side and passed as
 *    `customer:`. `customer_email` on a subscription session mints a new
 *    Customer per purchase, which splits a repeat buyer's subscriptions across
 *    two `cus_…` objects, and the Portal only ever opens on one of them.
 * 4. A Complete checkout claims its one to one coaching slot before Stripe is
 *    called, and a slot that cannot be claimed never reaches payment.
 *
 * Asserted on the params handed to `checkout.sessions.create` — no real Stripe
 * call is ever made.
 */

const mocks = vi.hoisted(() => ({
  createSession: vi.fn(),
  customersSearch: vi.fn(),
  customersCreate: vi.fn(),
  entitlement: {
    user: null as { id: string; email: string; user_metadata?: Record<string, string> } | null,
    entitlement: { state: 'none', hasLectures: false } as Entitlement,
    failedOpen: false,
  },
  /** Rows the cookie-scoped client returns for the caller's own purchases. */
  preorderRows: [] as Array<Record<string, unknown>>,
  /** What `claim_coaching_slot` answers. */
  claim: { data: [{ hold_id: 'hold-1', outcome: 'held' }] as unknown, error: null as unknown },
  rpc: vi.fn(),
  holdUpdate: vi.fn(),
  holdUpdateError: null as unknown,
  holdDelete: vi.fn(),
}))

vi.mock('server-only', () => ({}))

vi.mock('next/headers', () => ({
  cookies: async () => ({ get: () => undefined }),
}))

vi.mock('@/lib/commerce/stripe', () => ({
  getStripe: () => ({
    checkout: { sessions: { create: mocks.createSession } },
    customers: { search: mocks.customersSearch, create: mocks.customersCreate },
  }),
}))

/** The cookie-scoped Supabase client `getServerEntitlement` hands back. */
function supabaseStub() {
  return {
    from: () => ({
      select: () => ({
        ilike: () => ({
          order: async () => ({ data: mocks.preorderRows, error: null }),
        }),
      }),
    }),
  }
}

vi.mock('@/lib/commerce/serverEntitlement', () => ({
  getServerEntitlement: async () => ({ ...mocks.entitlement, supabase: supabaseStub() }),
}))

vi.mock('@/lib/supabase/admin', () => ({
  getSupabaseAdmin: () => ({
    rpc: async (name: string, params: unknown) => {
      mocks.rpc(name, params)
      return mocks.claim
    },
    from: (table: string) => {
      if (table === 'checkout_holds') {
        return {
          update: (values: unknown) => ({
            eq: async (column: string, value: unknown) => {
              mocks.holdUpdate(values, column, value)
              return { error: mocks.holdUpdateError }
            },
          }),
          delete: () => ({
            eq: async (column: string, value: unknown) => {
              mocks.holdDelete(column, value)
              return { error: null }
            },
          }),
        }
      }
      // referral_codes — no cookie is set in these tests, so this is unused.
      return { select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: null, error: null }) }) }) }
    },
  }),
}))

const { POST } = await import('./route')

async function post(body: Record<string, unknown>) {
  const response = await POST(
    new Request('https://www.fourteenfisherman.com/api/checkout', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }),
  )
  return { status: response.status, body: await response.json() }
}

function signedInAs(email: string, entitlement: Partial<Entitlement> = {}) {
  mocks.entitlement.user = { id: 'user-1', email, user_metadata: { full_name: 'A Buyer' } }
  mocks.entitlement.entitlement = { state: 'active', hasLectures: false, ...entitlement }
}

/** The params the route handed to `checkout.sessions.create`. */
function sessionParams(): Record<string, never> & Record<string, unknown> {
  return mocks.createSession.mock.calls[0][0]
}

beforeEach(() => {
  vi.clearAllMocks()
  mocks.entitlement = {
    user: null,
    entitlement: { state: 'none', hasLectures: false },
    failedOpen: false,
  }
  mocks.preorderRows = []
  mocks.claim = { data: [{ hold_id: 'hold-1', outcome: 'held' }], error: null }
  mocks.holdUpdateError = null
  mocks.createSession.mockResolvedValue({ id: 'cs_test_1', url: 'https://checkout.stripe.com/c/cs_test_1' })
  mocks.customersSearch.mockResolvedValue({ data: [] })
  mocks.customersCreate.mockResolvedValue({ id: 'cus_new' })
  vi.stubEnv('STRIPE_PRICE_SELF_STUDY', 'price_self_study')
  vi.stubEnv('STRIPE_PRICE_SELF_STUDY_MONTHLY', 'price_self_study_monthly')
  vi.stubEnv('STRIPE_PRICE_COMPLETE', 'price_complete')
})

describe('checkout mode per plan', () => {
  it.each([
    ['self_study', 'price_self_study', 'payment'],
    ['complete', 'price_complete', 'payment'],
    ['self_study_monthly', 'price_self_study_monthly', 'subscription'],
  ])('opens a session for %s in the mode that plan is sold in', async (plan, price, mode) => {
    // The course terms are one-off sales; only the rolling plan is a
    // subscription. The mode is what Stripe's own page reads from, so getting
    // it wrong tells the buyer their course renews.
    const { status } = await post({ plan, coachingDate: '2026-11-07', coachingSlot: 'morning' })

    expect(status).toBe(200)
    const params = sessionParams()
    expect(params.mode).toBe(mode)
    expect(params.line_items).toEqual([{ price, quantity: 1 }])
    if (mode === 'subscription') {
      expect(params.payment_intent_data).toBeUndefined()
    } else {
      expect(params.subscription_data).toBeUndefined()
    }
  })

  it('repeats the metadata onto the PaymentIntent for a one-off course sale', async () => {
    // A refund arrives as `charge.refunded`, carrying the PaymentIntent and
    // nothing of the session — so the order has to be identifiable from there.
    signedInAs('buyer@nhs.net')

    await post({ plan: 'self_study' })

    const params = sessionParams()
    const paymentData = params.payment_intent_data as {
      metadata: Record<string, string>
      description: string
    }
    expect(paymentData.metadata).toMatchObject({
      plan: 'self_study',
      account_email: 'buyer@nhs.net',
      supabase_user_id: 'user-1',
    })
    expect(paymentData.description).toContain('Self-Study')
  })

  it('repeats the metadata onto the subscription for the rolling plan', async () => {
    // Renewals and cancellations all arrive with the SUBSCRIPTION, carrying
    // neither session metadata nor client_reference_id.
    signedInAs('buyer@nhs.net')

    await post({ plan: 'self_study_monthly' })

    const params = sessionParams()
    const subscriptionData = params.subscription_data as {
      metadata: Record<string, string>
      description: string
    }
    expect(subscriptionData.metadata).toMatchObject({
      plan: 'self_study_monthly',
      account_email: 'buyer@nhs.net',
      supabase_user_id: 'user-1',
    })
    expect(subscriptionData.description).toContain('Self-Study')
  })

  it('refuses Intensive, which is sold on a call', async () => {
    const { status } = await post({ plan: 'intensive' })

    expect(status).toBe(400)
    expect(mocks.createSession).not.toHaveBeenCalled()
  })

  it('refuses the retired complete_upgrade pseudo-plan', async () => {
    // It is not a plan any more: the upgrade is a Stripe Portal plan switch.
    signedInAs('buyer@nhs.net', { plan: 'self_study' })

    const { status } = await post({
      plan: 'complete_upgrade',
      coachingDate: '2026-11-07',
      coachingSlot: 'morning',
    })

    expect(status).toBe(400)
    expect(mocks.createSession).not.toHaveBeenCalled()
  })
})

describe('linking a purchase to the buyer’s account', () => {
  it('passes a resolved customer, never customer_email', async () => {
    // Without this, a buyer who types a different address on Stripe's page buys
    // access that attaches to no account — and, in subscription mode, gets a
    // second Customer object into the bargain.
    signedInAs('Buyer@NHS.net', { plan: 'self_study' })

    const { status } = await post({ plan: 'self_study' })

    expect(status).toBe(200)
    const params = sessionParams()
    expect(params.customer).toBe('cus_new')
    expect(params.customer_email).toBeUndefined()
    expect(params.customer_update).toEqual({ name: 'auto', address: 'auto' })
    expect(params.client_reference_id).toBe('user-1')
    expect((params.metadata as Record<string, string>).account_email).toBe('buyer@nhs.net')
  })

  it('reuses the customer id already recorded against the account', async () => {
    // Cheapest and most exact answer, and it survives an email change at Stripe.
    signedInAs('buyer@nhs.net')
    mocks.preorderRows = [
      { stripe_customer_id: null, created_at: '2026-08-01T00:00:00Z' },
      { stripe_customer_id: 'cus_known', created_at: '2026-07-01T00:00:00Z' },
    ]

    await post({ plan: 'self_study' })

    expect(sessionParams().customer).toBe('cus_known')
    expect(mocks.customersSearch).not.toHaveBeenCalled()
    expect(mocks.customersCreate).not.toHaveBeenCalled()
  })

  it('falls back to a Stripe search before creating a customer', async () => {
    // Rescues hand-created customers (Payment Link, manual invoice) and rows
    // that predate stripe_customer_id.
    signedInAs('buyer@nhs.net')
    mocks.customersSearch.mockResolvedValue({ data: [{ id: 'cus_found' }] })

    await post({ plan: 'self_study' })

    expect(sessionParams().customer).toBe('cus_found')
    expect(mocks.customersCreate).not.toHaveBeenCalled()
  })

  it('stamps the account on a newly created customer', async () => {
    signedInAs('buyer@nhs.net')

    await post({ plan: 'self_study' })

    expect(mocks.customersCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        email: 'buyer@nhs.net',
        name: 'A Buyer',
        metadata: { account_email: 'buyer@nhs.net', supabase_user_id: 'user-1' },
      }),
    )
  })

  it('changes nothing for a signed-out buyer', async () => {
    // Nobody to attach to, so Checkout creates the Customer from what they type.
    const { status } = await post({ plan: 'self_study' })

    expect(status).toBe(200)
    const params = sessionParams()
    expect(params.customer).toBeUndefined()
    expect(params.customer_email).toBeUndefined()
    expect(params.client_reference_id).toBeUndefined()
    expect(mocks.customersCreate).not.toHaveBeenCalled()
  })
})

const COMPLETE_BODY = { plan: 'complete', coachingDate: '2026-11-07', coachingSlot: 'morning' }

describe('a Complete checkout and its coaching session', () => {
  it.each([
    ['no date or slot', { plan: 'complete' }],
    ['no slot', { plan: 'complete', coachingDate: '2026-11-07' }],
    ['no date', { plan: 'complete', coachingSlot: 'morning' }],
    ['an impossible date', { plan: 'complete', coachingDate: '2026-02-30', coachingSlot: 'morning' }],
    ['an unknown slot', { plan: 'complete', coachingDate: '2026-11-07', coachingSlot: 'evening' }],
  ])('is refused with %s, before anything is claimed', async (_label, body) => {
    const { status, body: response } = await post(body)

    expect(status).toBe(400)
    expect(response.error).toBe('Please choose a date and time for your coaching session.')
    expect(mocks.rpc).not.toHaveBeenCalled()
    expect(mocks.createSession).not.toHaveBeenCalled()
  })

  it('claims the slot before creating the Stripe session', async () => {
    const order: string[] = []
    mocks.rpc.mockImplementation(() => order.push('claim'))
    mocks.createSession.mockImplementation(async () => {
      order.push('stripe')
      return { id: 'cs_test_1', url: 'https://checkout.stripe.com/c/cs_test_1' }
    })

    const { status } = await post(COMPLETE_BODY)

    expect(status).toBe(200)
    expect(order).toEqual(['claim', 'stripe'])
    expect(mocks.rpc).toHaveBeenCalledWith(
      'claim_coaching_slot',
      expect.objectContaining({ p_day: '2026-11-07', p_slot: 'morning' }),
    )
  })

  it('holds the slot 10 minutes longer than the session it guards', async () => {
    const before = Date.now()
    await post(COMPLETE_BODY)

    const sessionExpiresMs = (sessionParams().expires_at as number) * 1000
    const holdExpiresMs = Date.parse(
      (mocks.rpc.mock.calls[0][1] as { p_expires_at: string }).p_expires_at,
    )
    // Never under Stripe's 30 minute floor, with a little room for the round trip.
    expect(sessionExpiresMs - before).toBeGreaterThanOrEqual(30 * 60 * 1000)
    expect(sessionExpiresMs - before).toBeLessThanOrEqual(32 * 60 * 1000)
    expect(holdExpiresMs - sessionExpiresMs).toBeGreaterThanOrEqual(10 * 60 * 1000)
    expect(holdExpiresMs - sessionExpiresMs).toBeLessThanOrEqual(10 * 60 * 1000 + 1000)
  })

  it('links the hold to the session and returns the url', async () => {
    const { status, body } = await post(COMPLETE_BODY)

    expect(status).toBe(200)
    expect(body).toEqual({ url: 'https://checkout.stripe.com/c/cs_test_1' })
    expect(mocks.holdUpdate).toHaveBeenCalledWith({ stripe_session_id: 'cs_test_1' }, 'id', 'hold-1')
    expect(mocks.holdDelete).not.toHaveBeenCalled()
  })

  it('carries the date, slot and label in the metadata, in both places', async () => {
    await post(COMPLETE_BODY)

    const expected = {
      plan: 'complete',
      coaching_date: '2026-11-07',
      coaching_slot: 'morning',
      coaching_session_label: 'Saturday 7 November 2026, 09:00 to 12:00',
    }
    const params = sessionParams()
    expect(params.metadata).toMatchObject(expected)
    expect((params.payment_intent_data as { metadata: unknown }).metadata).toMatchObject(expected)
    expect(params.metadata).not.toHaveProperty('coaching_day')
    expect(params.metadata).not.toHaveProperty('coaching_day_label')
  })

  it('shows the slot on Stripe’s page and on Stripe’s receipt before payment', async () => {
    await post(COMPLETE_BODY)

    const params = sessionParams()
    expect((params.custom_text as { submit: { message: string } }).submit.message).toBe(
      "Coaching session: Saturday 7 November, 09:00 to 12:00. After payment we'll email you a link to set your password. That's how you get into the course.",
    )
    expect((params.payment_intent_data as { description: string }).description).toBe(
      'The Complete SCA Course. Coaching session: Saturday 7 November, 09:00 to 12:00',
    )
  })

  it('sends a cancelled buyer back to the booking page with the hold to release', async () => {
    await post(COMPLETE_BODY)

    expect(sessionParams().cancel_url).toBe(
      'https://www.fourteenfisherman.com/coaching-session?release=hold-1',
    )
  })

  it('answers 409 slot_taken when the slot has gone, and never reaches Stripe', async () => {
    mocks.claim = { data: [{ hold_id: null, outcome: 'taken' }], error: null }

    const { status, body } = await post(COMPLETE_BODY)

    expect(status).toBe(409)
    expect(body).toEqual({
      error: 'That slot has just been booked. Please choose another.',
      code: 'slot_taken',
    })
    expect(mocks.createSession).not.toHaveBeenCalled()
  })

  it('answers 409 slot_closed when bookings for the date have closed', async () => {
    mocks.claim = { data: [{ hold_id: null, outcome: 'closed' }], error: null }

    const { status, body } = await post(COMPLETE_BODY)

    expect(status).toBe(409)
    expect(body).toEqual({
      error: 'Bookings for that date have closed. Please choose another.',
      code: 'slot_closed',
    })
    expect(mocks.createSession).not.toHaveBeenCalled()
  })

  it('blocks checkout when the claim itself fails', async () => {
    // With one booking per slot a hold cannot be best-effort any more: going
    // on to Stripe without one is how two buyers pay for the same slot.
    vi.spyOn(console, 'error').mockImplementation(() => {})
    mocks.claim = { data: null, error: { message: 'connection reset' } }

    const { status } = await post(COMPLETE_BODY)

    expect(status).toBe(500)
    expect(mocks.createSession).not.toHaveBeenCalled()
  })

  it('gives the slot back when Stripe will not create the session', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    mocks.createSession.mockRejectedValue(new Error('Stripe is down'))

    const { status } = await post(COMPLETE_BODY)

    expect(status).toBe(500)
    expect(mocks.holdDelete).toHaveBeenCalledWith('id', 'hold-1')
  })

  it('still returns the url when the hold cannot be linked to the session', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    mocks.holdUpdateError = { message: 'timeout' }

    const { status, body } = await post(COMPLETE_BODY)

    expect(status).toBe(200)
    expect(body.url).toBe('https://checkout.stripe.com/c/cs_test_1')
    expect(mocks.holdDelete).not.toHaveBeenCalled()
  })
})

describe('a Self-Study checkout', () => {
  it('claims nothing, keeps the pricing cancel url and the plain submit message', async () => {
    await post({ plan: 'self_study' })

    const params = sessionParams()
    expect(mocks.rpc).not.toHaveBeenCalled()
    // Nothing is held, so the session keeps Stripe's default lifetime.
    expect(params.expires_at).toBeUndefined()
    expect(params.cancel_url).toBe('https://www.fourteenfisherman.com/#pricing')
    expect((params.custom_text as { submit: { message: string } }).submit.message).toBe(
      "After payment we'll email you a link to set your password. That's how you get into the course.",
    )
    expect((params.payment_intent_data as { description: string }).description).toBe(
      'Fourteen Fisherman, Self-Study',
    )
  })
})
