import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import type Stripe from 'stripe';
import { getStripe } from '@/lib/commerce/stripe';
import {
  REWARD_BY_PLAN,
  decideReferral,
  generateReferralCode,
  normalizeCode,
  normalizeEmail,
  referralUrl,
} from '@/lib/commerce/referrals';
import { sendReferralEmail } from '@/lib/email/referralEmail';

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
 * Ops: the Stripe webhook endpoint must have `charge.refunded` enabled.
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

  return NextResponse.json({ received: true, ignored: event.type });
}

async function handleCheckoutCompleted(session: Stripe.Checkout.Session, origin: string) {
  if (session.payment_status !== 'paid') {
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
      status: 'paid',
      referral_code: referralCode,
    })
    .select('id')
    .single();

  let preorderId = inserted?.id ?? null;

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

  // Advocate minting + invite email are best-effort: never fail the webhook.
  try {
    await mintAdvocateAndInvite(supabase, { email: buyerEmail, name: buyerName, origin });
  } catch (error: unknown) {
    console.error('[stripe-webhook] advocate minting error', { sessionId: session.id, error });
  }

  return NextResponse.json({ received: true, recorded: !insertError, preorderId });
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
