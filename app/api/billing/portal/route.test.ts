import { beforeEach, describe, expect, it, vi } from 'vitest'

/**
 * The Customer Portal is now the whole of self-service billing: plan switches
 * (the Self-Study -> Complete upgrade, which replaced a bespoke £300 Price),
 * card changes, invoices for a study-budget claim, and cancellation.
 *
 * What is asserted here is the wiring that decides WHICH subscription the
 * portal opens on and which configuration governs it — get either wrong and
 * the customer lands on a page that cannot do what the button promised.
 */

const mocks = vi.hoisted(() => ({
  portalCreate: vi.fn(),
  customersSearch: vi.fn(),
  user: { id: 'user-1', email: 'buyer@nhs.net' } as { id: string; email: string } | null,
  rows: [] as Array<Record<string, unknown>>,
}))

vi.mock('server-only', () => ({}))

vi.mock('@/lib/commerce/stripe', () => ({
  getStripe: () => ({
    billingPortal: { sessions: { create: mocks.portalCreate } },
    customers: { search: mocks.customersSearch },
  }),
}))

vi.mock('@/lib/commerce/serverEntitlement', () => ({
  getServerEntitlement: async () => ({
    user: mocks.user,
    supabase: {
      from: () => ({
        select: () => ({ ilike: async () => ({ data: mocks.rows, error: null }) }),
      }),
    },
  }),
}))

const { POST } = await import('./route')

async function post(body?: Record<string, unknown>) {
  const response = await POST(
    new Request('https://www.fourteenfisherman.com/api/billing/portal', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      ...(body ? { body: JSON.stringify(body) } : {}),
    }),
  )
  return { status: response.status, body: await response.json() }
}

const liveRow = {
  stripe_customer_id: 'cus_1',
  stripe_subscription_id: 'sub_1',
  status: 'paid',
  created_at: '2026-08-01T00:00:00Z',
}

beforeEach(() => {
  vi.clearAllMocks()
  vi.unstubAllEnvs()
  mocks.user = { id: 'user-1', email: 'buyer@nhs.net' }
  mocks.rows = [liveRow]
  mocks.portalCreate.mockResolvedValue({ url: 'https://billing.stripe.com/p/session_1' })
  mocks.customersSearch.mockResolvedValue({ data: [] })
})

describe('opening the portal', () => {
  it('refuses an anonymous caller', async () => {
    mocks.user = null

    const { status } = await post()

    expect(status).toBe(401)
    expect(mocks.portalCreate).not.toHaveBeenCalled()
  })

  it('opens on the landing page by default', async () => {
    const { status, body } = await post()

    expect(status).toBe(200)
    expect(body.url).toBe('https://billing.stripe.com/p/session_1')
    const params = mocks.portalCreate.mock.calls[0][0]
    expect(params.customer).toBe('cus_1')
    expect(params.flow_data).toBeUndefined()
  })

  it('opens straight on the plan switcher when asked', async () => {
    // This is the upgrade path. Landing on the portal home instead would leave
    // a customer who clicked "Upgrade to Complete" hunting for the button.
    await post({ flow: 'subscription_update' })

    expect(mocks.portalCreate.mock.calls[0][0].flow_data).toEqual({
      type: 'subscription_update',
      subscription_update: { subscription: 'sub_1' },
    })
  })

  it('falls back to the landing page when there is no live subscription', async () => {
    // A pre-migration row has a customer but no subscription to switch. Better
    // a portal with invoices in it than a 500.
    mocks.rows = [{ ...liveRow, stripe_subscription_id: null }]

    const { status } = await post({ flow: 'subscription_update' })

    expect(status).toBe(200)
    expect(mocks.portalCreate.mock.calls[0][0].flow_data).toBeUndefined()
  })

  it('passes the configured portal configuration when one is set', async () => {
    // The configuration is what decides which prices the switcher offers, how
    // it prorates, and that cancellation happens at period end.
    vi.stubEnv('STRIPE_PORTAL_CONFIGURATION_ID', 'bpc_live')

    await post()

    expect(mocks.portalCreate.mock.calls[0][0].configuration).toBe('bpc_live')
  })

  it('omits the configuration when unset, so the account default applies', async () => {
    await post()

    expect(mocks.portalCreate.mock.calls[0][0].configuration).toBeUndefined()
  })

  it('searches Stripe when no row carries a customer id', async () => {
    mocks.rows = []
    mocks.customersSearch.mockResolvedValue({ data: [{ id: 'cus_found' }] })

    await post()

    expect(mocks.portalCreate.mock.calls[0][0].customer).toBe('cus_found')
  })

  it('answers 404, not 500, when the account has no billing at all', async () => {
    mocks.rows = []

    const { status, body } = await post()

    expect(status).toBe(404)
    expect(body.error).toBe('no_customer')
  })

  it('treats an unparseable body as no flow rather than a 400', async () => {
    // Billing must not fail on a parse slip: the landing page is always valid.
    const response = await POST(
      new Request('https://www.fourteenfisherman.com/api/billing/portal', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: 'not json',
      }),
    )

    expect(response.status).toBe(200)
    expect(mocks.portalCreate.mock.calls[0][0].flow_data).toBeUndefined()
  })
})
