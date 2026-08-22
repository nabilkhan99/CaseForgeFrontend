import { describe, expect, it } from 'vitest'
import { customerSearchQuery, pickPortalCustomerId, type CustomerCandidateRow } from './billingPortal'

function row(over: Partial<CustomerCandidateRow>): CustomerCandidateRow {
  return {
    stripe_customer_id: 'cus_1',
    stripe_subscription_id: null,
    status: 'paid',
    created_at: '2026-08-01T00:00:00Z',
    ...over,
  }
}

describe('pickPortalCustomerId', () => {
  it('returns null when nothing carries a customer id', () => {
    expect(pickPortalCustomerId([row({ stripe_customer_id: null })])).toBeNull()
    expect(pickPortalCustomerId([])).toBeNull()
  })

  it('prefers the live subscription over a newer one-off purchase', () => {
    // The portal exists to cancel or re-card a subscription. A one-off Complete
    // bought last week must not shadow the monthly plan they came here to end.
    const picked = pickPortalCustomerId([
      row({ stripe_customer_id: 'cus_monthly', stripe_subscription_id: 'sub_1', created_at: '2026-06-01T00:00:00Z' }),
      row({ stripe_customer_id: 'cus_oneoff', created_at: '2026-08-15T00:00:00Z' }),
    ])
    expect(picked).toBe('cus_monthly')
  })

  it('ignores a canceled subscription when a live purchase exists', () => {
    const picked = pickPortalCustomerId([
      row({ stripe_customer_id: 'cus_dead', stripe_subscription_id: 'sub_dead', status: 'canceled', created_at: '2026-05-01T00:00:00Z' }),
      row({ stripe_customer_id: 'cus_live', created_at: '2026-08-01T00:00:00Z' }),
    ])
    expect(picked).toBe('cus_live')
  })

  it('falls back to the most recent row with a customer id', () => {
    const picked = pickPortalCustomerId([
      row({ stripe_customer_id: 'cus_old', created_at: '2026-01-01T00:00:00Z' }),
      row({ stripe_customer_id: 'cus_new', created_at: '2026-08-01T00:00:00Z' }),
    ])
    expect(picked).toBe('cus_new')
  })

  it('does not mutate the caller’s rows', () => {
    const rows = [
      row({ stripe_customer_id: 'cus_old', created_at: '2026-01-01T00:00:00Z' }),
      row({ stripe_customer_id: 'cus_new', created_at: '2026-08-01T00:00:00Z' }),
    ]
    pickPortalCustomerId(rows)
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
