import { NextResponse } from 'next/server';
import type Stripe from 'stripe';
import { getStripe } from '@/lib/commerce/stripe';
import { getServerEntitlement } from '@/lib/commerce/serverEntitlement';
import { exactEmailPattern } from '@/lib/commerce/emailFilter';
import {
  stripePortalConfigurationId,
  stripePortalNoSwitchConfigurationId,
} from '@/lib/commerce/plans';
import { customerSearchQuery, pickPortalTarget } from '@/lib/commerce/billingPortal';

interface PortalBody {
  /**
   * `subscription_update` opens the Portal straight on the plan switcher — the
   * Self-Study -> Complete upgrade path, which replaced the bespoke £300 Price.
   * Omitted, the Portal opens on its landing page.
   */
  flow?: 'subscription_update';
}

/**
 * Opens the Stripe Customer Portal for the signed-in buyer.
 *
 * Now the whole of self-service billing, not just cancellation: every plan is a
 * subscription, so this is where a customer changes plan, replaces a dead card,
 * downloads invoices for a study-budget claim, and cancels. Without it "cancel
 * any time" and "upgrade to Complete" are promises the product cannot keep.
 *
 * The customer id comes from `preorders.stripe_customer_id` where the webhook
 * recorded it, falling back to a Stripe customer search by email for rows that
 * predate that column or were created by hand from a Payment Link. When there
 * is genuinely no customer (nothing was ever charged through Stripe) this
 * answers 404 with a message the UI can show, not a 500.
 *
 * What the Portal is *allowed* to do — which prices it offers, whether it
 * prorates, how it cancels — is Dashboard configuration, and WHICH
 * configuration is a decision about this customer: see {@link portalConfigFor}.
 */
export async function POST(request: Request) {
  const { user, supabase, entitlement, failedOpen } = await getServerEntitlement();

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Complete is the top plan: there is nothing above it to switch to, and the
  // Portal's switcher is symmetric, so a configuration that could sell them an
  // upgrade can only offer them a DOWNGRADE. `failedOpen` counts as "treat them
  // as Complete": when the entitlement lookup broke we do not know what they
  // hold, and the safe unknown is the configuration that cannot change a plan.
  // They keep their card, their invoices and cancellation either way.
  const holdsTopPlan =
    failedOpen || entitlement?.plan === 'complete' || entitlement?.plan === 'intensive';

  // A malformed or absent body is simply "no flow" — the Portal landing page is
  // always a valid destination, and billing must not 400 on a parse slip.
  let flow: PortalBody['flow'];
  try {
    const body = (await request.json()) as PortalBody;
    if (body?.flow === 'subscription_update') flow = 'subscription_update';
  } catch {
    flow = undefined;
  }

  // Asking for the plan switcher from a plan with nothing above it. The UI does
  // not offer this (canSwitchPlan refuses Complete), so it means a stale page
  // or a hand-made request — answer with something a human can read rather than
  // opening a Portal whose configuration would refuse the flow with a 500.
  if (flow === 'subscription_update' && holdsTopPlan) {
    return NextResponse.json(
      {
        error: 'no_upgrade_available',
        message: failedOpen
          ? "We couldn't check your current plan just now — please reload and try again."
          : 'Complete already includes everything, so there is no plan to switch to. Use “Manage billing” for invoices, your card, or to cancel.',
      },
      { status: 400 },
    );
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
    const target = pickPortalTarget(rows ?? []);
    let customerId = target.customerId;

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
    const configuration = portalConfigFor(holdsTopPlan);
    // The plan switcher needs a subscription to switch. Without one we fall
    // back to the landing page rather than failing: a customer whose row
    // predates the subscription migration can still manage their billing.
    const flowData: Stripe.BillingPortal.SessionCreateParams.FlowData | undefined =
      flow === 'subscription_update' && target.subscriptionId
        ? {
            type: 'subscription_update',
            subscription_update: { subscription: target.subscriptionId },
          }
        : undefined;

    const session = await stripe.billingPortal.sessions.create({
      customer: customerId,
      return_url: `${origin}/dashboard/settings`,
      ...(configuration ? { configuration } : {}),
      ...(flowData ? { flow_data: flowData } : {}),
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

/**
 * Which Portal configuration this customer gets.
 *
 * Complete holders get the one with `subscription_update` disabled, so the
 * only plan move the Portal can offer them — down — is not offered at all.
 * Everyone else gets the switching configuration, which is the upgrade path.
 *
 * Both fall back: an unset `STRIPE_PORTAL_CONFIGURATION_ID_NO_SWITCH` degrades
 * to the switching configuration, and an unset switching id degrades to the
 * account default. Billing must keep working while the Dashboard catches up.
 */
function portalConfigFor(holdsTopPlan: boolean): string | null {
  const switching = stripePortalConfigurationId();
  if (!holdsTopPlan) return switching;
  return stripePortalNoSwitchConfigurationId() ?? switching;
}
