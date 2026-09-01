/**
 * Finding the Stripe Customer — and subscription — behind a signed-in account.
 *
 * The Customer Portal needs a customer id, and opening it straight onto the
 * plan switcher (`flow_data.subscription_update`) needs a subscription id too.
 * We have both on `preorders`, written by the webhook, but not always: rows
 * created before those columns were populated, and hand-provisioned orders from
 * a Payment Link, have neither. Hence the two-step lookup — rows first, Stripe
 * by email second — with the pure "which row" decision isolated here so it is
 * testable without a Stripe or Supabase fixture.
 *
 * Since every plan became a subscription (2026-08-22) every NEW row carries
 * both ids, so this mostly matters for the pre-migration rows.
 */

export interface CustomerCandidateRow {
  stripe_customer_id: string | null
  stripe_subscription_id: string | null
  status: string
  created_at: string
}

export interface PortalTarget {
  /** Null when no row carries a customer id; the caller then asks Stripe. */
  customerId: string | null
  /**
   * The live subscription to open a plan-switch or cancel flow on. Null when
   * the account has no live subscription, in which case the portal still opens
   * — just on its landing page rather than on a flow.
   */
  subscriptionId: string | null
}

/**
 * Pick the customer (and live subscription) whose portal is worth opening.
 *
 * Preference order:
 * 1. A live subscription (`status: 'paid'` with a subscription id) — this is
 *    the row they want to switch plan on, re-card, or cancel.
 * 2. Any other row carrying a customer id, most recent first — a lapsed
 *    customer opening the portal should still see their own receipts.
 */
export function pickPortalTarget(rows: readonly CustomerCandidateRow[]): PortalTarget {
  const withCustomer = rows.filter((r) => Boolean(r.stripe_customer_id))
  if (withCustomer.length === 0) return { customerId: null, subscriptionId: null }

  const newestFirst = [...withCustomer].sort(
    (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
  )
  const liveSubscription = newestFirst.find(
    (r) => r.status === 'paid' && Boolean(r.stripe_subscription_id),
  )
  const chosen = liveSubscription ?? newestFirst[0]
  return {
    customerId: chosen.stripe_customer_id,
    subscriptionId: liveSubscription?.stripe_subscription_id ?? null,
  }
}

/**
 * Stripe's search query for an exact email match, with the single quotes that
 * delimit the value escaped so an address containing one cannot break out of
 * the clause.
 */
export function customerSearchQuery(email: string): string {
  return `email:'${email.trim().toLowerCase().replace(/['\\]/g, '\\$&')}'`
}
