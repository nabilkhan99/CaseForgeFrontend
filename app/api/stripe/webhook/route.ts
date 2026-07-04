import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import type Stripe from 'stripe';
import { getStripe } from '@/lib/commerce/stripe';

function getSupabaseAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  return createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } });
}

/**
 * Stripe webhook: records paid pre-orders in Supabase.
 * `checkout.session.completed` -> insert into `preorders` (idempotent on
 * stripe_session_id), which is what drives the live seat counter down.
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

  if (event.type !== 'checkout.session.completed') {
    return NextResponse.json({ received: true, ignored: event.type });
  }

  const session = event.data.object as Stripe.Checkout.Session;
  if (session.payment_status !== 'paid') {
    // Async payment methods settle later via checkout.session.async_payment_succeeded;
    // card payments (our case) are always 'paid' here.
    return NextResponse.json({ received: true, deferred: session.id });
  }

  const email = session.customer_details?.email ?? session.customer_email;
  const plan = session.metadata?.plan;
  const intakeMonth = session.metadata?.intake_month;

  if (!email || !plan || !intakeMonth) {
    console.error('[stripe-webhook] session missing required fields', {
      sessionId: session.id,
      hasEmail: Boolean(email),
      plan,
      intakeMonth,
    });
    // 200 so Stripe doesn't retry forever — this needs manual follow-up, not retries.
    return NextResponse.json({ received: true, error: 'missing_fields', sessionId: session.id });
  }

  const supabase = getSupabaseAdmin();
  const { error } = await supabase.from('preorders').insert({
    email: email.toLowerCase().trim(),
    full_name: session.customer_details?.name ?? null,
    plan,
    intake_month: intakeMonth,
    amount: session.amount_total ?? 0,
    currency: session.currency ?? 'gbp',
    stripe_session_id: session.id,
    stripe_customer_id: typeof session.customer === 'string' ? session.customer : (session.customer?.id ?? null),
    stripe_payment_intent_id:
      typeof session.payment_intent === 'string' ? session.payment_intent : (session.payment_intent?.id ?? null),
    status: 'paid',
  });

  // 23505 = duplicate stripe_session_id -> webhook retry, already recorded.
  if (error && error.code !== '23505') {
    console.error('[stripe-webhook] preorder insert failed', { sessionId: session.id, error });
    return NextResponse.json({ error: 'Failed to record preorder' }, { status: 500 });
  }

  return NextResponse.json({ received: true, recorded: !error });
}
