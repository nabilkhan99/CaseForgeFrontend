import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import type Stripe from 'stripe';
import { getStripe } from '@/lib/commerce/stripe';
import {
  REFEREE_REWARD_BY_PLAN,
  REWARD_BY_PLAN,
  decideReferral,
  generateReferralCode,
  normalizeCode,
  normalizeEmail,
  parseMinSpendOverride,
  referralUrl,
} from '@/lib/commerce/referrals';
import { isFixedTermPlan, isRollingPlan, planForStripePriceId } from '@/lib/commerce/plans';
import { resolvePurchaseEmail } from '@/lib/commerce/buyerEmail';
import { sendReferralEmail } from '@/lib/email/referralEmail';
import { sendReceiptEmail } from '@/lib/email/receiptEmail';
import { sendSetPasswordEmail } from '@/lib/email/accountEmail';
import { issueReceipt } from '@/lib/receipts/issueReceipt';
import { paymentMethodLabel } from '@/lib/receipts/paymentMethod';
import { formatReceiptDate, isReceiptPlanKey } from '@/lib/receipts/receiptContent';
import { pushPreorderContactToBrevo } from '@/lib/marketing/preorderContact';
import { provisionBuyerAccount } from '@/lib/auth/provisionBuyer';

function getSupabaseAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  return createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } });
}

type SupabaseAdmin = ReturnType<typeof getSupabaseAdmin>;

/**
 * Stripe webhook.
 *
 * `checkout.session.completed` -> record the paid pre-order (drives the seat
 * counter), attribute any referral, mint the buyer's own advocate code +
 * invite email, and — because every plan is now a subscription — DISARM the
 * renewal on the two fixed-term course plans and record the Stripe billing
 * period. Every write is idempotent so Stripe retries are safe.
 *
 * `charge.refunded` -> void the linked referral on ANY genuine refund (partial
 * or full) so it can't be paid out; the pre-order is flipped to refunded only on
 * a full refund (a partially-refunded buyer still holds their seat). Refunds
 * tagged `purpose: referee_reward` are the buyer's own referral cashback and are
 * skipped entirely — see {@link isRefereeRewardRefund}.
 *
 * `customer.subscription.deleted` -> mark the order canceled. For a fixed-term
 * plan this is also the NORMAL end of a paid term, three months in.
 *
 * `customer.subscription.updated` -> refresh the recorded period, follow a
 * Customer Portal plan switch (the price id is the only evidence of it), re-arm
 * a renewal the customer un-cancelled in the Portal, and map status: canceled
 * when the subscription has reached a dead status, back to paid when a dead one
 * recovers. Dunning can leave a subscription `unpaid` forever without ever
 * emitting `deleted`, which would otherwise leave a failed card holding
 * permanent access — and paying that invoice revives it, which must not leave
 * the buyer locked out.
 *
 * `invoice.paid` -> a monthly renewal cleared; refresh the recorded period so
 * the settings page's "next payment" date follows Stripe.
 *
 * Ops: the Stripe webhook endpoint must have `charge.refunded`,
 * `customer.subscription.deleted`, `customer.subscription.updated` AND
 * `invoice.paid` enabled. Without the third, a subscription that dies by
 * dunning rather than by cancellation keeps its `paid` row and its entitlement.
 */
export async function POST(request: Request) {
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!secret) {
    console.error('[stripe-webhook] STRIPE_WEBHOOK_SECRET is not set');
    return NextResponse.json({ error: 'Webhook not configured' }, { status: 500 });
  }

  const signature = request.headers.get('stripe-signature');
  if (!signature) {
    return NextResponse.json({ error: 'Missing signature' }, { status: 400 });
  }

  let event: Stripe.Event;
  try {
    const payload = await request.text();
    event = await getStripe().webhooks.constructEventAsync(payload, signature, secret);
  } catch (error: unknown) {
    console.error('[stripe-webhook] signature verification failed', error);
    return NextResponse.json({ error: 'Invalid signature' }, { status: 400 });
  }

  const origin = new URL(request.url).origin;

  if (event.type === 'checkout.session.completed') {
    return handleCheckoutCompleted(
      event.data.object as Stripe.Checkout.Session,
      origin,
      // The event's own timestamp is the charge time, to the second, and it is
      // STABLE across Stripe's retries — unlike `Date.now()`, which would date
      // a redelivered receipt to whenever the retry landed. `session.created`
      // is when the customer opened Checkout, which can be a different day.
      new Date(event.created * 1000),
    );
  }
  if (event.type === 'charge.refunded') {
    return handleChargeRefunded(event.data.object as Stripe.Charge);
  }
  if (event.type === 'customer.subscription.deleted') {
    return handleSubscriptionDeleted(event.data.object as Stripe.Subscription);
  }
  if (event.type === 'customer.subscription.updated') {
    return handleSubscriptionUpdated(event.data.object as Stripe.Subscription);
  }
  if (event.type === 'invoice.paid') {
    return handleInvoicePaid(event.data.object as Stripe.Invoice, new Date(event.created * 1000));
  }

  return NextResponse.json({ received: true, ignored: event.type });
}

/** The billing period behind a subscription, as ISO strings. */
interface AccessPeriod {
  startsAt: string | null;
  endsAt: string | null;
}

/** Stripe timestamps are seconds; the DB columns are timestamptz. */
function isoFromUnix(seconds: number | null | undefined): string | null {
  return typeof seconds === 'number' && Number.isFinite(seconds)
    ? new Date(seconds * 1000).toISOString()
    : null;
}

/**
 * Read the current billing period off a subscription.
 *
 * `current_period_start` / `current_period_end` moved from the Subscription to
 * the SubscriptionItem in API 2025-03-31.basil, and this SDK pins
 * 2026-06-24.dahlia — but a webhook payload is rendered at the ENDPOINT's API
 * version, which may still be older and still carry the top-level fields. Read
 * the item first, fall back to the legacy shape.
 */
function readAccessPeriod(subscription: Stripe.Subscription): AccessPeriod {
  const item = subscription.items?.data?.[0];
  const legacy = subscription as unknown as {
    current_period_start?: number;
    current_period_end?: number;
  };
  return {
    startsAt: isoFromUnix(item?.current_period_start ?? legacy.current_period_start),
    endsAt: isoFromUnix(item?.current_period_end ?? legacy.current_period_end),
  };
}

/**
 * The PaymentIntent that actually paid for this subscription's first invoice.
 *
 * `charge.refunded` is matched to a pre-order on `stripe_payment_intent_id`,
 * and that column used to be filled straight from the checkout session. It
 * cannot be any more: `Session.payment_intent` is documented as "the ID of the
 * PaymentIntent for Checkout Sessions in `payment` mode" and is null in
 * `subscription` mode — which, since the migration, is every sale. Left null,
 * a refund matches nothing: the buyer keeps their access and the referral
 * reward behind the refunded purchase is never voided.
 *
 * So the id is read back off the subscription's latest invoice (requested with
 * `expand: ['latest_invoice.payments']`). The invoice's DEFAULT payment is the
 * one Stripe keeps in step with the amount due; a retry after a decline adds
 * another, and matching the first charge is what a refund needs.
 */
function readInvoicePaymentIntentId(subscription: Stripe.Subscription): string | null {
  const invoice = subscription.latest_invoice;
  if (!invoice || typeof invoice === 'string') return null;

  const payments = invoice.payments?.data ?? [];
  const chosen = payments.find((p) => p.is_default) ?? payments[0];
  const intent = chosen?.payment?.payment_intent;
  if (intent) return typeof intent === 'string' ? intent : intent.id;

  // Webhook payloads render at the ENDPOINT's API version, which may predate
  // the move of the payment off the Invoice and onto InvoicePayment.
  const legacy = (invoice as unknown as { payment_intent?: string | { id: string } })
    .payment_intent;
  if (!legacy) return null;
  return typeof legacy === 'string' ? legacy : legacy.id;
}

/**
 * Is this subscription already set to stop at the end of its period?
 *
 * Under flexible billing mode (the default from 2025-09-30.clover onward, so
 * ours) Stripe's own guidance is to read `cancel_at`; `cancel_at_period_end` is
 * the classic-mode signal. Read both so neither mode can make us re-arm a
 * subscription that is already disarmed — or, worse, leave one armed-looking
 * and renewing.
 */
function isCancelScheduled(subscription: Stripe.Subscription): boolean {
  return subscription.cancel_at !== null || subscription.cancel_at_period_end === true;
}

/** The plan a subscription currently sells, from its first item's price id. */
function planFromSubscription(subscription: Stripe.Subscription): string | null {
  const price = subscription.items?.data?.[0]?.price;
  const priceId = typeof price === 'string' ? price : (price?.id ?? null);
  const plan = planForStripePriceId(priceId);
  if (!plan && priceId) {
    // Loud: a price we do not recognise means either a rotated Price id or a
    // Portal configuration listing something we do not sell. Either way the
    // row's plan is left alone rather than rewritten to a guess.
    console.error('[stripe-webhook] unknown price id on subscription — plan left unchanged', {
      subscriptionId: subscription.id,
      priceId,
    });
  }
  return plan;
}

/**
 * Has the subscription's latest invoice actually been paid?
 *
 * This is the gate on following a Customer Portal plan switch. The Portal
 * prorates with `always_invoice`, which raises the difference as an invoice and
 * attempts it immediately — and `customer.subscription.updated` carries the NEW
 * price whether or not that attempt succeeded. Following the price blindly
 * would hand a customer whose card was declined the Complete plan for nothing:
 * the row would read `complete` while the subscription sat `past_due`, a status
 * the status arm deliberately leaves alone.
 *
 * Deliberately false for an unexpanded `latest_invoice` (a bare id) and for a
 * subscription with none at all. "Cannot verify" must read the same as "not
 * paid" here — the caller's fallback is to leave the row alone and let the
 * later `invoice.paid` deliver the change, which is the safe direction.
 */
function isLatestInvoicePaid(subscription: Stripe.Subscription): boolean {
  const invoice = subscription.latest_invoice;
  if (!invoice || typeof invoice === 'string') return false;
  return invoice.status === 'paid';
}

/**
 * What the subscription's current price charges per period, in pence.
 *
 * Recorded alongside a plan change so `preorders.amount` — which the admin
 * ledger reads as revenue — does not still say £299 after someone moved up to
 * Complete. Only ever written on an actual plan change: rewriting it on every
 * renewal would overwrite a referral-discounted amount with the list price.
 */
function priceAmountPence(subscription: Stripe.Subscription): number | null {
  const price = subscription.items?.data?.[0]?.price;
  if (!price || typeof price === 'string') return null;
  return typeof price.unit_amount === 'number' ? price.unit_amount : null;
}

/**
 * Fixed-term plans are sold as "one payment, three months, nothing renews", and
 * Stripe Checkout cannot express that: `subscription_data` has no `cancel_at`
 * or `cancel_at_period_end` in API 2026-06-24.dahlia. So the flag is set here,
 * the moment the subscription exists.
 *
 * Idempotent by inspection — an already-disarmed subscription is left alone, so
 * a Stripe retry costs one read and no write. Returns false only when the call
 * itself failed, which is a money bug (the customer would be charged again in
 * three months) and is therefore worth a webhook 500 and Stripe's retries.
 */
async function armFixedTermCancellation(subscription: Stripe.Subscription): Promise<boolean> {
  if (isCancelScheduled(subscription)) return true;
  try {
    await getStripe().subscriptions.update(subscription.id, { cancel_at_period_end: true });
    return true;
  } catch (error: unknown) {
    console.error('[stripe-webhook] CRITICAL: could not disarm renewal on a fixed-term plan', {
      subscriptionId: subscription.id,
      error,
    });
    return false;
  }
}

/**
 * Write the subscription's period (and, when it changed, its plan) onto the
 * matching pre-order row.
 *
 * Keyed on `stripe_subscription_id`, not on the session, because everything
 * after checkout — renewals, Portal plan switches, cancellations — arrives with
 * the subscription and nothing else. Refunded rows are excluded: a refund is a
 * decision about the order, and a late subscription event must not undo it.
 *
 * Two writes, not one, because they have different preconditions. The period is
 * safe to re-stamp on any row. The plan is not: it drags `amount` with it, and
 * `amount` is what the buyer was actually charged — a referred customer paid
 * £199, not the £299 list price. So the plan write is narrowed to rows whose
 * plan is genuinely changing, which is the only time `amount` should move.
 */
async function writeSubscriptionState(
  supabase: SupabaseAdmin,
  subscriptionId: string,
  values: {
    period?: AccessPeriod;
    plan?: string | null;
    amountPence?: number | null;
    paymentIntentId?: string | null;
  },
): Promise<'ok' | 'failed'> {
  const patch: Record<string, string> = {};
  if (values.period?.startsAt) patch.access_starts_at = values.period.startsAt;
  if (values.period?.endsAt) patch.access_ends_at = values.period.endsAt;
  if (values.paymentIntentId) patch.stripe_payment_intent_id = values.paymentIntentId;

  if (Object.keys(patch).length > 0) {
    const { error } = await supabase
      .from('preorders')
      .update(patch)
      .eq('stripe_subscription_id', subscriptionId)
      .neq('status', 'refunded');
    if (error) {
      console.error('[stripe-webhook] subscription state write failed', { subscriptionId, error });
      return 'failed';
    }
  }

  if (!values.plan) return 'ok';

  const planPatch: Record<string, string | number> = { plan: values.plan };
  if (typeof values.amountPence === 'number') planPatch.amount = values.amountPence;

  const { error: planError } = await supabase
    .from('preorders')
    .update(planPatch)
    .eq('stripe_subscription_id', subscriptionId)
    .neq('status', 'refunded')
    // The whole point of the second write: a row already on this plan is not
    // changing plan, so its `amount` must be left exactly as it was charged.
    .neq('plan', values.plan);

  if (planError) {
    console.error('[stripe-webhook] subscription plan write failed', { subscriptionId, error: planError });
    return 'failed';
  }
  return 'ok';
}

async function handleCheckoutCompleted(
  session: Stripe.Checkout.Session,
  origin: string,
  chargedAt: Date,
) {
  if (session.payment_status !== 'paid') {
    // Async payment methods settle later via checkout.session.async_payment_succeeded;
    // card payments (our case) are always 'paid' here.
    return NextResponse.json({ received: true, deferred: session.id });
  }

  // Which account this purchase belongs to. Entitlements match by email, so
  // this is the single field that decides whether the buyer can use what they
  // paid for. A signed-in checkout stamps `account_email` on the session;
  // whatever Stripe collected on its own page loses to it (case-only
  // differences are just normalised — see lib/commerce/buyerEmail.ts).
  const resolvedEmail = resolvePurchaseEmail({
    stripeEmail: session.customer_details?.email ?? session.customer_email,
    accountEmail: session.metadata?.account_email,
  });
  if (resolvedEmail.mismatch) {
    // Loud on purpose: the buyer paid under an address that is not the account
    // they were signed into. We file it under the account (never strand them),
    // but somebody should know the Stripe receipt and the access disagree.
    console.error('[stripe-webhook] checkout email differs from the signed-in account', {
      sessionId: session.id,
      stripeEmail: session.customer_details?.email ?? session.customer_email,
      accountEmail: session.metadata?.account_email,
      recordedAs: resolvedEmail.email,
    });
  }
  const email = resolvedEmail.email;
  const plan = session.metadata?.plan;
  const coachingDay = session.metadata?.coaching_day ?? null;
  const intakeMonth = session.metadata?.intake_month ?? null; // legacy sessions
  const needsCoachingDay = plan === 'complete';

  if (!email || !plan || (needsCoachingDay && !coachingDay && !intakeMonth)) {
    console.error('[stripe-webhook] session missing required fields', {
      sessionId: session.id,
      hasEmail: Boolean(email),
      plan,
      coachingDay,
      intakeMonth,
    });
    // 200 so Stripe doesn't retry forever — this needs manual follow-up, not retries.
    return NextResponse.json({ received: true, error: 'missing_fields', sessionId: session.id });
  }

  const supabase = getSupabaseAdmin();

  // The hold's job ends with the session: the paid preorder now occupies the
  // place, so drop the hold rather than double-counting until it expires.
  const { error: holdError } = await supabase
    .from('checkout_holds')
    .delete()
    .eq('stripe_session_id', session.id);
  if (holdError) {
    console.error('[stripe-webhook] hold release failed (non-fatal)', { sessionId: session.id, error: holdError });
  }

  const buyerEmail = email; // already normalized by resolvePurchaseEmail
  const buyerName = session.customer_details?.name ?? null;
  const referralCode = session.metadata?.referral_code
    ? normalizeCode(session.metadata.referral_code)
    : null;

  // ── 1. Record the pre-order (idempotent on stripe_session_id) ──
  const { data: inserted, error: insertError } = await supabase
    .from('preorders')
    .insert({
      email: buyerEmail,
      full_name: buyerName,
      plan,
      coaching_day: coachingDay,
      intake_month: intakeMonth,
      amount: session.amount_total ?? 0,
      currency: session.currency ?? 'gbp',
      stripe_session_id: session.id,
      stripe_customer_id:
        typeof session.customer === 'string' ? session.customer : (session.customer?.id ?? null),
      stripe_payment_intent_id:
        typeof session.payment_intent === 'string'
          ? session.payment_intent
          : (session.payment_intent?.id ?? null),
      // Set for every plan now. Renewal, cancellation and plan-change events
      // arrive attached to the subscription, not the checkout session, so this
      // is the handle back here.
      stripe_subscription_id:
        typeof session.subscription === 'string'
          ? session.subscription
          : (session.subscription?.id ?? null),
      status: 'paid',
      referral_code: referralCode,
    })
    .select('id')
    .single();

  let preorderId = inserted?.id ?? null;
  // True only when THIS call created the row. The 23505 path below (a Stripe
  // webhook retry) leaves it false, so the buyer is never emailed twice.
  const isNewPreorder = Boolean(inserted?.id);

  if (insertError) {
    if (insertError.code !== '23505') {
      console.error('[stripe-webhook] preorder insert failed', { sessionId: session.id, error: insertError });
      return NextResponse.json({ error: 'Failed to record preorder' }, { status: 500 });
    }
    // Duplicate stripe_session_id (webhook retry). Do NOT early-return — a prior
    // attempt may have crashed before writing the referral. Fetch the id and continue.
    const { data: existing } = await supabase
      .from('preorders')
      .select('id')
      .eq('stripe_session_id', session.id)
      .maybeSingle();
    preorderId = existing?.id ?? null;
  }

  // Referral attribution: a genuine DB failure here returns 500 so Stripe
  // retries — every write in this handler is idempotent, so the retry is safe
  // and recovers the attribution instead of silently dropping it.
  if (preorderId) {
    const recorded = await recordReferral(supabase, {
      referralCode,
      preorderId,
      refereeEmail: buyerEmail,
      plan,
      amount: session.amount_total ?? 0,
    });
    if (recorded === 'failed') {
      return NextResponse.json({ error: 'Failed to record referral' }, { status: 500 });
    }
  }

  // Buyers do NOT become referrers by default (founder decision 2026-07-24):
  // referrers are deliberate affiliates issued from the admin dashboard, not
  // every customer. Set REFERRAL_BUYERS_BECOME_ADVOCATES=true to mint each
  // buyer their own code (the invite email is separately gated below).
  // Advocate minting is best-effort either way: never fail the webhook.
  try {
    if (process.env.REFERRAL_BUYERS_BECOME_ADVOCATES === 'true') {
      await mintAdvocateAndInvite(supabase, { email: buyerEmail, name: buyerName, origin });
    }
  } catch (error: unknown) {
    console.error('[stripe-webhook] advocate minting error', { sessionId: session.id, error });
  }

  // Stripe only emails a card receipt when the PaymentIntent carries a
  // receipt_email. Checkout collects the address on Stripe's own page, so it
  // cannot be set when the session is created — it is set here, once the
  // address is known. Gated on isNewPreorder so a webhook retry cannot trigger
  // a second receipt.
  //
  // In `subscription` mode the session carries no payment_intent, so this is
  // now a no-op for our own plans and the receipt comes from the INVOICE
  // instead (Dashboard -> Emails -> "Successful payments" must be on, or the
  // confirmation email's "your card receipt comes separately from Stripe" is
  // a promise nothing keeps). Kept for any legacy `payment`-mode session still
  // in flight.
  if (isNewPreorder) {
    const paymentIntentId =
      typeof session.payment_intent === 'string'
        ? session.payment_intent
        : (session.payment_intent?.id ?? null);
    if (paymentIntentId) {
      try {
        await getStripe().paymentIntents.update(paymentIntentId, { receipt_email: buyerEmail });
      } catch (error: unknown) {
        // Best-effort: a missing receipt must never fail the webhook, or the
        // pre-order would be re-processed on Stripe's retry.
        console.error('[stripe-webhook] receipt_email update failed (non-fatal)', {
          sessionId: session.id,
          error,
        });
      }
    }
  }

  // Brevo pre-order contact sync. Gated on isNewPreorder so this only runs for a
  // genuinely NEW pre-order; a Stripe webhook retry takes the 23505 duplicate
  // path. Best-effort: never fail the webhook.
  //
  // The purchase-confirmation email that used to sit here is GONE. It has been
  // folded into the receipt email that provisioning sends below, so a buyer gets
  // one mail carrying the receipt AND the setup link, rather than two arriving
  // seconds apart between which the only required action got lost.
  if (isNewPreorder) {
    try {
      await pushPreorderContactToBrevo({
        email: buyerEmail,
        fullName: buyerName,
        planKey: plan,
        coachingDayLabel: session.metadata?.coaching_day_label ?? null,
        amountPence: session.amount_total ?? 0,
      });
    } catch (error: unknown) {
      console.error('[stripe-webhook] preorder contact sync threw', { sessionId: session.id, error });
    }
  }

  // The subscription half of the sale, and — for the rolling plan — the billing
  // period the receipt has to print.
  //
  // Moved AHEAD of provisioning (it used to be the last thing in this handler)
  // because the monthly receipt cannot be rendered without the period, and a
  // receipt that says "Billing period [start date] to [end date]" is not a
  // receipt. Nothing else moves with it: only the rolling plan carries a
  // subscription at all, the two course plans are one-off `payment` sessions.
  //
  // It is still the one step that can legitimately ask Stripe to retry the whole
  // delivery, and doing that here is strictly safer than doing it at the end:
  // everything above is idempotent and replays for free, and the buyer is not
  // emailed until it has succeeded. Before, a sync failure 500'd AFTER the mail
  // had already gone.
  const subscriptionId =
    typeof session.subscription === 'string'
      ? session.subscription
      : (session.subscription?.id ?? null);

  let period: AccessPeriod | undefined;
  if (subscriptionId) {
    const synced = await syncCheckoutSubscription(supabase, subscriptionId, plan);
    if (synced.status === 'failed') {
      return NextResponse.json({ error: 'Failed to finalise subscription' }, { status: 500 });
    }
    period = synced.period;
  } else if (isRollingPlan(plan)) {
    // A rolling plan with no subscription IS broken — it can never renew, and
    // no cancel/recover event will ever find this order.
    console.error('[stripe-webhook] rolling plan session carried no subscription', {
      sessionId: session.id,
      plan,
    });
  }

  // Account + receipt, as one delivery. `provisionBuyerAccount` decides whether
  // anything is owed at all (and holds the lock that makes sure only one Stripe
  // delivery sends); this callback is what gets sent when it is.
  if (preorderId) {
    await provisionBuyerAccount(supabase, {
      preorderId,
      email: buyerEmail,
      name: buyerName,
      sessionId: session.id,
      deliver: ({ setupUrl }) =>
        deliverPurchaseReceipt(supabase, {
          session,
          preorderId,
          plan,
          buyerEmail,
          buyerName,
          chargedAt,
          period,
          setupUrl,
        }),
    });
  }

  return NextResponse.json({ received: true, recorded: !insertError, preorderId });
}

/**
 * No receipt could be produced — send the buyer their account link anyway.
 *
 * The failure this exists for is not exotic: deploy this code before running
 * the receipts migration and `issue_receipt` does not exist, so EVERY buyer
 * gets a null receipt. Without a fallback each one would be sent nothing at
 * all, the send stamp would be handed back, and Stripe would retry the same
 * failure for three days and then stop — leaving a paying customer with no
 * account and no email. That is strictly worse than the two-email flow this
 * replaced, and it is the one regression worth defending against.
 *
 * So the buyer gets the plain set-password email (the same one the self-serve
 * resend sends) and the send is marked done. Account access is the urgent half
 * and it is restored immediately; the receipt is owed and is logged loudly
 * enough to find — every row is still recorded in `preorders`, so it can be
 * issued by hand afterwards.
 *
 * With no link either there is genuinely nothing useful to send, so it reports
 * a failure and lets Stripe's retry have another go.
 */
async function sendAccountEmailInstead(
  args: DeliverPurchaseReceiptArgs & { reason: string },
): Promise<{ sent: boolean; error?: string }> {
  const { session, buyerEmail, buyerName, setupUrl, reason } = args;

  if (!setupUrl) {
    console.error('[stripe-webhook] CRITICAL: no receipt AND no setup link — buyer got nothing', {
      sessionId: session.id,
      reason,
    });
    return { sent: false, error: reason };
  }

  console.error('[stripe-webhook] CRITICAL: sent the account email with NO receipt — this buyer is owed one', {
    sessionId: session.id,
    email: buyerEmail,
    reason,
  });

  const result = await sendSetPasswordEmail({
    toEmail: buyerEmail,
    toName: buyerName,
    setPasswordUrl: setupUrl,
  });
  return result.sent ? { sent: true } : { sent: false, error: result.skipped };
}

interface DeliverPurchaseReceiptArgs {
  session: Stripe.Checkout.Session;
  preorderId: string;
  plan: string;
  buyerEmail: string;
  buyerName: string | null;
  chargedAt: Date;
  period?: AccessPeriod;
  setupUrl: string | null;
}

/**
 * The one email a buyer gets when they pay: receipt PDF attached, account setup
 * link as the button.
 *
 * Called from inside `provisionBuyerAccount`, which has already decided that a
 * send is owed and taken the lock for it, so this never has to ask "again?" —
 * and the receipt number it allocates is keyed on the checkout session id, so
 * even a delivery that somehow slipped the lock would reprint the SAME number
 * rather than burn a new one.
 *
 * Returns `{ sent: false }` rather than throwing on every failure path: the
 * caller hands the send stamp back on a false, which is what lets Stripe's next
 * retry pick the buyer up again.
 */
async function deliverPurchaseReceipt(
  supabase: SupabaseAdmin,
  args: DeliverPurchaseReceiptArgs,
): Promise<{ sent: boolean; error?: string }> {
  const { session, preorderId, plan, buyerEmail, buyerName, chargedAt, period, setupUrl } = args;

  if (!isReceiptPlanKey(plan)) {
    // Intensive, or a plan key we do not sell through Checkout. Unreachable
    // today — /api/checkout rejects anything whose cta is not 'checkout' — but
    // inventing a template would be worse than falling back.
    console.error('[stripe-webhook] no receipt template for this plan', {
      sessionId: session.id,
      plan,
    });
    return sendAccountEmailInstead({ ...args, reason: 'no_receipt_template' });
  }

  const coachingDayLabel = session.metadata?.coaching_day_label ?? null;
  const periodStart = period?.startsAt ? new Date(period.startsAt) : null;
  const periodEnd = period?.endsAt ? new Date(period.endsAt) : null;

  const receipt = await issueReceipt(supabase, {
    // Idempotency key. Same session, same number, every time.
    stripeEventKey: session.id,
    preorderId,
    email: buyerEmail,
    customerName: buyerName,
    planKey: plan,
    amountPence: session.amount_total ?? 0,
    currency: session.currency ?? 'gbp',
    paymentMethod: paymentMethodLabel(session.payment_method_types),
    paidAt: chargedAt,
    periodStart,
    periodEnd,
    coachingDayLabel,
    kind: 'purchase',
  });

  if (!receipt) return sendAccountEmailInstead({ ...args, reason: 'receipt_unavailable' });

  const result = await sendReceiptEmail({
    toEmail: buyerEmail,
    toName: buyerName,
    firstName: buyerName,
    planKey: plan,
    sessionDate: coachingDayLabel,
    // The renewal date and amount, which the monthly buyer is entitled to be
    // told before the second charge lands.
    nextBillingDate: receipt.periodEnd ? formatReceiptDate(receipt.periodEnd) : null,
    hasSetupLink: Boolean(setupUrl),
    setupUrl,
    pdf: receipt.pdf,
    fileName: receipt.fileName,
  });

  return { sent: result.sent, error: result.error ?? result.skipped };
}

/**
 * Finish a completed checkout on the Stripe side: stop a fixed-term plan
 * renewing, and record the billing period the access window is derived from.
 *
 * Returns 'failed' — and so a webhook 500 — when Stripe could not be reached or
 * the renewal could not be disarmed. Both are worth retrying: the alternative
 * to a retry is a customer charged £299 again in three months.
 */
async function syncCheckoutSubscription(
  supabase: SupabaseAdmin,
  subscriptionId: string,
  plan: string,
): Promise<{ status: 'ok' | 'failed'; period?: AccessPeriod }> {
  let subscription: Stripe.Subscription;
  try {
    // The invoice comes back with it because the PaymentIntent that paid it is
    // the only handle a later `charge.refunded` has on this order — see
    // readInvoicePaymentIntentId.
    subscription = await getStripe().subscriptions.retrieve(subscriptionId, {
      expand: ['latest_invoice.payments'],
    });
  } catch (error: unknown) {
    console.error('[stripe-webhook] subscription retrieve failed', { subscriptionId, error });
    return { status: 'failed' };
  }

  if (isFixedTermPlan(plan) && !(await armFixedTermCancellation(subscription))) {
    return { status: 'failed' };
  }

  const paymentIntentId = readInvoicePaymentIntentId(subscription);
  if (!paymentIntentId) {
    // Not fatal — the period, and so the entitlement, is still recorded. But a
    // refund of this order will not find it, so somebody should know.
    console.error('[stripe-webhook] no payment intent on the first invoice — a refund of this order will not match', {
      subscriptionId,
    });
  }

  const period = readAccessPeriod(subscription);
  const status = await writeSubscriptionState(supabase, subscriptionId, {
    period,
    paymentIntentId,
  });
  return { status, period };
}

/**
 * Subscription ended (cancelled by the buyer, or after failed payments).
 *
 * Marks the order canceled so the admin dashboard stops counting it as live
 * revenue. A referral already credited is deliberately left alone — it was
 * earned by a payment that actually cleared; later churn is a normal outcome,
 * not a clawback. Refunds still void referrals through `charge.refunded`.
 */
async function handleSubscriptionDeleted(subscription: Stripe.Subscription) {
  const supabase = getSupabaseAdmin();
  const { data: updated, error } = await supabase
    .from('preorders')
    .update({ status: 'canceled' })
    .eq('stripe_subscription_id', subscription.id)
    .eq('status', 'paid')
    .select('id');

  if (error) {
    console.error('[stripe-webhook] subscription cancel update failed', {
      subscriptionId: subscription.id,
      error,
    });
    return NextResponse.json({ error: 'Failed to process cancellation' }, { status: 500 });
  }

  return NextResponse.json({ received: true, canceled: updated?.length ?? 0 });
}

/**
 * Subscription is dead for our purposes. `past_due` is deliberately NOT here —
 * Stripe is still retrying the card and the buyer still has access, which is
 * the behaviour we want during dunning.
 *
 * `unpaid` is here but is NOT terminal at Stripe's end (see below).
 */
const DEAD_SUBSCRIPTION_STATUSES: ReadonlySet<string> = new Set([
  'canceled',
  'unpaid',
  'incomplete_expired',
]);

/** Subscription is billing normally: the customer should have access. */
const LIVE_SUBSCRIPTION_STATUSES: ReadonlySet<string> = new Set(['active', 'trialing']);

/**
 * A dead subscription came back to life.
 *
 * `unpaid` is a dead end for us but not for Stripe: paying the outstanding
 * invoice moves the subscription back to `active` and emits an `updated` event.
 * Without this arm nothing in the codebase ever writes `paid` onto a preorder
 * row again after the original insert, so a customer who settles their bill
 * keeps being charged monthly while their row stays `canceled` and their
 * entitlement stays read-only — permanently, with no self-service way back.
 *
 * Idempotent, and narrow on purpose: only rows currently `canceled` are
 * touched, so this can never resurrect a `refunded` purchase or re-stamp a row
 * that is already `paid`.
 */
async function handleSubscriptionRecovered(subscription: Stripe.Subscription) {
  const supabase = getSupabaseAdmin();
  const { data: updated, error } = await supabase
    .from('preorders')
    .update({ status: 'paid' })
    .eq('stripe_subscription_id', subscription.id)
    .eq('status', 'canceled')
    .select('id');

  if (error) {
    console.error('[stripe-webhook] subscription recovery update failed', {
      subscriptionId: subscription.id,
      error,
    });
    return NextResponse.json({ error: 'Failed to process recovery' }, { status: 500 });
  }

  return NextResponse.json({ received: true, recovered: updated?.length ?? 0 });
}

/**
 * Subscription changed. Three things matter.
 *
 * 1. The period and the plan. A Customer Portal upgrade swaps the subscription's
 *    Price in place, and this event carries NO session metadata — the price id
 *    is the only evidence that a Self-Study customer is now on Complete. The
 *    row's plan is updated in place, so the entitlement fold sees one purchase
 *    rather than two competing ones.
 * 2. The renewal flag. The Portal shows a "don't cancel" affordance on a
 *    subscription scheduled to end, and there is no configuration flag to hide
 *    it. If a fixed-term customer clicks it, re-arm — "nothing renews" is a
 *    promise the product makes on the pricing page.
 * 3. Status, in both directions. Downwards: depending on the dunning settings, a
 *    subscription whose card keeps failing can end up `unpaid` and simply stay
 *    there — `customer.subscription.deleted` never fires, and the row would keep
 *    its `paid` status (and therefore full access) forever. Upwards: that same
 *    `unpaid` subscription becomes `active` again the moment the invoice is
 *    paid, and the row has to follow it back.
 *
 * Everything in between (`past_due`, `incomplete`) leaves status alone: the
 * buyer's access is unchanged while Stripe works it out.
 */
async function handleSubscriptionUpdated(delivered: Stripe.Subscription) {
  // Re-read rather than trust the payload. Two reasons: the delivered object
  // carries `latest_invoice` as a bare id, and whether that invoice is PAID is
  // what decides if a Portal plan switch may be followed (see
  // isLatestInvoicePaid); and Stripe does not guarantee delivery order, so a
  // late event would otherwise write a status the subscription has moved on
  // from. A failed re-read falls back to the payload — the status arm still
  // has to run — and the unexpanded invoice then holds the plan remap back,
  // which is the safe direction.
  const subscription = await resolveSubscription(delivered);

  await syncSubscription(subscription);

  if (DEAD_SUBSCRIPTION_STATUSES.has(subscription.status)) {
    return handleSubscriptionDeleted(subscription);
  }
  if (LIVE_SUBSCRIPTION_STATUSES.has(subscription.status)) {
    return handleSubscriptionRecovered(subscription);
  }
  return NextResponse.json({ received: true, ignored: subscription.status });
}

/**
 * The subscription as Stripe holds it right now, with the invoice that decides
 * whether a plan change has been paid for. Falls back to the delivered payload
 * so a Stripe outage cannot stop us reacting to a cancellation at all.
 */
async function resolveSubscription(delivered: Stripe.Subscription): Promise<Stripe.Subscription> {
  try {
    return await getStripe().subscriptions.retrieve(delivered.id, {
      expand: ['latest_invoice'],
    });
  } catch (error: unknown) {
    console.error('[stripe-webhook] subscription re-read failed — falling back to the delivered payload', {
      subscriptionId: delivered.id,
      error,
    });
    return delivered;
  }
}

/**
 * Bring the pre-order row back in line with the subscription: current period,
 * current plan, and (for a fixed-term plan) the renewal still disarmed.
 *
 * Nothing is written until the subscription's latest invoice is PAID. A Portal
 * plan switch prorates with `always_invoice`, and the resulting
 * `customer.subscription.updated` carries the new price whether or not that
 * invoice cleared — so following it unconditionally would grant Complete to a
 * declined card. The period is held back with it: on a plan switch the period
 * belongs to the new price, and on a failed renewal the next-payment date has
 * not moved.
 *
 * Holding back is not the same as losing the change. `invoice.paid` fires when
 * the money does land and runs this same function, so the row catches up
 * whichever event order Stripe chooses — and if the payment never clears, the
 * row correctly never follows.
 *
 * Best-effort by design. It runs alongside handlers whose own success or
 * failure decides the response.
 */
async function syncSubscription(subscription: Stripe.Subscription): Promise<void> {
  const plan = planFromSubscription(subscription);

  // A live fixed-term subscription must stay disarmed. Skip dead ones: there is
  // nothing left to cancel, and Stripe rejects the update. Deliberately NOT
  // gated on the invoice below — an un-cancelled renewal is a charge waiting to
  // happen and has to be disarmed whatever the billing state.
  if (plan && isFixedTermPlan(plan) && LIVE_SUBSCRIPTION_STATUSES.has(subscription.status)) {
    if (!isCancelScheduled(subscription)) {
      console.warn('[stripe-webhook] fixed-term subscription had its renewal re-armed — disarming', {
        subscriptionId: subscription.id,
        plan,
      });
      await armFixedTermCancellation(subscription);
    }
  }

  if (!isLatestInvoicePaid(subscription)) {
    console.warn('[stripe-webhook] latest invoice is not paid — plan and period left as they were', {
      subscriptionId: subscription.id,
      status: subscription.status,
      plan,
    });
    return;
  }

  await writeSubscriptionState(getSupabaseAdmin(), subscription.id, {
    period: readAccessPeriod(subscription),
    plan,
    amountPence: priceAmountPence(subscription),
  });
}

/**
 * An invoice cleared. For the rolling plan this is a renewal, and the only
 * event that moves the period on — `customer.subscription.updated` fires for it
 * too, but relying on that alone would leave the next-payment date wrong
 * whenever Stripe emits only the invoice event.
 *
 * The subscription is re-read rather than trusted from the invoice: the invoice
 * carries the subscription id, not its current period.
 */
async function handleInvoicePaid(invoice: Stripe.Invoice, chargedAt: Date) {
  const subscriptionId = subscriptionIdFromInvoice(invoice);
  if (!subscriptionId) {
    // A one-off invoice with no subscription behind it — nothing of ours.
    return NextResponse.json({ received: true, ignored: 'no_subscription' });
  }

  try {
    // Expanded, because syncSubscription will not write anything until it can
    // see that this invoice is paid.
    const subscription = await getStripe().subscriptions.retrieve(subscriptionId, {
      expand: ['latest_invoice'],
    });
    await syncSubscription(subscription);
    await deliverRenewalReceipt(invoice, subscription, chargedAt);
  } catch (error: unknown) {
    console.error('[stripe-webhook] invoice.paid period refresh failed (non-fatal)', {
      subscriptionId,
      error,
    });
  }

  return NextResponse.json({ received: true, refreshed: subscriptionId });
}

/**
 * A monthly renewal cleared — send its receipt.
 *
 * Only for `billing_reason: subscription_cycle`. The FIRST invoice of a
 * subscription is `subscription_create`, and that charge already had its
 * receipt sent by the checkout handler; without this gate the monthly buyer
 * would get two receipts for one payment, on two different numbers.
 *
 * The plan comes from the PRICE, not from metadata: a renewal arrives attached
 * to the subscription, and a subscription carries no checkout metadata. This is
 * what `planForStripePriceId` exists for.
 *
 * Entirely best-effort. A missing renewal receipt is a support email; a thrown
 * exception here would re-run the whole invoice handler on Stripe's retry.
 */
async function deliverRenewalReceipt(
  invoice: Stripe.Invoice,
  subscription: Stripe.Subscription,
  chargedAt: Date,
): Promise<void> {
  if (invoice.billing_reason !== 'subscription_cycle') return;
  if (!invoice.id) return;

  const plan = planFromSubscription(subscription);
  if (!plan || !isReceiptPlanKey(plan) || !isRollingPlan(plan)) return;

  const supabase = getSupabaseAdmin();
  const { data: order, error } = await supabase
    .from('preorders')
    .select('id, email, full_name')
    .eq('stripe_subscription_id', subscription.id)
    .neq('status', 'refunded')
    .maybeSingle();

  if (error || !order?.email) {
    console.error('[stripe-webhook] renewal receipt: no order behind this subscription', {
      subscriptionId: subscription.id,
      invoiceId: invoice.id,
      error,
    });
    return;
  }

  const period = readAccessPeriod(subscription);
  const receipt = await issueReceipt(supabase, {
    // Idempotency key. The invoice, not the session — a renewal has no session,
    // and this is what makes a redelivered `invoice.paid` reprint one number.
    stripeEventKey: invoice.id,
    preorderId: order.id,
    email: order.email,
    customerName: order.full_name ?? null,
    planKey: plan,
    // What this invoice actually took, which is not necessarily the list price.
    amountPence: invoice.amount_paid ?? 0,
    currency: invoice.currency ?? 'gbp',
    // An invoice records the types it was ALLOWED to use, not the one it did.
    // On our subscriptions that is null (it inherits the customer default), so
    // this falls through to "Card" — correct today, because card is all we take.
    // If a bank-transfer subscription is ever sold, read the charge instead.
    paymentMethod: paymentMethodLabel(invoice.payment_settings?.payment_method_types),
    paidAt: chargedAt,
    periodStart: period.startsAt ? new Date(period.startsAt) : null,
    periodEnd: period.endsAt ? new Date(period.endsAt) : null,
    kind: 'renewal',
  });

  if (!receipt) return;

  await sendReceiptEmail({
    toEmail: order.email,
    toName: order.full_name ?? null,
    firstName: order.full_name ?? null,
    planKey: plan,
    nextBillingDate: receipt.periodEnd ? formatReceiptDate(receipt.periodEnd) : null,
    // A month in, they have had an account for a month.
    hasSetupLink: false,
    setupUrl: null,
    isRenewal: true,
    pdf: receipt.pdf,
    fileName: receipt.fileName,
  });
}

/**
 * The subscription behind an invoice.
 *
 * In API 2026-06-24.dahlia this lives at `parent.subscription_details
 * .subscription`; the flat `invoice.subscription` was removed from the object.
 * Webhook payloads render at the ENDPOINT's API version, though, so the legacy
 * shape is read as a fallback.
 */
function subscriptionIdFromInvoice(invoice: Stripe.Invoice): string | null {
  const parent = invoice.parent?.subscription_details?.subscription ?? null;
  if (parent) return typeof parent === 'string' ? parent : parent.id;

  const legacy = (invoice as unknown as { subscription?: string | { id: string } }).subscription;
  if (!legacy) return null;
  return typeof legacy === 'string' ? legacy : legacy.id;
}

interface RecordReferralArgs {
  referralCode: string | null;
  preorderId: string;
  refereeEmail: string;
  plan: string;
  amount: number;
}

/**
 * Insert the referral row for an attributed purchase. Idempotent via the unique
 * preorder_id. Status/void_reason/reward come from the pure `decideReferral`
 * (self-referral and below-minimum-spend purchases are recorded as `void`).
 * Benign conflicts (dup
 * referee/preorder = 23505, dead/removed code FK = 23503) are logged and
 * ignored; a genuine DB failure returns 'failed' so the webhook can 500 and
 * let Stripe's retry recover it.
 */
async function recordReferral(
  supabase: SupabaseAdmin,
  args: RecordReferralArgs,
): Promise<'ok' | 'skipped' | 'failed'> {
  const { referralCode, preorderId, refereeEmail, plan, amount } = args;
  if (!referralCode) return 'skipped';

  const { data: codeRow, error: codeError } = await supabase
    .from('referral_codes')
    .select('code, owner_email, active, reward_override_pence')
    .eq('code', referralCode)
    .maybeSingle();

  if (codeError) {
    console.error('[stripe-webhook] referral code lookup failed', { referralCode, error: codeError });
    return 'failed';
  }
  if (!codeRow || !codeRow.active) return 'skipped'; // unknown or deactivated code — no attribution

  const referrerEmail = normalizeEmail(codeRow.owner_email);
  const decision = decideReferral({
    ownerEmail: referrerEmail,
    refereeEmail,
    plan,
    amountTotalPence: amount,
    rewardOverridePence: codeRow.reward_override_pence,
    // Test-rig only: lets a £1 rig purchase clear the qualifying floor so the
    // full happy path (pending -> qualified -> paid) is testable. Unset in
    // production, where the real 50%-of-list floors apply.
    minSpendOverridePence: parseMinSpendOverride(process.env.REFERRAL_MIN_SPEND_OVERRIDE_PENCE),
  });

  const { error: referralError } = await supabase.from('referrals').insert({
    referral_code: codeRow.code,
    referrer_email: referrerEmail,
    referee_email: refereeEmail,
    preorder_id: preorderId,
    plan,
    amount,
    reward_amount: decision.rewardAmount,
    referee_reward_amount: decision.refereeRewardAmount,
    status: decision.status,
    void_reason: decision.voidReason,
  });

  if (referralError && referralError.code !== '23505' && referralError.code !== '23503') {
    console.error('[stripe-webhook] referral insert failed', { preorderId, error: referralError });
    return 'failed';
  }
  if (referralError) {
    // 23505 = dup referee (partial index) or dup preorder (retry); 23503 = code FK gone.
    console.log('[stripe-webhook] referral not recorded (benign)', {
      preorderId,
      code: referralError.code,
    });
  }
  return 'ok';
}

interface MintArgs {
  email: string;
  name: string | null;
  origin: string;
}

/**
 * Ensure the buyer has their own advocate code (single writer = this webhook),
 * then email them their share link. Reuses an existing code if present; retries
 * once on a random code-PK collision. The invite email is sent at-least-once,
 * keyed off `referral_codes.invited_at`: after mint-or-fetch, if `invited_at`
 * is null we attempt the send and stamp it on success. A send failure leaves
 * `invited_at` null so a future webhook (retry, or the owner's next purchase)
 * tries again. Email failure never blocks the webhook.
 */
async function mintAdvocateAndInvite(supabase: SupabaseAdmin, args: MintArgs): Promise<void> {
  const { email, name, origin } = args;

  // Reuse an existing code (repeat buyer / webhook retry).
  const { data: existing } = await supabase
    .from('referral_codes')
    .select('code, invited_at')
    .eq('owner_email', email)
    .maybeSingle();

  let code = existing?.code ?? null;
  let invitedAt = existing?.invited_at ?? null;

  if (!code) {
    for (let attempt = 0; attempt < 2 && !code; attempt += 1) {
      const candidate = generateReferralCode(name ?? undefined);
      const { data: minted, error } = await supabase
        .from('referral_codes')
        .insert({ code: candidate, owner_email: email, owner_name: name, active: true })
        .select('code, invited_at')
        .single();

      if (!error) {
        code = minted?.code ?? candidate;
        invitedAt = minted?.invited_at ?? null; // fresh row: not yet invited
        break;
      }
      if (error.code === '23505') {
        // Either owner_email already has a code (race with a concurrent webhook)
        // or the random code collided. Re-check by email; else retry with a new code.
        const { data: raced } = await supabase
          .from('referral_codes')
          .select('code, invited_at')
          .eq('owner_email', email)
          .maybeSingle();
        if (raced?.code) {
          code = raced.code; // concurrent winner minted it
          invitedAt = raced.invited_at ?? null;
          break;
        }
        continue; // code-PK collision — loop retries once
      }
      console.error('[stripe-webhook] advocate code mint failed', { email, error });
      return;
    }
  }

  if (!code) {
    console.error('[stripe-webhook] advocate code mint exhausted retries', { email });
    return;
  }
  if (invitedAt) return; // already invited on a previous attempt/purchase

  // The auto-invite email is gated behind a flag (default OFF) so referral
  // invites go out deliberately/systematically, not to every buyer. When off,
  // the buyer still has their code (shown on /thanks) — only the email is
  // suppressed, and invited_at stays null so enabling the flag later can still
  // invite them on a subsequent webhook. Set REFERRAL_AUTO_INVITE_EMAIL=true
  // to re-enable.
  if (process.env.REFERRAL_AUTO_INVITE_EMAIL !== 'true') return;

  const result = await sendReferralEmail({
    toEmail: email,
    toName: name,
    referralUrl: referralUrl(origin, code),
    rewardAmount: REWARD_BY_PLAN.complete, // headline "up to £100"
    refereeDiscount: REFEREE_REWARD_BY_PLAN.complete, // "...and £100 back for them"
  });

  if (!result.sent) {
    // Leave invited_at null so a future webhook retries the send.
    console.error('[stripe-webhook] referral invite email not sent', { email, result });
    return;
  }

  const { error: stampError } = await supabase
    .from('referral_codes')
    .update({ invited_at: new Date().toISOString() })
    .eq('code', code);
  if (stampError) {
    // Email went out; failing to stamp risks a duplicate invite on the next
    // webhook, which is far less harmful than never inviting. Log and move on.
    console.error('[stripe-webhook] invited_at stamp failed', { email, code, error: stampError });
  }
}

/**
 * Refund handler. Voids the linked referral on ANY refund (partial or full) —
 * conservative, to protect payouts. The pre-order is flipped to `refunded` only
 * on a full refund; a partially-refunded buyer still holds their seat. If the
 * referral was already `paid`, it is still voided but `paid_at` is left intact
 * and a loud clawback warning is logged. A failed referral-void update returns
 * 500 so Stripe retries — the update is idempotent.
 */
/**
 * True when this refund IS the referee's referral cashback rather than a real
 * refund. Paying the buyer's side back onto their card is the natural mechanism,
 * but `charge.refunded` fires for it exactly as it would for a cancellation —
 * and voiding the referral there would cancel the referrer's payout every single
 * time we paid a buyer. The refund carries `purpose: referee_reward` metadata
 * (see the admin payout action); anything without it is a genuine refund.
 */
function isRefereeRewardRefund(charge: Stripe.Charge): boolean {
  const refunds = charge.refunds?.data ?? [];
  if (refunds.length === 0) return false;
  // Every refund on the charge must be a reward payout — a later genuine refund
  // on the same charge must still void, even though a reward refund precedes it.
  return refunds.every((r) => r.metadata?.purpose === 'referee_reward');
}

async function handleChargeRefunded(charge: Stripe.Charge) {
  if (isRefereeRewardRefund(charge)) {
    console.log('[stripe-webhook] refund is a referee cashback — referral left intact', {
      chargeId: charge.id,
    });
    return NextResponse.json({ received: true, ignored: 'referee_reward_refund', chargeId: charge.id });
  }

  // Matched on the PaymentIntent. Since every plan became a subscription that
  // id no longer comes from the checkout session (which has none in
  // `subscription` mode) — it is read off the first invoice and written by
  // syncCheckoutSubscription.
  const paymentIntentId =
    typeof charge.payment_intent === 'string' ? charge.payment_intent : (charge.payment_intent?.id ?? null);
  if (!paymentIntentId) {
    console.error('[stripe-webhook] refunded charge has no payment_intent — cannot match to a preorder', {
      chargeId: charge.id,
    });
    return NextResponse.json({ received: true, error: 'no_payment_intent', chargeId: charge.id });
  }

  const supabase = getSupabaseAdmin();
  const { data: preorder, error: findError } = await supabase
    .from('preorders')
    .select('id')
    .eq('stripe_payment_intent_id', paymentIntentId)
    .maybeSingle();

  if (findError) {
    console.error('[stripe-webhook] refund preorder lookup failed', { paymentIntentId, error: findError });
    return NextResponse.json({ error: 'Failed to process refund' }, { status: 500 });
  }
  if (!preorder) {
    // No matching pre-order (e.g. a non-preorder charge) — log loudly, then no-op.
    console.error('[stripe-webhook] refund could not be matched to a preorder', {
      paymentIntentId,
      chargeId: charge.id,
    });
    return NextResponse.json({ received: true, ignored: 'no_preorder', paymentIntentId });
  }

  // Full refund only: flip the pre-order to refunded. Partial refunds leave the
  // seat intact.
  if (charge.refunded) {
    const { error: preorderError } = await supabase
      .from('preorders')
      .update({ status: 'refunded' })
      .eq('id', preorder.id);
    if (preorderError) {
      console.error('[stripe-webhook] preorder refund update failed', { preorderId: preorder.id, error: preorderError });
      return NextResponse.json({ error: 'Failed to process refund' }, { status: 500 });
    }
  }

  // Detect an already-paid referral before voiding so a clawback is loud in the
  // logs. Best-effort — a lookup failure doesn't block the void below.
  const { data: linked, error: linkedError } = await supabase
    .from('referrals')
    .select('status')
    .eq('preorder_id', preorder.id)
    .neq('status', 'void');
  if (linkedError) {
    console.error('[stripe-webhook] referral lookup for clawback check failed (non-fatal)', {
      preorderId: preorder.id,
      error: linkedError,
    });
  }
  if (linked?.some((r) => r.status === 'paid')) {
    console.error('[stripe-webhook] CLAWBACK: voiding an already-paid referral after refund', {
      preorderId: preorder.id,
      chargeId: charge.id,
    });
  }

  // Void the linked referral on any refund (keep paid_at so a clawback stays
  // visible in admin). A failed update -> 500 so Stripe retries; it's idempotent.
  const { error: voidError } = await supabase
    .from('referrals')
    .update({ status: 'void', void_reason: 'refunded' })
    .eq('preorder_id', preorder.id)
    .neq('status', 'void');
  if (voidError) {
    console.error('[stripe-webhook] referral void failed', { preorderId: preorder.id, error: voidError });
    return NextResponse.json({ error: 'Failed to void referral' }, { status: 500 });
  }

  return NextResponse.json({ received: true, refunded: preorder.id, fullRefund: charge.refunded });
}
