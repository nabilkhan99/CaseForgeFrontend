import { describe, expect, it } from 'vitest'
import { customerSearchQuery, pickPortalTarget, type CustomerCandidateRow } from './billingPortal'

function row(over: Partial<CustomerCandidateRow>): CustomerCandidateRow {
  return {
    stripe_customer_id: 'cus_1',
    stripe_subscription_id: null,
    status: 'paid',
    created_at: '2026-08-01T00:00:00Z',
    ...over,
  }
}

describe('pickPortalTarget', () => {
  it('returns nothing when no row carries a customer id', () => {
    expect(pickPortalTarget([row({ stripe_customer_id: null })])).toEqual({
      customerId: null,
      subscriptionId: null,
    })
    expect(pickPortalTarget([])).toEqual({ customerId: null, subscriptionId: null })
  })

  it('prefers the live subscription over a newer pre-migration purchase', () => {
    // The portal exists to switch plan, cancel or re-card a subscription. A
    // legacy row with no subscription must not shadow the live one, or the
    // upgrade flow has no subscription to open on.
    const picked = pickPortalTarget([
      row({ stripe_customer_id: 'cus_live', stripe_subscription_id: 'sub_1', created_at: '2026-06-01T00:00:00Z' }),
      row({ stripe_customer_id: 'cus_legacy', created_at: '2026-08-15T00:00:00Z' }),
    ])
    expect(picked).toEqual({ customerId: 'cus_live', subscriptionId: 'sub_1' })
  })

  it('ignores a canceled subscription when a live purchase exists', () => {
    const picked = pickPortalTarget([
      row({ stripe_customer_id: 'cus_dead', stripe_subscription_id: 'sub_dead', status: 'canceled', created_at: '2026-05-01T00:00:00Z' }),
      row({ stripe_customer_id: 'cus_live', created_at: '2026-08-01T00:00:00Z' }),
    ])
    // No live subscription to open a flow on — the portal lands on its home page.
    expect(picked).toEqual({ customerId: 'cus_live', subscriptionId: null })
  })

  it('falls back to the most recent row with a customer id', () => {
    const picked = pickPortalTarget([
      row({ stripe_customer_id: 'cus_old', created_at: '2026-01-01T00:00:00Z' }),
      row({ stripe_customer_id: 'cus_new', created_at: '2026-08-01T00:00:00Z' }),
    ])
    expect(picked.customerId).toBe('cus_new')
  })

  it('does not mutate the caller’s rows', () => {
    const rows = [
      row({ stripe_customer_id: 'cus_old', created_at: '2026-01-01T00:00:00Z' }),
      row({ stripe_customer_id: 'cus_new', created_at: '2026-08-01T00:00:00Z' }),
    ]
    pickPortalTarget(rows)
    expect(rows[0].stripe_customer_id).toBe('cus_old')
  })
})

describe('customerSearchQuery', () => {
  it('builds an exact, lower-cased email clause', () => {
    expect(customerSearchQuery(' Buyer@NHS.net ')).toBe("email:'buyer@nhs.net'")
  })

  it('escapes quotes so an address cannot break out of the clause', () => {
    expect(customerSearchQuery("o'hara@nhs.net")).toBe("email:'o\\'hara@nhs.net'")
  })
})
