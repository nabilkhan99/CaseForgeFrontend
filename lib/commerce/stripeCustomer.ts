import type Stripe from 'stripe'
import { customerSearchQuery } from './billingPortal'

/**
 * Resolving the one Stripe Customer an account should own.
 *
 * Why this exists: in `subscription` mode Checkout ALWAYS creates or reuses a
 * Customer, and passing `customer_email` without `customer` makes it create a
 * brand new one every time. With all three plans now subscriptions, a repeat
 * buyer would end up with two `cus_…` objects each holding one subscription —
 * and the Customer Portal opens on exactly one of them, leaving the other
 * subscription invisible and uncancellable by the person paying for it.
 *
 * So the Customer is resolved server-side before the session is created, and
 * passed as `customer:`.
 */

export interface ResolveCustomerArgs {
  /** Normalised account email. */
  email: string
  /** Buyer's name, when the account has one. */
  name?: string | null
  /** Supabase user id, stamped on the Customer so support can trace it back. */
  userId?: string | null
  /**
   * A customer id already recorded against this account (`preorders
   * .stripe_customer_id`). Trusted first — it is the cheapest and most exact
   * answer, and it survives an email change on the Stripe side.
   */
  knownCustomerId?: string | null
}

/**
 * Find this account's Stripe Customer, creating one if it has none.
 *
 * Order: recorded id → search by email → create. The search is the step that
 * rescues hand-created customers (Payment Links, manual invoices) and anyone
 * whose row predates `stripe_customer_id`.
 *
 * Takes the Stripe client as an argument rather than importing it so the
 * decision is testable without a live key.
 */
export async function resolveOrCreateCustomerId(
  stripe: Pick<Stripe, 'customers'>,
  args: ResolveCustomerArgs,
): Promise<string> {
  const known = args.knownCustomerId?.trim()
  if (known) return known

  const found = await stripe.customers.search({
    query: customerSearchQuery(args.email),
    limit: 1,
  })
  const existing = found.data[0]?.id
  if (existing) return existing

  const created = await stripe.customers.create({
    email: args.email,
    ...(args.name?.trim() ? { name: args.name.trim() } : {}),
    metadata: {
      // The address entitlements key off, recorded on the Customer so a
      // subscription-only event can be traced to an account without the
      // checkout session.
      account_email: args.email,
      ...(args.userId ? { supabase_user_id: args.userId } : {}),
    },
  })
  return created.id
}
