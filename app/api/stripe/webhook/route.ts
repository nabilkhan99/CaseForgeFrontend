import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import type Stripe from 'stripe';
import { getStripe } from '@/lib/commerce/stripe';
import {
  REFEREE_DISCOUNT_BY_PLAN,
  REWARD_BY_PLAN,
  decideReferral,
  generateReferralCode,
  meetsMinimumSpend,
  normalizeCode,
  normalizeEmail,
  parseMinSpendOverride,
  referralUrl,
  resolveReward,
} from '@/lib/commerce/referrals';
import { sendReferralEmail } from '@/lib/email/referralEmail';
import { sendPurchaseEmail } from '@/lib/email/purchaseEmail';
import { pushPreorderContactToBrevo } from '@/lib/marketing/preorderContact';

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
 * counter), attribute any referral, and mint the buyer's own advocate code +
 * invite email. Every write is idempotent so Stripe retries are safe.
 *
 * `charge.refunded` -> void the linked referral on ANY refund (partial or full)
 * so it can't be paid out; the pre-order is flipped to refunded only on a full
 * refund (a partially-refunded buyer still holds their seat).
 *
 * `invoice.paid` -> credit a monthly referral that was recorded at £0 because
 * the subscription had not been charged yet (pre-launch signups bill on 1 Sept).
 *
 * `customer.subscription.deleted` -> mark the monthly order canceled.
 *
 * Ops: the Stripe webhook endpoint must have `charge.refunded`, `invoice.paid`
 * and `customer.subscription.deleted` enabled.
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
    return handleCheckoutCompleted(event.data.object as Stripe.Checkout.Session, origin);
  }
  if (event.type === 'charge.refunded') {
    return handleChargeRefunded(event.data.object as Stripe.Charge);
  }
  if (event.type === 'invoice.paid') {
    return handleInvoicePaid(event.data.object as Stripe.Invoice);
  }
  if (event.type === 'customer.subscription.deleted') {
    return handleSubscriptionDeleted(event.data.object as Stripe.Subscription);
  }

  return NextResponse.json({ received: true, ignored: event.type });
}

async function handleCheckoutCompleted(session: Stripe.Checkout.Session, origin: string) {
  // 'no_payment_required' is the legitimate state for a subscription that starts
  // on a trial (pre-launch monthly signups bill from 1 September, not today) —
  // the card is captured and the order is real, so it must be recorded.
  const trialling = session.mode === 'subscription' && session.payment_status === 'no_payment_required';
  if (session.payment_status !== 'paid' && !trialling) {
    // Async payment methods settle later via checkout.session.async_payment_succeeded;
    // card payments (our case) are always 'paid' here.
    return NextResponse.json({ received: true, deferred: session.id });
  }

  const email = session.customer_details?.email ?? session.customer_email;
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

  const buyerEmail = normalizeEmail(email);
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
      // Set only for rolling plans. Renewal invoices arrive attached to the
      // subscription, not the checkout session, so this is the handle back here.
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
      awaitingFirstPayment: trialling,
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
  // address is known. Without this no receipt is sent, while our confirmation
  // email tells the buyer "your card receipt comes separately from Stripe".
  // Gated on isNewPreorder so a webhook retry cannot trigger a second receipt.
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

  // Confirmation email + Brevo pre-order contact sync. Gated on isNewPreorder so
  // this only runs for a genuinely NEW pre-order (the insert succeeded): a Stripe
  // webhook retry takes the 23505 duplicate path and must never double-email the
  // customer. Best-effort throughout: never fail the webhook.
  if (isNewPreorder) {
    try {
      const coachingDayLabel = session.metadata?.coaching_day_label ?? null;
      const [emailResult, contactResult] = await Promise.allSettled([
        sendPurchaseEmail({ toEmail: buyerEmail, toName: buyerName, planKey: plan, coachingDayLabel }),
        pushPreorderContactToBrevo({
          email: buyerEmail,
          fullName: buyerName,
          planKey: plan,
          coachingDayLabel,
          amountPence: session.amount_total ?? 0,
        }),
      ]);

      if (emailResult.status === 'rejected') {
        console.error('[stripe-webhook] purchase confirmation email threw', {
          sessionId: session.id,
          reason: emailResult.reason,
        });
      } else if (!emailResult.value.sent) {
        console.warn('[stripe-webhook] purchase confirmation email not sent', {
          sessionId: session.id,
          result: emailResult.value,
        });
      }
      if (contactResult.status === 'rejected') {
        console.error('[stripe-webhook] preorder contact sync threw', {
          sessionId: session.id,
          reason: contactResult.reason,
        });
      }
    } catch (error: unknown) {
      console.error('[stripe-webhook] purchase confirmation error', { sessionId: session.id, error });
    }
  }

  return NextResponse.json({ received: true, recorded: !insertError, preorderId });
}

/**
 * A subscription invoice was paid.
 *
 * This exists for one job: crediting a referral recorded at £0 because the
 * subscription had not been charged yet. Monthly referrals pay £50 on the FIRST
 * payment (founder decision 2026-08-20), and for a plan bought after launch that
 * payment happens at checkout — recordReferral has already set the reward and
 * this handler finds nothing to do. Only a pre-launch signup, whose first charge
 * is held until access opens, arrives here still owed its reward.
 *
 * Deliberately NOT gated on `billing_reason`: what matters is whether money
 * actually moved, not which invoice moved it. The £0 trial invoice fails the
 * spend check below; the first real charge passes it.
 *
 * Idempotent by construction: it only ever updates a referral still sitting at
 * reward_amount = 0, so a redelivered invoice — or every later renewal — is a
 * no-op rather than a repeat credit.
 */
async function handleInvoicePaid(invoice: Stripe.Invoice) {
  // Stripe's Basil API moved the subscription off the invoice root: it now hangs
  // off `parent.subscription_details`, expanded or not.
  const subscription = invoice.parent?.subscription_details?.subscription ?? null;
  const subscriptionId = typeof subscription === 'string' ? subscription : (subscription?.id ?? null);
  if (!subscriptionId) {
    return NextResponse.json({ received: true, ignored: 'no_subscription', invoiceId: invoice.id });
  }

  const supabase = getSupabaseAdmin();
  const { data: preorder, error: findError } = await supabase
    .from('preorders')
    .select('id, plan, referral_code, status')
    .eq('stripe_subscription_id', subscriptionId)
    .maybeSingle();

  if (findError) {
    console.error('[stripe-webhook] renewal preorder lookup failed', { subscriptionId, error: findError });
    return NextResponse.json({ error: 'Failed to process renewal' }, { status: 500 });
  }
  // A renewal with no matching order is not an error worth retrying (e.g. a
  // subscription created outside checkout) — log and move on.
  if (!preorder) {
    console.warn('[stripe-webhook] renewal could not be matched to a preorder', { subscriptionId });
    return NextResponse.json({ received: true, ignored: 'no_preorder', subscriptionId });
  }
  if (!preorder.referral_code) {
    return NextResponse.json({ received: true, ignored: 'no_referral', preorderId: preorder.id });
  }
  // A refunded/cancelled order must not mint a reward on a straggling invoice.
  if (preorder.status !== 'paid') {
    return NextResponse.json({ received: true, ignored: `status_${preorder.status}`, preorderId: preorder.id });
  }

  // Re-resolve the amount rather than trusting a stored one: a per-code override
  // may have been negotiated (or changed) since the signup.
  const { data: codeRow, error: codeError } = await supabase
    .from('referral_codes')
    .select('reward_override_pence')
    .eq('code', preorder.referral_code)
    .maybeSingle();
  if (codeError) {
    console.error('[stripe-webhook] renewal code lookup failed', { subscriptionId, error: codeError });
    return NextResponse.json({ error: 'Failed to process renewal' }, { status: 500 });
  }

  // The qualifying-spend test that decideReferral skipped for an uncharged
  // subscription lands here, against the payment that actually earns the reward.
  // This is also what stops the £0 trial invoice from crediting anything.
  const minSpendOverride = parseMinSpendOverride(process.env.REFERRAL_MIN_SPEND_OVERRIDE_PENCE);
  if (!meetsMinimumSpend(preorder.plan, invoice.amount_paid ?? 0, minSpendOverride)) {
    console.warn('[stripe-webhook] renewal below qualifying spend — no credit', {
      preorderId: preorder.id,
      amountPaid: invoice.amount_paid,
    });
    return NextResponse.json({ received: true, ignored: 'below_min_spend', preorderId: preorder.id });
  }

  const rewardAmount = resolveReward(preorder.plan, codeRow?.reward_override_pence ?? null);
  const { data: credited, error: updateError } = await supabase
    .from('referrals')
    .update({ reward_amount: rewardAmount })
    .eq('preorder_id', preorder.id)
    .eq('status', 'pending')
    .eq('reward_amount', 0)
    .select('id');

  if (updateError) {
    console.error('[stripe-webhook] referral credit failed', { preorderId: preorder.id, error: updateError });
    return NextResponse.json({ error: 'Failed to process renewal' }, { status: 500 });
  }

  const creditedCount = credited?.length ?? 0;
  if (creditedCount > 0) {
    console.log('[stripe-webhook] referral credited on first payment', {
      preorderId: preorder.id,
      rewardAmount,
    });
  }
  return NextResponse.json({ received: true, credited: creditedCount });
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

interface RecordReferralArgs {
  referralCode: string | null;
  preorderId: string;
  refereeEmail: string;
  plan: string;
  amount: number;
  /** Subscription bought pre-launch: nothing charged yet, so the reward waits. */
  awaitingFirstPayment?: boolean;
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
  const { referralCode, preorderId, refereeEmail, plan, amount, awaitingFirstPayment } = args;
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
    awaitingFirstPayment,
  });

  const { error: referralError } = await supabase.from('referrals').insert({
    referral_code: codeRow.code,
    referrer_email: referrerEmail,
    referee_email: refereeEmail,
    preorder_id: preorderId,
    plan,
    amount,
    reward_amount: decision.rewardAmount,
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
    refereeDiscount: REFEREE_DISCOUNT_BY_PLAN.complete, // "...and £100 off for them"
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
async function handleChargeRefunded(charge: Stripe.Charge) {
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
