import { describe, expect, it } from 'vitest'
import { resolvePurchaseEmail } from './buyerEmail'

describe('resolvePurchaseEmail', () => {
  it('uses Stripe’s address for a signed-out buyer', () => {
    expect(resolvePurchaseEmail({ stripeEmail: 'Buyer@NHS.net' })).toEqual({
      email: 'buyer@nhs.net',
      source: 'stripe',
      mismatch: false,
    })
  })

  it('normalises a case-only difference without flagging a mismatch', () => {
    // Stripe echoes back whatever the buyer typed. `Buyer@NHS.net` and
    // `buyer@nhs.net` are the same person and the same RLS match.
    expect(
      resolvePurchaseEmail({ stripeEmail: 'Buyer@NHS.net', accountEmail: 'buyer@nhs.net' }),
    ).toEqual({ email: 'buyer@nhs.net', source: 'account', mismatch: false })
  })

  it('files the purchase under the signed-in account when the addresses differ', () => {
    // The whole point: entitlements match by email, so recording the Stripe
    // address would sell access to an account that does not exist.
    expect(
      resolvePurchaseEmail({ stripeEmail: 'partner@gmail.com', accountEmail: 'buyer@nhs.net' }),
    ).toEqual({ email: 'buyer@nhs.net', source: 'account', mismatch: true })
  })

  it('falls back to the account when Stripe sent no address at all', () => {
    expect(resolvePurchaseEmail({ stripeEmail: null, accountEmail: 'buyer@nhs.net' })).toEqual({
      email: 'buyer@nhs.net',
      source: 'account',
      mismatch: false,
    })
  })

  it('reports nothing to file when neither side has an address', () => {
    expect(resolvePurchaseEmail({})).toEqual({ email: null, source: 'none', mismatch: false })
  })

  it('trims whitespace on both sides before comparing', () => {
    expect(
      resolvePurchaseEmail({ stripeEmail: ' buyer@nhs.net ', accountEmail: 'buyer@nhs.net' }),
    ).toEqual({ email: 'buyer@nhs.net', source: 'account', mismatch: false })
  })
})
