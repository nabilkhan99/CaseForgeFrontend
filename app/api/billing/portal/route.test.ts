import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { CustomerCandidateRow } from '@/lib/commerce/billingPortal'

/**
 * The self-service cancel path for monthly plans. The failure mode that matters
 * is a buyer with no `stripe_customer_id` on file (hand-provisioned orders,
 * rows predating the column) getting a 500 instead of an answer.
 */

const mocks = vi.hoisted(() => ({
  user: null as { id: string; email: string } | null,
  rows: [] as CustomerCandidateRow[],
  rowsError: null as unknown,
  search: vi.fn(),
  createPortalSession: vi.fn(),
}))

vi.mock('server-only', () => ({}))

vi.mock('@/lib/commerce/stripe', () => ({
  getStripe: () => ({
    customers: { search: mocks.search },
    billingPortal: { sessions: { create: mocks.createPortalSession } },
  }),
}))

vi.mock('@/lib/commerce/serverEntitlement', () => ({
  getServerEntitlement: async () => ({
    user: mocks.user,
    supabase: {
      from: () => ({
        select: () => ({
          ilike: async () => ({ data: mocks.rows, error: mocks.rowsError }),
        }),
      }),
    },
  }),
}))

const { POST } = await import('./route')

async function post() {
  const response = await POST(
    new Request('https://www.fourteenfisherman.com/api/billing/portal', { method: 'POST' }),
  )
  return { status: response.status, body: await response.json() }
}

function row(over: Partial<CustomerCandidateRow>): CustomerCandidateRow {
  return {
    stripe_customer_id: 'cus_1',
    stripe_subscription_id: null,
    status: 'paid',
    created_at: '2026-08-01T00:00:00Z',
    ...over,
  }
}

beforeEach(() => {
  vi.clearAllMocks()
  mocks.user = { id: 'user-1', email: 'buyer@nhs.net' }
  mocks.rows = []
  mocks.rowsError = null
  mocks.search.mockResolvedValue({ data: [] })
  mocks.createPortalSession.mockResolvedValue({ url: 'https://billing.stripe.com/session/abc' })
})

describe('POST /api/billing/portal', () => {
  it('refuses a signed-out caller', async () => {
    mocks.user = null

    const { status } = await post()

    expect(status).toBe(401)
    expect(mocks.createPortalSession).not.toHaveBeenCalled()
  })

  it('opens the portal for the customer on the buyer’s own purchase', async () => {
    mocks.rows = [row({ stripe_customer_id: 'cus_monthly', stripe_subscription_id: 'sub_1' })]

    const { status, body } = await post()

    expect(status).toBe(200)
    expect(body.url).toBe('https://billing.stripe.com/session/abc')
    expect(mocks.createPortalSession).toHaveBeenCalledWith({
      customer: 'cus_monthly',
      return_url: 'https://www.fourteenfisherman.com/dashboard/settings',
    })
    // No need to ask Stripe when we already know the customer.
    expect(mocks.search).not.toHaveBeenCalled()
  })

  it('falls back to Stripe when no row carries a customer id', async () => {
    // Hand-provisioned orders (Payment Link, manual invoice) have no
    // stripe_customer_id, but their billing is still worth managing.
    mocks.rows = [row({ stripe_customer_id: null })]
    mocks.search.mockResolvedValue({ data: [{ id: 'cus_found' }] })

    const { status } = await post()

    expect(status).toBe(200)
    expect(mocks.search).toHaveBeenCalledWith({ query: "email:'buyer@nhs.net'", limit: 1 })
    expect(mocks.createPortalSession).toHaveBeenCalledWith(
      expect.objectContaining({ customer: 'cus_found' }),
    )
  })

  it('answers 404 with a message when there is genuinely no customer', async () => {
    const { status, body } = await post()

    expect(status).toBe(404)
    expect(body.error).toBe('no_customer')
    expect(body.message).toContain('hello@fourteenfisherman.com')
  })

  it('answers 500 rather than throwing when Stripe rejects the portal call', async () => {
    // The commonest cause is an unconfigured portal in a fresh Stripe mode —
    // the buyer needs an apology, not an unhandled exception.
    const error = vi.spyOn(console, 'error').mockImplementation(() => {})
    mocks.rows = [row({ stripe_customer_id: 'cus_1' })]
    mocks.createPortalSession.mockRejectedValue(new Error('No configuration provided'))

    const { status, body } = await post()

    expect(status).toBe(500)
    expect(body.error).toContain('billing portal')
    error.mockRestore()
  })

  it('answers 500 when the purchase lookup fails', async () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => {})
    mocks.rowsError = { message: 'boom' }

    const { status } = await post()

    expect(status).toBe(500)
    error.mockRestore()
  })
})
