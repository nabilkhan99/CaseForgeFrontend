import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { Entitlement } from '@/lib/commerce/entitlements'

/**
 * The two commerce-correctness rules this endpoint now enforces:
 *
 * 1. A signed-in buyer's ACCOUNT email is what Stripe collects, because
 *    entitlements match purchases to accounts by email.
 * 2. `complete_upgrade` (Complete at the £300 difference) is sold only to
 *    someone the SERVER can see holds Self-Study.
 *
 * Asserted on the params handed to `checkout.sessions.create` — no real Stripe
 * call is ever made.
 */

const mocks = vi.hoisted(() => ({
  createSession: vi.fn(),
  entitlement: {
    user: null as { id: string; email: string } | null,
    entitlement: { state: 'none', hasLectures: false } as Entitlement,
    failedOpen: false,
  },
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
  getStripe: () => ({ checkout: { sessions: { create: mocks.createSession } } }),
}))

vi.mock('@/lib/commerce/serverEntitlement', () => ({
  getServerEntitlement: async () => mocks.entitlement,
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

function signedInAs(email: string, entitlement: Partial<Entitlement>) {
  mocks.entitlement.user = { id: 'user-1', email }
  mocks.entitlement.entitlement = { state: 'active', hasLectures: false, ...entitlement }
}

beforeEach(() => {
  vi.clearAllMocks()
  mocks.entitlement = {
    user: null,
    entitlement: { state: 'none', hasLectures: false },
    failedOpen: false,
  }
  mocks.createSession.mockResolvedValue({ id: 'cs_test_1', url: 'https://checkout.stripe.com/c/cs_test_1' })
  vi.stubEnv('STRIPE_PRICE_SELF_STUDY', 'price_self_study')
  vi.stubEnv('STRIPE_PRICE_SELF_STUDY_MONTHLY', 'price_self_study_monthly')
  vi.stubEnv('STRIPE_PRICE_COMPLETE', 'price_complete')
  vi.stubEnv('STRIPE_PRICE_COMPLETE_UPGRADE', 'price_complete_upgrade')
})

describe('linking a purchase to the buyer’s account', () => {
  it('pre-fills and records the signed-in account email', async () => {
    // Without this, a buyer who types a different address on Stripe's page buys
    // access that attaches to no account — the failure the whole package exists
    // to close.
    signedInAs('Buyer@NHS.net', { plan: 'self_study' })

    const { status } = await post({ plan: 'self_study' })

    expect(status).toBe(200)
    const params = mocks.createSession.mock.calls[0][0]
    expect(params.customer_email).toBe('buyer@nhs.net')
    expect(params.client_reference_id).toBe('user-1')
    expect(params.metadata.account_email).toBe('buyer@nhs.net')
  })

  it('changes nothing for a signed-out buyer', async () => {
    const { status } = await post({ plan: 'self_study' })

    expect(status).toBe(200)
    const params = mocks.createSession.mock.calls[0][0]
    expect(params.customer_email).toBeUndefined()
    expect(params.client_reference_id).toBeUndefined()
    expect(params.metadata.account_email).toBeUndefined()
  })

  it('carries the account email onto the subscription too', async () => {
    // Renewal invoices arrive with the subscription, long after the session.
    signedInAs('buyer@nhs.net', { plan: 'self_study_monthly' })

    await post({ plan: 'self_study_monthly' })

    const params = mocks.createSession.mock.calls[0][0]
    expect(params.mode).toBe('subscription')
    expect(params.subscription_data.metadata.account_email).toBe('buyer@nhs.net')
  })
})

describe('complete_upgrade', () => {
  it('refuses a signed-out caller', async () => {
    const { status } = await post({ plan: 'complete_upgrade', coachingDay: '2026-09-12' })

    expect(status).toBe(401)
    expect(mocks.createSession).not.toHaveBeenCalled()
  })

  it('refuses someone with no purchase', async () => {
    mocks.entitlement.user = { id: 'user-1', email: 'nobody@nhs.net' }

    const { status } = await post({ plan: 'complete_upgrade', coachingDay: '2026-09-12' })

    expect(status).toBe(403)
    expect(mocks.createSession).not.toHaveBeenCalled()
  })

  it('refuses someone who already holds Complete', async () => {
    signedInAs('buyer@nhs.net', { plan: 'complete', hasLectures: true })

    const { status } = await post({ plan: 'complete_upgrade', coachingDay: '2026-09-12' })

    expect(status).toBe(403)
  })

  it('refuses a lapsed Self-Study plan (that is a renewal, at full price)', async () => {
    signedInAs('buyer@nhs.net', { state: 'read_only', plan: 'self_study' })

    const { status } = await post({ plan: 'complete_upgrade', coachingDay: '2026-09-12' })

    expect(status).toBe(403)
  })

  it('refuses when the entitlement lookup failed open', async () => {
    // Fail-open means we do not KNOW what they hold, and this sells Complete at
    // half price. Refusing is the only safe answer.
    signedInAs('buyer@nhs.net', { plan: 'self_study' })
    mocks.entitlement.failedOpen = true

    const { status } = await post({ plan: 'complete_upgrade', coachingDay: '2026-09-12' })

    expect(status).toBe(503)
    expect(mocks.createSession).not.toHaveBeenCalled()
  })

  it('still requires a coaching day', async () => {
    signedInAs('buyer@nhs.net', { plan: 'self_study' })

    const { status } = await post({ plan: 'complete_upgrade' })

    expect(status).toBe(400)
    expect(mocks.createSession).not.toHaveBeenCalled()
  })

  it('charges the upgrade price and records the order as a Complete purchase', async () => {
    // `metadata.plan` MUST be 'complete': the webhook writes it straight onto
    // the preorder row, and the entitlement fold grants lectures off that value.
    signedInAs('buyer@nhs.net', { plan: 'self_study' })

    const { status } = await post({ plan: 'complete_upgrade', coachingDay: '2026-09-12' })

    expect(status).toBe(200)
    const params = mocks.createSession.mock.calls[0][0]
    expect(params.mode).toBe('payment')
    expect(params.line_items).toEqual([{ price: 'price_complete_upgrade', quantity: 1 }])
    expect(params.metadata.plan).toBe('complete')
    expect(params.metadata.upgrade_from).toBe('self_study')
    expect(params.metadata.coaching_day).toBe('2026-09-12')
    expect(params.cancel_url).toContain('/dashboard/upgrade')
  })

  it('upgrades a monthly Self-Study customer at the same price', async () => {
    signedInAs('buyer@nhs.net', { plan: 'self_study_monthly' })

    const { status } = await post({ plan: 'complete_upgrade', coachingDay: '2026-09-12' })

    expect(status).toBe(200)
    const params = mocks.createSession.mock.calls[0][0]
    // A one-off top-up, not a second subscription.
    expect(params.mode).toBe('payment')
    expect(params.metadata.upgrade_from).toBe('self_study_monthly')
  })

  it('upgrades a pre-launch buyer whose access window has not opened', async () => {
    signedInAs('buyer@nhs.net', { state: 'none', plan: 'self_study' })

    const { status } = await post({ plan: 'complete_upgrade', coachingDay: '2026-09-12' })

    expect(status).toBe(200)
  })

  it('soft-holds the coaching-day place like any Complete purchase', async () => {
    signedInAs('buyer@nhs.net', { plan: 'self_study' })

    await post({ plan: 'complete_upgrade', coachingDay: '2026-09-12' })

    expect(mocks.holdInsert).toHaveBeenCalledWith(
      expect.objectContaining({ coaching_day: '2026-09-12', stripe_session_id: 'cs_test_1' }),
    )
  })
})
