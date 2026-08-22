import { normalizeEmail } from './referrals'

/**
 * Which email a purchase is filed under.
 *
 * Entitlements match purchases to accounts BY EMAIL (`serverEntitlement.ts` ->
 * `preorders.email ilike account email`), so the address written here decides
 * whether the buyer can use what they just bought. Stripe collects its own
 * address on its own page, and a signed-in buyer can type a different one —
 * their work address, a partner's card, a typo — which silently buys access
 * that attaches to nothing.
 *
 * So checkout now stamps the signed-in account's email onto the session
 * metadata (`account_email`) and Stripe pre-fills + locks the field with
 * `customer_email`. This function decides what the webhook records, and is
 * pure so the decision is testable without a Stripe fixture.
 */
export interface PurchaseEmailInput {
  /** What Stripe collected on the payment page (`customer_details.email`). */
  stripeEmail?: string | null
  /** The account the buyer was signed into when checkout started, if any. */
  accountEmail?: string | null
}

export interface PurchaseEmailResolution {
  /** Normalized address to file the purchase under; null when we have neither. */
  email: string | null
  /** Which input won. `account` is preferred whenever there is one. */
  source: 'stripe' | 'account' | 'none'
  /**
   * The two addresses are genuinely different people-shaped strings (not just
   * different casing). The webhook logs this loudly: it means the buyer paid
   * under an address that would never have matched their account.
   */
  mismatch: boolean
}

/**
 * Resolve the address a completed checkout should be recorded under.
 *
 * - No account email (signed-out buyer): Stripe's address, as before.
 * - Same address in different case: normalised, no mismatch — this is the
 *   common case and must not be logged as a problem.
 * - Genuinely different addresses: the ACCOUNT wins. The buyer is signed in;
 *   filing the order under the Stripe address would strand them outside the
 *   product they just paid for, and the account email is the one they can
 *   actually sign in with.
 */
export function resolvePurchaseEmail(input: PurchaseEmailInput): PurchaseEmailResolution {
  const stripeEmail = input.stripeEmail ? normalizeEmail(input.stripeEmail) : ''
  const accountEmail = input.accountEmail ? normalizeEmail(input.accountEmail) : ''

  if (!accountEmail) {
    return { email: stripeEmail || null, source: stripeEmail ? 'stripe' : 'none', mismatch: false }
  }
  if (!stripeEmail || stripeEmail === accountEmail) {
    return { email: accountEmail, source: 'account', mismatch: false }
  }
  return { email: accountEmail, source: 'account', mismatch: true }
}
