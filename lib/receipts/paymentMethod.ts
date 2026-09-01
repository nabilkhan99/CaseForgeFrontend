import type { PaymentMethodLabel } from './receiptContent'

/**
 * How the receipt describes what the customer paid with.
 *
 * The spec allows exactly two words: "Card" or "Bank transfer". Stripe reports
 * a payment method TYPE, of which there are dozens, so this is the mapping —
 * kept as a pure function over the type string so the webhook does not have to
 * carry a lookup table around.
 *
 * Anything unrecognised falls back to "Card" and logs. Card is what we sell on
 * and what every live Price is configured for, so it is the right guess; the
 * log is there because a receipt quietly describing a bank transfer as a card
 * payment is the kind of thing a finance team notices and we would not.
 */
const BANK_TRANSFER_TYPES = new Set([
  'customer_balance',
  'bacs_debit',
  'sepa_debit',
  'us_bank_account',
  'acss_debit',
  'au_becs_debit',
])

const CARD_TYPES = new Set(['card', 'link', 'apple_pay', 'google_pay', 'card_present'])

export function paymentMethodLabel(types: readonly string[] | null | undefined): PaymentMethodLabel {
  const type = types?.find((t) => typeof t === 'string' && t.length > 0)
  if (!type) return 'Card'
  if (BANK_TRANSFER_TYPES.has(type)) return 'Bank transfer'
  if (CARD_TYPES.has(type)) return 'Card'

  console.warn('[receipt] unrecognised Stripe payment method type — printing "Card"', { type })
  return 'Card'
}
