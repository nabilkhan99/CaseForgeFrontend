import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { getStripe } from '@/lib/commerce/stripe';
import { getPlan, stripePriceIdFor, type CoachingDayAvailability, type PlanKey } from '@/lib/commerce/plans';
import { getSupabaseAdmin } from '@/lib/supabase/admin';
import { REFERRAL_COOKIE, normalizeCode } from '@/lib/commerce/referrals';

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
 * Body: { plan: 'self_study' | 'complete', coachingDay?: 'YYYY-MM-DD' }
 * Complete requires a coaching day (unit of scarcity, max class of 6) and
 * soft-holds the place for 10 minutes while the buyer pays.
 * Returns: { url } to redirect the buyer to Stripe's hosted checkout.
 */
export async function POST(request: Request) {
  try {
    const body = (await request.json()) as CheckoutBody;
    const plan = getPlan(body.plan ?? '');

    if (!plan || plan.cta !== 'checkout') {
      return NextResponse.json({ error: 'Invalid plan' }, { status: 400 });
    }

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
    const referralCode = await resolveReferralCode();

    const origin = new URL(request.url).origin;
    const stripe = getStripe();
    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      line_items: [{ price: stripePriceIdFor(plan.key as PlanKey), quantity: 1 }],
      success_url: `${origin}/thanks?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: coachingDay ? `${origin}/coaching-day` : `${origin}/#pricing`,
      allow_promotion_codes: true,
      metadata: {
        plan: plan.key,
        ...(coachingDay
          ? { coaching_day: coachingDay.day, coaching_day_label: coachingDay.label }
          : {}),
        ...(referralCode ? { referral_code: referralCode } : {}),
      },
      payment_intent_data: {
        description: coachingDay
          ? `Fourteen Fisherman — ${plan.name}, coaching day ${coachingDay.label}`
          : `Fourteen Fisherman — ${plan.name}`,
      },
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
