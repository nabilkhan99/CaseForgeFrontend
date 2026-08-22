import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { getStripe } from '@/lib/commerce/stripe';
import {
  getPlan,
  isSubscriptionPlan,
  stripeCompleteUpgradePriceId,
  stripePriceIdFor,
  stripeRefereeCouponIdFor,
  COMPLETE_UPGRADE_PRICE_LABEL,
  type CoachingDayAvailability,
  type PlanKey,
} from '@/lib/commerce/plans';
import { getSupabaseAdmin } from '@/lib/supabase/admin';
import { REFERRAL_COOKIE, normalizeCode, normalizeEmail } from '@/lib/commerce/referrals';
import { getServerEntitlement } from '@/lib/commerce/serverEntitlement';
import { COMPLETE_UPGRADE_PLAN, canUpgradeToComplete } from '@/lib/commerce/upgrade';

interface CheckoutBody {
  plan?: string;
  coachingDay?: string; // ISO date of the chosen coaching day, e.g. "2026-09-12"
}

/** How long a place is soft-held while the buyer is on Stripe checkout. */
const HOLD_MINUTES = 10;

/**
 * Read the `ff_ref` cookie and re-validate it against `referral_codes`
 * (must exist and be active). Returns the normalized code or null. Never
 * throws — any failure degrades to "no referral". Uses the strict service-role
 * client (referral_codes is RLS deny-all for anon): a missing service key
 * fails loudly in the logs here rather than silently dropping attribution.
 */
async function resolveReferralCode(): Promise<string | null> {
  try {
    const cookieStore = await cookies();
    const raw = cookieStore.get(REFERRAL_COOKIE)?.value;
    if (!raw) return null;
    const code = normalizeCode(raw);
    if (!code) return null;

    const { data, error } = await getSupabaseAdmin()
      .from('referral_codes')
      .select('code, active')
      .eq('code', code)
      .maybeSingle();

    if (error) {
      console.error('[checkout] referral code lookup failed', { code, error });
      return null;
    }
    return data?.active ? data.code : null;
  } catch (error: unknown) {
    console.error('[checkout] referral resolution error', error);
    return null;
  }
}

/**
 * Creates a Stripe Checkout session for a pre-order.
 * Body: { plan: 'self_study' | 'self_study_monthly' | 'complete' | 'complete_upgrade',
 *         coachingDay?: 'YYYY-MM-DD' }
 * Complete (and the upgrade) require a coaching day (unit of scarcity, max class
 * of 6) and soft-hold the place for 10 minutes while the buyer pays.
 * `self_study_monthly` opens a subscription session instead of a one-off payment.
 * `complete_upgrade` sells Complete at the £300 difference and is refused unless
 * the SERVER-side entitlement says the caller holds Self-Study.
 * A signed-in buyer's account email is pre-filled and locked on Stripe's page.
 * Returns: { url } to redirect the buyer to Stripe's hosted checkout.
 */
export async function POST(request: Request) {
  try {
    const body = (await request.json()) as CheckoutBody;

    // `complete_upgrade` is not a plan (see lib/commerce/upgrade.ts) — it is
    // Complete, bought at the difference by someone who already owns
    // Self-Study. Everything downstream treats it as Complete; only the Price
    // and the server-side gate differ.
    const isUpgrade = (body.plan ?? '') === COMPLETE_UPGRADE_PLAN;
    const plan = getPlan(isUpgrade ? 'complete' : body.plan ?? '');

    if (!plan || plan.cta !== 'checkout') {
      return NextResponse.json({ error: 'Invalid plan' }, { status: 400 });
    }

    // Who is buying. Purchases are matched to accounts BY EMAIL, so a signed-in
    // buyer's account address is stamped onto the session (and pre-filled +
    // locked on Stripe's page) — otherwise a different address at checkout buys
    // access that attaches to no account. Signed-out buyers are unaffected.
    const { user, entitlement, failedOpen } = await getServerEntitlement();
    const accountEmail = user?.email ? normalizeEmail(user.email) : null;

    if (isUpgrade) {
      if (!user) {
        return NextResponse.json({ error: 'Please sign in to upgrade' }, { status: 401 });
      }
      // A fail-open entitlement lookup means we do not KNOW what they hold, and
      // this endpoint sells Complete at half price. Refuse rather than guess.
      if (failedOpen) {
        return NextResponse.json(
          { error: "We couldn't check your current plan — please try again in a moment" },
          { status: 503 },
        );
      }
      if (!canUpgradeToComplete(entitlement)) {
        return NextResponse.json(
          { error: 'The upgrade price is for Self-Study customers — see the plans for your options' },
          { status: 403 },
        );
      }
    }

    // The upgrade buys the coaching day too, so it goes through the same picker.
    const needsCoachingDay = plan.key === 'complete';
    let coachingDay: CoachingDayAvailability | null = null;

    if (needsCoachingDay) {
      if (!body.coachingDay || !/^\d{4}-\d{2}-\d{2}$/.test(body.coachingDay)) {
        return NextResponse.json({ error: 'A coaching day is required' }, { status: 400 });
      }

      const supabase = getSupabaseAdmin();
      const { data, error } = await supabase
        .from('coaching_day_availability')
        .select('day, label, capacity, places_left, cutoff_at, status')
        .eq('day', body.coachingDay)
        .maybeSingle();

      if (error) {
        console.error('[checkout] coaching day lookup failed', error);
        return NextResponse.json({ error: 'Failed to validate coaching day' }, { status: 500 });
      }

      coachingDay = data as CoachingDayAvailability | null;
      if (!coachingDay || coachingDay.status === 'closed') {
        return NextResponse.json(
          { error: 'Bookings for this coaching day have closed — please choose another date' },
          { status: 409 },
        );
      }
      if (coachingDay.status === 'sold_out' || coachingDay.places_left <= 0) {
        return NextResponse.json(
          { error: `${coachingDay.label} is sold out — please choose another date` },
          { status: 409 },
        );
      }
    }

    // Attribution (cookie-only, v1): if a valid, still-active referral code was
    // dropped by /r/[code], carry it into the session metadata. Invalid or absent
    // codes degrade silently — checkout must never fail on a bad referral.
    // Upgrades are deliberately excluded from referral attribution: the buyer
    // is an existing customer, not a referred new one, and a £300 top-up would
    // fail the qualifying-spend floor anyway.
    const referralCode = isUpgrade ? null : await resolveReferralCode();

    // Two-sided referral: a valid code also buys the *referee* a discount. Stripe
    // rejects `discounts` and `allow_promotion_codes` on the same session, so a
    // referred checkout trades the promo-code box for the automatic discount —
    // the better deal of the two, and it removes the stack-a-100%-off-code vector
    // that MIN_QUALIFYING_SPEND_BY_PLAN exists to catch. With no coupon configured
    // this collapses to the previous behaviour: full price, promo box available.
    const refereeCoupon = referralCode ? stripeRefereeCouponIdFor(plan.key as PlanKey) : null;

    const origin = new URL(request.url).origin;
    const subscription = !isUpgrade && isSubscriptionPlan(plan.key);
    const productLine = isUpgrade
      ? `Upgrade to Complete (${COMPLETE_UPGRADE_PRICE_LABEL} difference from ${entitlement.plan === 'self_study_monthly' ? 'Self-Study monthly' : 'Self-Study'})`
      : `${plan.name} (pre-order; AI practice & lectures start 1 September 2026)`;
    const description = coachingDay
      ? `Fourteen Fisherman — ${productLine}, coaching day ${coachingDay.label}`
      : `Fourteen Fisherman — ${productLine}`;

    // The metadata block is the contract with the webhook: it reads plan (and
    // referral_code) off the session to record the order. Subscriptions repeat it
    // on `subscription_data` because renewal invoices arrive with the
    // subscription, long after the checkout session is out of reach.
    // Note `plan` is 'complete' even for an upgrade: the webhook derives the
    // preorder's plan straight from this field, and the row has to read
    // `complete` for the entitlement fold to grant lectures. `upgrade_from`
    // records what it was bought against, so a £300 order is never mistaken
    // for a £599 one in the ledger.
    const metadata = {
      plan: plan.key,
      ...(isUpgrade ? { upgrade_from: entitlement.plan ?? '' } : {}),
      // The account the buyer was signed into. The webhook files the purchase
      // under this address, whatever they typed on Stripe's page.
      ...(accountEmail ? { account_email: accountEmail } : {}),
      ...(coachingDay
        ? { coaching_day: coachingDay.day, coaching_day_label: coachingDay.label }
        : {}),
      ...(referralCode ? { referral_code: referralCode } : {}),
    };

    const stripe = getStripe();
    const session = await stripe.checkout.sessions.create({
      mode: subscription ? 'subscription' : 'payment',
      line_items: [
        { price: isUpgrade ? stripeCompleteUpgradePriceId() : stripePriceIdFor(plan.key as PlanKey), quantity: 1 },
      ],
      success_url: `${origin}/thanks?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: isUpgrade
        ? `${origin}/dashboard/upgrade`
        : coachingDay
          ? `${origin}/coaching-day`
          : `${origin}/#pricing`,
      // Stripe locks the email field when it is pre-filled, so a signed-in
      // buyer cannot pay under an address their account will never match.
      ...(accountEmail ? { customer_email: accountEmail } : {}),
      ...(user ? { client_reference_id: user.id } : {}),
      ...(refereeCoupon
        ? { discounts: [{ coupon: refereeCoupon }] }
        : { allow_promotion_codes: true }),
      metadata,
      // Stripe rejects payment_intent_data on a subscription session (there is no
      // one PaymentIntent — each cycle raises its own invoice).
      // Monthly charges on purchase, exactly like the one-off plans — it is a
      // pre-order either way, and the first payment is what starts the referral
      // reward moving. No trial: the buyer pays today and their month runs from
      // today. (Founder decision 2026-08-20.)
      ...(subscription
        ? { subscription_data: { description, metadata } }
        : { payment_intent_data: { description } }),
    });

    if (!session.url) {
      return NextResponse.json({ error: 'Failed to create checkout session' }, { status: 500 });
    }

    // Soft-hold the place while they pay. Best-effort: a failed hold must not
    // block checkout — the webhook still validates nothing structurally.
    if (coachingDay) {
      const { error: holdError } = await getSupabaseAdmin().from('checkout_holds').insert({
        coaching_day: coachingDay.day,
        stripe_session_id: session.id,
        expires_at: new Date(Date.now() + HOLD_MINUTES * 60 * 1000).toISOString(),
      });
      if (holdError) {
        console.error('[checkout] hold insert failed (non-fatal)', holdError);
      }
    }

    return NextResponse.json({ url: session.url });
  } catch (error: unknown) {
    console.error('[checkout] unexpected error', error);
    return NextResponse.json({ error: 'Failed to start checkout' }, { status: 500 });
  }
}
