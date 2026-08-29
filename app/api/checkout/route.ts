import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { getStripe } from '@/lib/commerce/stripe';
import {
  checkoutModeFor,
  getPlan,
  stripePriceIdFor,
  type CoachingDayAvailability,
  type PlanKey,
} from '@/lib/commerce/plans';
import { getSupabaseAdmin } from '@/lib/supabase/admin';
import { REFERRAL_COOKIE, normalizeCode, normalizeEmail } from '@/lib/commerce/referrals';
import { getServerEntitlement } from '@/lib/commerce/serverEntitlement';
import { resolveOrCreateCustomerId } from '@/lib/commerce/stripeCustomer';
import { exactEmailPattern } from '@/lib/commerce/emailFilter';

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
 * Body: { plan: 'self_study' | 'self_study_monthly' | 'complete',
 *         coachingDay?: 'YYYY-MM-DD' }
 *
 * ALL three plans open a `mode: 'subscription'` session (2026-08-22): the two
 * course plans are fixed-term subscriptions — one charge, a 3-month Stripe
 * period, and `cancel_at_period_end` armed by the webhook so nothing renews —
 * and the monthly plan rolls. Nothing is sold in `payment` mode any more, which
 * is what gives every customer a Stripe Customer, a Portal, and an invoice
 * whose printed service period doubles as study-budget evidence.
 *
 * Complete requires a coaching day (unit of scarcity, max class of 6) and
 * soft-holds the place for 10 minutes while the buyer pays. A Self-Study
 * customer moving up to Complete does NOT come through here — that is a Stripe
 * Portal plan switch (`POST /api/billing/portal`), priced by proration.
 *
 * A signed-in buyer's account email is pre-filled and locked on Stripe's page.
 * Returns: { url } to redirect the buyer to Stripe's hosted checkout.
 */
export async function POST(request: Request) {
  try {
    const body = (await request.json()) as CheckoutBody;
    const plan = getPlan(body.plan ?? '');

    if (!plan || plan.cta !== 'checkout') {
      return NextResponse.json({ error: 'Invalid plan' }, { status: 400 });
    }

    // Who is buying. Purchases are matched to accounts BY EMAIL, so a signed-in
    // buyer's account address is stamped onto the session (and pre-filled +
    // locked on Stripe's page) — otherwise a different address at checkout buys
    // access that attaches to no account. Signed-out buyers are unaffected.
    const { user, supabase } = await getServerEntitlement();
    const accountEmail = user?.email ? normalizeEmail(user.email) : null;

    const needsCoachingDay = plan.key === 'complete';
    let coachingDay: CoachingDayAvailability | null = null;

    if (needsCoachingDay) {
      if (!body.coachingDay || !/^\d{4}-\d{2}-\d{2}$/.test(body.coachingDay)) {
        return NextResponse.json({ error: 'A coaching day is required' }, { status: 400 });
      }

      const admin = getSupabaseAdmin();
      const { data, error } = await admin
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
    const referralCode = await resolveReferralCode();

    // Referred buyers are NOT discounted here: they pay list price so their
    // receipt covers the whole course, and their side of the referral reaches
    // them afterwards as cash (see REFEREE_REWARD_BY_PLAN). That also keeps
    // Stripe's promo-code box available on every session — Stripe allows an
    // automatic discount or the code box, never both.

    const origin = new URL(request.url).origin;
    const productLine = plan.name;
    const description = coachingDay
      ? `Fourteen Fisherman — ${productLine}, coaching day ${coachingDay.label}`
      : `Fourteen Fisherman — ${productLine}`;

    // The metadata block is the contract with the webhook: it reads plan (and
    // referral_code) off the session to record the order. It is repeated on
    // `subscription_data` because renewal, cancellation and plan-change events
    // arrive with the SUBSCRIPTION, long after the checkout session is out of
    // reach — and those events carry neither session metadata nor
    // client_reference_id.
    const metadata = {
      plan: plan.key,
      // The account the buyer was signed into. The webhook files the purchase
      // under this address, whatever they typed on Stripe's page.
      ...(accountEmail ? { account_email: accountEmail } : {}),
      ...(user ? { supabase_user_id: user.id } : {}),
      ...(coachingDay
        ? { coaching_day: coachingDay.day, coaching_day_label: coachingDay.label }
        : {}),
      ...(referralCode ? { referral_code: referralCode } : {}),
    };

    const stripe = getStripe();

    // Resolve the Customer ourselves. `customer_email` on a subscription
    // session mints a NEW customer per purchase; a repeat buyer would then own
    // two, and the Portal only ever opens on one of them.
    let customerId: string | null = null;
    if (accountEmail) {
      // A customer id we already recorded is the cheapest and most exact
      // answer. RLS ("read own purchases by email") scopes this select.
      const { data: rows } = await supabase
        .from('preorders')
        .select('stripe_customer_id, created_at')
        .ilike('email', exactEmailPattern(accountEmail))
        .order('created_at', { ascending: false });
      const known = (rows ?? []).find((r) => r.stripe_customer_id)?.stripe_customer_id ?? null;

      customerId = await resolveOrCreateCustomerId(stripe, {
        email: accountEmail,
        name: user?.user_metadata?.full_name ?? null,
        userId: user?.id ?? null,
        knownCustomerId: known,
      });
    }

    // One-off for the course terms, subscription for the rolling monthly. The
    // mode decides what Stripe's own page says: `payment` renders "Pay", while
    // `subscription` renders "Pay and subscribe ... until you cancel" — wrong
    // for a course that does not renew. See lib/commerce/plans.ts.
    const mode = checkoutModeFor(plan.key);

    const session = await stripe.checkout.sessions.create({
      mode,
      line_items: [{ price: stripePriceIdFor(plan.key as PlanKey), quantity: 1 }],
      success_url: `${origin}/thanks?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: coachingDay ? `${origin}/coaching-day` : `${origin}/#pricing`,
      // Stripe locks the email field when the Customer already has one, so a
      // signed-in buyer still cannot pay under an address their account will
      // never match. A signed-out buyer has no account to attach to, and
      // Checkout creates the Customer from what they type.
      ...(customerId
        ? { customer: customerId, customer_update: { name: 'auto', address: 'auto' as const } }
        : {}),
      ...(user ? { client_reference_id: user.id } : {}),
      allow_promotion_codes: true,
      // What happens after they pay. An account is created for them from the
      // email on this page and the password is set from a link — without saying
      // so, a buyer lands on /thanks not knowing to go and look for it, which is
      // the one step between paying and actually getting in.
      custom_text: {
        submit: {
          message:
            "After payment we'll email you a link to set your password — that's how you get into the course.",
        },
      },
      metadata,
      // Renewal, cancellation and plan-change events arrive attached to the
      // SUBSCRIPTION, long after the session is out of reach, and carry neither
      // session metadata nor client_reference_id — so the rolling plan repeats
      // it there. A one-off has no such follow-up events; its metadata is put on
      // the PaymentIntent instead, which is what a later refund arrives with.
      ...(mode === 'subscription'
        ? { subscription_data: { description, metadata } }
        : { payment_intent_data: { description, metadata } }),
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
