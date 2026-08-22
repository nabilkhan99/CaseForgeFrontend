/**
 * Finding the Stripe Customer behind a signed-in account.
 *
 * The Customer Portal needs a customer id. We have one on `preorders`
 * (`stripe_customer_id`, written by the webhook), but not always: rows created
 * before that column was populated, and hand-provisioned orders from a Payment
 * Link, have none. Hence the two-step lookup — rows first, Stripe by email
 * second — with the pure "which row" decision isolated here so it is testable
 * without a Stripe or Supabase fixture.
 */

export interface CustomerCandidateRow {
  stripe_customer_id: string | null
  stripe_subscription_id: string | null
  status: string
  created_at: string
}

/**
 * Pick the customer id whose portal is worth opening.
 *
 * Preference order:
 * 1. A live subscription (`status: 'paid'` with a subscription id) — the portal
 *    is only useful to a monthly customer, and this is the row they want to
 *    cancel or re-card.
 * 2. Any other row carrying a customer id, most recent first — a one-off buyer
 *    opening the portal should still see their own receipts, not nothing.
 *
 * Returns null when no row carries a customer id at all; the caller then falls
 * back to Stripe.
 */
export function pickPortalCustomerId(rows: readonly CustomerCandidateRow[]): string | null {
  const withCustomer = rows.filter((r) => Boolean(r.stripe_customer_id))
  if (withCustomer.length === 0) return null

  const newestFirst = [...withCustomer].sort(
    (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
  )
  const liveSubscription = newestFirst.find(
    (r) => r.status === 'paid' && Boolean(r.stripe_subscription_id),
  )
  return (liveSubscription ?? newestFirst[0]).stripe_customer_id
}

/**
 * Stripe's search query for an exact email match, with the single quotes that
 * delimit the value escaped so an address containing one cannot break out of
 * the clause.
 */
export function customerSearchQuery(email: string): string {
  return `email:'${email.trim().toLowerCase().replace(/['\\]/g, '\\$&')}'`
}
