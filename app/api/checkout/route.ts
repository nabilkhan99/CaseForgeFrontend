import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import type Stripe from 'stripe';
import { getStripe } from '@/lib/commerce/stripe';
import { countTrialConsumption, loadTrialGrant } from '@/lib/commerce/trialAccess';
import { checkoutModeFor, getPlan, stripePriceIdFor, type PlanKey } from '@/lib/commerce/plans';
import {
  coachingSessionCheckoutLine,
  coachingSessionLabel,
  isCoachingSlotKey,
  isIsoDate,
  type CoachingSlotKey,
} from '@/lib/commerce/coachingSlots';
import { getSupabaseAdmin } from '@/lib/supabase/admin';
import { REFERRAL_COOKIE, normalizeCode, normalizeEmail } from '@/lib/commerce/referrals';
import { getServerEntitlement } from '@/lib/commerce/serverEntitlement';
import { resolveOrCreateCustomerId } from '@/lib/commerce/stripeCustomer';
import { exactEmailPattern } from '@/lib/commerce/emailFilter';

interface CheckoutBody {
  plan?: string;
  /** Complete only: ISO date of the coaching session, e.g. "2026-11-07". */
  coachingDate?: unknown;
  /** Complete only: 'morning' | 'afternoon'. */
  coachingSlot?: unknown;
}

/** The coaching session a Complete checkout is for. */
interface CoachingBooking {
  date: string;
  slot: CoachingSlotKey;
}

/**
 * Stripe's minimum Checkout Session lifetime is 30 minutes from creation. The
 * extra minute covers the time between computing `expires_at` here and Stripe
 * receiving the create call, so a slow round trip cannot push the value under
 * Stripe's floor and fail the checkout.
 */
const SESSION_LIFETIME_MS = 30 * 60 * 1000 + 60 * 1000;

/**
 * The hold outlives the session by this much, so a buyer who submits payment
 * in the session's last seconds still owns the slot while the charge clears
 * and the webhook records the order. After it, the slot frees on its own even
 * if no webhook ever arrives.
 */
const HOLD_GRACE_MS = 10 * 60 * 1000;

const SESSION_REQUIRED_MESSAGE = 'Please choose a date and time for your coaching session.';
const SLOT_TAKEN_MESSAGE = 'That slot has just been booked. Please choose another.';
const SLOT_CLOSED_MESSAGE = 'Bookings for that date have closed. Please choose another.';

const PASSWORD_MESSAGE =
  "After payment we'll email you a link to set your password. That's how you get into the course.";

type UnclaimedOutcome = 'taken' | 'closed' | 'invalid' | 'error';

type ClaimResult = { outcome: 'held'; holdId: string } | { outcome: UnclaimedOutcome };

/** What the buyer is told when their slot could not be held. Nothing reaches Stripe. */
function unclaimedResponse(outcome: UnclaimedOutcome) {
  switch (outcome) {
    case 'taken':
      return NextResponse.json({ error: SLOT_TAKEN_MESSAGE, code: 'slot_taken' }, { status: 409 });
    case 'closed':
      return NextResponse.json({ error: SLOT_CLOSED_MESSAGE, code: 'slot_closed' }, { status: 409 });
    case 'invalid':
      return NextResponse.json({ error: SESSION_REQUIRED_MESSAGE }, { status: 400 });
    case 'error':
      // With one booking per slot there is no going ahead without a hold.
      return NextResponse.json(
        { error: 'We could not reserve your coaching session. Please try again.' },
        { status: 500 },
      );
  }
}

/**
 * Reserve the slot for this checkout, atomically. `claim_coaching_slot` locks
 * the date row, so of two buyers racing for one slot exactly one gets a hold.
 */
async function claimSlot(booking: CoachingBooking, holdExpiresAt: Date): Promise<ClaimResult> {
  const { data, error } = await getSupabaseAdmin().rpc('claim_coaching_slot', {
    p_day: booking.date,
    p_slot: booking.slot,
    p_expires_at: holdExpiresAt.toISOString(),
  });
  if (error) {
    console.error('[checkout] slot claim failed', { booking, error });
    return { outcome: 'error' };
  }

  // `returns table` comes back as an array of rows.
  const row = (Array.isArray(data) ? data[0] : data) as
    | { hold_id?: string | null; outcome?: string }
    | null
    | undefined;

  if (row?.outcome === 'held' && typeof row.hold_id === 'string' && row.hold_id) {
    return { outcome: 'held', holdId: row.hold_id };
  }
  if (row?.outcome === 'taken' || row?.outcome === 'closed' || row?.outcome === 'invalid') {
    return { outcome: row.outcome };
  }
  console.error('[checkout] slot claim returned an unexpected result', { booking, data });
  return { outcome: 'error' };
}

/** Give the slot back when no Stripe session came of the hold. */
async function deleteHold(holdId: string): Promise<void> {
  try {
    const { error } = await getSupabaseAdmin().from('checkout_holds').delete().eq('id', holdId);
    if (error) {
      // It still expires on its own; the slot is only held up until then.
      console.error('[checkout] could not release the hold (it will expire on its own)', {
        holdId,
        error,
      });
    }
  } catch (error: unknown) {
    console.error('[checkout] could not release the hold (it will expire on its own)', {
      holdId,
      error,
    });
  }
}

/**
 * Read the `ff_ref` cookie and re-validate it against `referral_codes`
 * (must exist and be active). Returns the normalized code or null. Never
 * throws: any failure degrades to "no referral". Uses the strict service-role
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
 * Creates a Stripe Checkout session.
 * Body: { plan: 'self_study' | 'self_study_monthly' | 'complete',
 *         coachingDate?: 'YYYY-MM-DD', coachingSlot?: 'morning' | 'afternoon' }
 *
 * The two course plans are one-off `payment` sessions; only the rolling monthly
 * plan is a `subscription` session (see lib/commerce/plans.ts).
 *
 * Complete comes with one 3 hour one to one coaching session, and each slot
 * takes exactly one booking. So a Complete checkout claims its slot BEFORE the
 * Stripe session exists, and a failed claim blocks the checkout outright: with
 * a capacity of one there is no such thing as a best-effort hold. The hold
 * lasts as long as the Stripe session plus a short grace period, and is released
 * early by the webhook (`checkout.session.expired`, `async_payment_failed`) or
 * by `POST /api/checkout/release` when the buyer comes back from Stripe. The
 * slot is only marked booked when the webhook records the paid order.
 *
 * A Self-Study customer moving up to Complete does NOT come through here; they
 * book their session afterwards via `POST /api/coaching-session/select`.
 *
 * A signed-in buyer's account email is pre-filled and locked on Stripe's page.
 * Returns: { url } to redirect the buyer to Stripe's hosted checkout.
 */
export async function POST(request: Request) {
  let holdId: string | null = null;
  try {
    const body = (await request.json()) as CheckoutBody;
    const plan = getPlan(body.plan ?? '');

    if (!plan || plan.cta !== 'checkout') {
      return NextResponse.json({ error: 'Invalid plan' }, { status: 400 });
    }

    let booking: CoachingBooking | null = null;
    if (plan.key === 'complete') {
      if (!isIsoDate(body.coachingDate) || !isCoachingSlotKey(body.coachingSlot)) {
        return NextResponse.json({ error: SESSION_REQUIRED_MESSAGE }, { status: 400 });
      }
      booking = { date: body.coachingDate, slot: body.coachingSlot };
    }

    // Who is buying. Purchases are matched to accounts BY EMAIL, so a signed-in
    // buyer's account address is stamped onto the session (and pre-filled +
    // locked on Stripe's page); otherwise a different address at checkout buys
    // access that attaches to no account. Signed-out buyers are unaffected.
    const { user, supabase } = await getServerEntitlement();
    const accountEmail = user?.email ? normalizeEmail(user.email) : null;

    // Attribution (cookie-only, v1): if a valid, still-active referral code was
    // dropped by /r/[code], carry it into the session metadata. Invalid or absent
    // codes degrade silently: checkout must never fail on a bad referral.
    const referralCode = await resolveReferralCode();

    // Referred buyers are NOT discounted here: they pay list price so their
    // receipt covers the whole course, and their side of the referral reaches
    // them afterwards as cash (see REFEREE_REWARD_BY_PLAN). That also keeps
    // Stripe's promo-code box available on every session. Stripe allows an
    // automatic discount or the code box, never both.

    const origin = new URL(request.url).origin;
    const stripe = getStripe();

    // Resolve the Customer ourselves. `customer_email` on a subscription
    // session mints a NEW customer per purchase; a repeat buyer would then own
    // two, and the Portal only ever opens on one of them. Done before the slot
    // is claimed, so a slow Stripe lookup never eats into the hold.
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

    // Both expiries are computed together, right before the claim, so the hold
    // always outlives the Stripe session it guards.
    const sessionExpiresAt = new Date(Date.now() + SESSION_LIFETIME_MS);
    const holdExpiresAt = new Date(sessionExpiresAt.getTime() + HOLD_GRACE_MS);

    if (booking) {
      const claim = await claimSlot(booking, holdExpiresAt);
      if (claim.outcome !== 'held') return unclaimedResponse(claim.outcome);
      holdId = claim.holdId;
    }

    const checkoutLine = booking ? coachingSessionCheckoutLine(booking.date, booking.slot) : null;

    // Complete is sold in payment mode, so this lands on the PaymentIntent and
    // Stripe's own receipt names the slot. A saved Price's line item text cannot
    // change per session, which is why the slot is spelled out here and in the
    // submit message rather than on the line item.
    const description = checkoutLine
      ? `The Complete SCA Course. ${checkoutLine}`
      : `Fourteen Fisherman, ${plan.name}`;

    // The metadata block is the contract with the webhook: it reads plan (and
    // referral_code, and the coaching session) off the session to record the
    // order. It is repeated on the PaymentIntent or the subscription because
    // refunds, renewals and cancellations arrive with those objects, long after
    // the checkout session is out of reach.
    const metadata: Stripe.MetadataParam = {
      plan: plan.key,
      // The account the buyer was signed into. The webhook files the purchase
      // under this address, whatever they typed on Stripe's page.
      ...(accountEmail ? { account_email: accountEmail } : {}),
      ...(user ? { supabase_user_id: user.id } : {}),
      ...(booking
        ? {
            coaching_date: booking.date,
            coaching_slot: booking.slot,
            coaching_session_label: coachingSessionLabel(booking.date, booking.slot),
          }
        : {}),
      ...(referralCode ? { referral_code: referralCode } : {}),
    };

    // One-off for the course terms, subscription for the rolling monthly. The
    // mode decides what Stripe's own page says: `payment` renders "Pay", while
    // `subscription` renders "Pay and subscribe ... until you cancel", which is
    // wrong for a course that does not renew. See lib/commerce/plans.ts.
    const mode = checkoutModeFor(plan.key);

    let session: Stripe.Checkout.Session;
    try {
      session = await stripe.checkout.sessions.create({
        mode,
        line_items: [{ price: stripePriceIdFor(plan.key as PlanKey), quantity: 1 }],
        success_url: `${origin}/thanks?session_id={CHECKOUT_SESSION_ID}`,
        // The booking page releases the hold when the buyer comes back, so the
        // slot is free again at once rather than when the hold runs out.
        cancel_url: holdId ? `${origin}/coaching-session?release=${holdId}` : `${origin}/#pricing`,
        // Complete only: the hold is sized to this, and Stripe fires
        // `checkout.session.expired` when it passes so the webhook frees the
        // slot. Other plans hold nothing and keep Stripe's default lifetime.
        ...(holdId ? { expires_at: Math.floor(sessionExpiresAt.getTime() / 1000) } : {}),
        // Stripe locks the email field when the Customer already has one, so a
        // signed-in buyer still cannot pay under an address their account will
        // never match. A signed-out buyer has no account to attach to, and
        // Checkout creates the Customer from what they type.
        ...(customerId
          ? { customer: customerId, customer_update: { name: 'auto', address: 'auto' as const } }
          : {}),
        ...(user ? { client_reference_id: user.id } : {}),
        allow_promotion_codes: true,
        // What the buyer is paying for, and what happens after. The coaching
        // session goes first so it is on the page before they pay. The password
        // line follows: an account is created for them from the email on this
        // page and the password is set from a link, and without saying so a
        // buyer lands on /thanks not knowing to go and look for it.
        custom_text: {
          submit: {
            message: checkoutLine ? `${checkoutLine}. ${PASSWORD_MESSAGE}` : PASSWORD_MESSAGE,
          },
        },
        metadata,
        // Renewal, cancellation and plan-change events arrive attached to the
        // SUBSCRIPTION, long after the session is out of reach, and carry neither
        // session metadata nor client_reference_id, so the rolling plan repeats
        // it there. A one-off has no such follow-up events; its metadata is put on
        // the PaymentIntent instead, which is what a later refund arrives with.
        ...(mode === 'subscription'
          ? { subscription_data: { description, metadata } }
          : { payment_intent_data: { description, metadata } }),
      });
    } catch (error: unknown) {
      console.error('[checkout] Stripe session create failed', { holdId, error });
      if (holdId) await deleteHold(holdId);
      return NextResponse.json({ error: 'Failed to start checkout' }, { status: 500 });
    }

    if (!session.url) {
      console.error('[checkout] Stripe returned a session with no url', { sessionId: session.id });
      if (holdId) await deleteHold(holdId);
      return NextResponse.json({ error: 'Failed to create checkout session' }, { status: 500 });
    }

    if (holdId) {
      // Ties the hold to the session so the webhook can release or retire it.
      // Not fatal on failure: the hold still expires on its own shortly after
      // the session does, and the release route handles an unlinked hold.
      const { error: linkError } = await getSupabaseAdmin()
        .from('checkout_holds')
        .update({ stripe_session_id: session.id })
        .eq('id', holdId);
      if (linkError) {
        console.error('[checkout] could not link the hold to its session (non-fatal)', {
          holdId,
          sessionId: session.id,
          error: linkError,
        });
      }
    }

    return NextResponse.json({ url: session.url });
  } catch (error: unknown) {
    console.error('[checkout] unexpected error', { holdId, error });
    return NextResponse.json({ error: 'Failed to start checkout' }, { status: 500 });
  }
}

/**
 * The trial context a buy-path event is tagged with, or null.
 *
 * WHY IT EXISTS. The baseline this whole five-station offer is measured
 * against is "78 verified leads → 4 paid, median ~5 days, 1 station before
 * purchase". Answering the same question about the new offer means every
 * `checkout_started` and `purchase` has to carry how much of the trial the
 * buyer had actually used when they decided. Neither number is knowable in the
 * browser: `trial_grants` is readable only by its owner and `session_results`
 * consumption is a join, so this is resolved server-side and handed to the
 * client that fires the event.
 *
 * Null for everybody with no grant, which is every cold buyer — so their
 * events keep exactly the shape and the properties they have today.
 */
export interface TrialFunnelProperties {
  /** Genuinely-marked consultations spent against the grant when the event fired. */
  trial_stations_used: number;
  /** Whole days since the first consultation; null while the window never opened. */
  days_since_first_station: number | null;
}

/**
 * GET /api/checkout — the buy path's event properties, for the signed-in user.
 *
 * Sits beside POST rather than in a route of its own because it answers a
 * question about this route's own event stream, and both halves need the same
 * service-role read. Deliberately reports the grant EVEN AFTER A PURCHASE,
 * which is where it differs from `/api/subscription`: that route hides the
 * trial the moment a plan outranks it (correctly — the dashboard must not
 * count down a trial over a plan somebody paid for), and the one event that
 * most needs the trial's numbers is the purchase itself.
 *
 * Never fails: an analytics property is not worth a 500 on the checkout route.
 */
export async function GET() {
  try {
    const { user } = await getServerEntitlement();
    if (!user) return NextResponse.json({ trial: null });

    const admin = getSupabaseAdmin();
    const grant = await loadTrialGrant(admin, user.id);
    if (!grant) return NextResponse.json({ trial: null });

    const used = await countTrialConsumption(admin, user.id, grant.createdAt);
    const trial: TrialFunnelProperties = {
      trial_stations_used: used,
      days_since_first_station: grant.startedAt
        ? Math.max(0, Math.floor((Date.now() - grant.startedAt.getTime()) / 86_400_000))
        : null,
    };
    return NextResponse.json({ trial });
  } catch (error: unknown) {
    console.error('[checkout] trial funnel properties lookup failed', error);
    return NextResponse.json({ trial: null });
  }
}
