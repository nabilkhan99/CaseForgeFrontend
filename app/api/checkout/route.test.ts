import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { Entitlement } from '@/lib/commerce/entitlements'

/**
 * The commerce-correctness rules this endpoint enforces:
 *
 * 1. Every plan opens a `mode: 'subscription'` session — Self-Study and
 *    Complete included, since they became fixed-term subscriptions.
 * 2. A signed-in buyer's ACCOUNT email is what Stripe collects, because
 *    entitlements match purchases to accounts by email.
 * 3. That buyer gets ONE Stripe Customer, resolved server-side and passed as
 *    `customer:`. `customer_email` on a subscription session mints a new
 *    Customer per purchase, which splits a repeat buyer's subscriptions across
 *    two `cus_…` objects — the Portal only ever opens on one of them.
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
  coachingDay: {
    day: '2026-09-12',
    label: 'Saturday 12 September 2026',
    capacity: 6,
    places_left: 4,
    cutoff_at: '2026-09-11T23:00:00Z',
    status: 'open',
  } as Record<string, unknown> | null,
  holdInsert: vi.fn(),
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
    from: (table: string) => {
      if (table === 'coaching_day_availability') {
        return {
          select: () => ({
            eq: () => ({ maybeSingle: async () => ({ data: mocks.coachingDay, error: null }) }),
          }),
        }
      }
      if (table === 'checkout_holds') {
        return {
          insert: async (values: unknown) => {
            mocks.holdInsert(values)
            return { error: null }
          },
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
  mocks.createSession.mockResolvedValue({ id: 'cs_test_1', url: 'https://checkout.stripe.com/c/cs_test_1' })
  mocks.customersSearch.mockResolvedValue({ data: [] })
  mocks.customersCreate.mockResolvedValue({ id: 'cus_new' })
  vi.stubEnv('STRIPE_PRICE_SELF_STUDY', 'price_self_study')
  vi.stubEnv('STRIPE_PRICE_SELF_STUDY_MONTHLY', 'price_self_study_monthly')
  vi.stubEnv('STRIPE_PRICE_COMPLETE', 'price_complete')
})

describe('every plan is a subscription', () => {
  it.each([
    ['self_study', 'price_self_study'],
    ['complete', 'price_complete'],
    ['self_study_monthly', 'price_self_study_monthly'],
  ])('opens a subscription session for %s', async (plan, price) => {
    // The migration in one assertion. `payment` mode gave a fixed-term buyer no
    // Customer, no Portal and no invoice with a printed service period.
    const { status } = await post({ plan, coachingDay: '2026-09-12' })

    expect(status).toBe(200)
    const params = sessionParams()
    expect(params.mode).toBe('subscription')
    expect(params.line_items).toEqual([{ price, quantity: 1 }])
    expect(params.payment_intent_data).toBeUndefined()
  })

  it('repeats the metadata onto the subscription', async () => {
    // Renewals, Portal plan switches and cancellations all arrive with the
    // SUBSCRIPTION, carrying neither session metadata nor client_reference_id.
    signedInAs('buyer@nhs.net')

    await post({ plan: 'self_study' })

    const params = sessionParams()
    const subscriptionData = params.subscription_data as { metadata: Record<string, string>; description: string }
    expect(subscriptionData.metadata).toMatchObject({
      plan: 'self_study',
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

    const { status } = await post({ plan: 'complete_upgrade', coachingDay: '2026-09-12' })

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

describe('coaching day', () => {
  it('is required for Complete', async () => {
    const { status } = await post({ plan: 'complete' })

    expect(status).toBe(400)
    expect(mocks.createSession).not.toHaveBeenCalled()
  })

  it('soft-holds the place and carries the label into metadata', async () => {
    const { status } = await post({ plan: 'complete', coachingDay: '2026-09-12' })

    expect(status).toBe(200)
    expect(mocks.holdInsert).toHaveBeenCalledWith(
      expect.objectContaining({ coaching_day: '2026-09-12', stripe_session_id: 'cs_test_1' }),
    )
    expect(sessionParams().metadata).toMatchObject({
      coaching_day: '2026-09-12',
      coaching_day_label: 'Saturday 12 September 2026',
    })
  })

  it('refuses a sold-out day', async () => {
    mocks.coachingDay = { ...(mocks.coachingDay as Record<string, unknown>), status: 'sold_out', places_left: 0 }

    const { status } = await post({ plan: 'complete', coachingDay: '2026-09-12' })

    expect(status).toBe(409)
    expect(mocks.createSession).not.toHaveBeenCalled()

    mocks.coachingDay = {
      day: '2026-09-12',
      label: 'Saturday 12 September 2026',
      capacity: 6,
      places_left: 4,
      cutoff_at: '2026-09-11T23:00:00Z',
      status: 'open',
    }
  })
})
