import { describe, expect, it, vi } from 'vitest'
import { paymentMethodLabel } from './paymentMethod'

/**
 * The receipt says "Card" or "Bank transfer" and nothing else. Stripe reports
 * dozens of payment method types, so this is the narrowing — and it has to fall
 * back rather than print a blank field on a financial document.
 */

describe('paymentMethodLabel', () => {
  it('calls a card a Card, including the wallets that ride on one', () => {
    for (const type of ['card', 'link', 'apple_pay', 'google_pay', 'card_present']) {
      expect(paymentMethodLabel([type])).toBe('Card')
    }
  })

  it('calls the bank rails a Bank transfer', () => {
    for (const type of ['customer_balance', 'bacs_debit', 'sepa_debit', 'us_bank_account']) {
      expect(paymentMethodLabel([type])).toBe('Bank transfer')
    }
  })

  it('reads the first type when Stripe offers several', () => {
    expect(paymentMethodLabel(['card', 'customer_balance'])).toBe('Card')
    expect(paymentMethodLabel(['bacs_debit', 'card'])).toBe('Bank transfer')
  })

  it('falls back to Card when Stripe told us nothing', () => {
    // Card is what every live Price is configured for, so it is the right guess
    // — and a blank "Payment method" on a receipt is worse than a safe default.
    expect(paymentMethodLabel(null)).toBe('Card')
    expect(paymentMethodLabel(undefined)).toBe('Card')
    expect(paymentMethodLabel([])).toBe('Card')
    expect(paymentMethodLabel([''])).toBe('Card')
  })

  it('falls back loudly for a type nobody has taught it', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})

    expect(paymentMethodLabel(['klarna'])).toBe('Card')
    // Silently describing a non-card payment as a card is the kind of thing a
    // finance team notices and we would not.
    expect(warn).toHaveBeenCalled()
  })
})
