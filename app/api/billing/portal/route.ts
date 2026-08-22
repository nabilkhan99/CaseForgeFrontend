import { NextResponse } from 'next/server';
import { getStripe } from '@/lib/commerce/stripe';
import { getServerEntitlement } from '@/lib/commerce/serverEntitlement';
import { exactEmailPattern } from '@/lib/commerce/emailFilter';
import { customerSearchQuery, pickPortalCustomerId } from '@/lib/commerce/billingPortal';

/**
 * Opens the Stripe Customer Portal for the signed-in buyer.
 *
 * The only self-service way to cancel a monthly plan or replace a dead card —
 * without it, "cancel any time" on the pricing page is a promise the product
 * cannot keep, and the buyer has to email us.
 *
 * The customer id comes from `preorders.stripe_customer_id` where the webhook
 * recorded it, falling back to a Stripe customer search by email for rows that
 * predate that column or were created by hand from a Payment Link. When there
 * is genuinely no customer (nothing was ever charged through Stripe) this
 * answers 404 with a message the UI can show, not a 500.
 */
export async function POST(request: Request) {
  const { user, supabase } = await getServerEntitlement();

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    // RLS ("read own purchases by email") already scopes this; `.ilike` matches
    // the policy's case-insensitivity, exactly as the entitlement lookup does.
    const { data: rows, error } = await supabase
      .from('preorders')
      .select('stripe_customer_id, stripe_subscription_id, status, created_at')
      .ilike('email', exactEmailPattern(user.email));
    if (error) throw error;

    const stripe = getStripe();
    let customerId = pickPortalCustomerId(rows ?? []);

    if (!customerId && user.email) {
      // Nothing on file. Ask Stripe directly — a hand-created customer (Payment
      // Link, manual invoice) still has billing worth managing.
      const found = await stripe.customers.search({
        query: customerSearchQuery(user.email),
        limit: 1,
      });
      customerId = found.data[0]?.id ?? null;
    }

    if (!customerId) {
      return NextResponse.json(
        {
          error: 'no_customer',
          message:
            "We couldn't find a billing record for this account. Email hello@fourteenfisherman.com and we'll sort it out.",
        },
        { status: 404 },
      );
    }

    const origin = new URL(request.url).origin;
    const session = await stripe.billingPortal.sessions.create({
      customer: customerId,
      return_url: `${origin}/dashboard/settings`,
    });

    return NextResponse.json({ url: session.url });
  } catch (error: unknown) {
    console.error('[billing-portal] failed to open portal', { email: user.email, error });
    return NextResponse.json(
      { error: 'Could not open the billing portal — please try again, or email hello@fourteenfisherman.com.' },
      { status: 500 },
    );
  }
}
