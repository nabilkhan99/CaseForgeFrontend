import { NextRequest, NextResponse } from 'next/server';
import { getStripe, PLAN_CONFIG, isValidPlan } from '@/lib/stripe';
import { getSupabaseAdmin } from '@/lib/supabase/admin';
import type Stripe from 'stripe';

export async function POST(req: NextRequest) {
  const body = await req.text();
  const signature = req.headers.get('stripe-signature');

  if (!signature) {
    return NextResponse.json({ error: 'Missing stripe-signature header' }, { status: 400 });
  }

  const stripe = getStripe();
  let event: Stripe.Event;

  try {
    event = stripe.webhooks.constructEvent(
      body,
      signature,
      process.env.STRIPE_WEBHOOK_SECRET!
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    console.error('Webhook signature verification failed:', message);
    return NextResponse.json({ error: 'Invalid signature' }, { status: 400 });
  }

  if (event.type === 'checkout.session.completed') {
    const session = event.data.object as Stripe.Checkout.Session;
    const plan = session.metadata?.plan;
    const userId = session.metadata?.supabase_user_id;

    if (!plan || !isValidPlan(plan) || !userId) {
      console.error('Webhook missing metadata:', { plan, userId });
      return NextResponse.json({ error: 'Missing metadata' }, { status: 400 });
    }

    const planConfig = PLAN_CONFIG[plan];
    const expiresAt = new Date(Date.now() + planConfig.durationDays * 86_400_000);

    const adminSupabase = getSupabaseAdmin();

    // Upsert stripe_customer_id on profiles
    if (session.customer) {
      await adminSupabase
        .from('profiles')
        .update({ stripe_customer_id: String(session.customer) })
        .eq('id', userId);
    }

    // Insert subscription — unique constraint handles idempotency
    const { error } = await adminSupabase.from('subscriptions').insert({
      user_id: userId,
      stripe_checkout_session_id: session.id,
      stripe_payment_intent_id: session.payment_intent ? String(session.payment_intent) : null,
      plan,
      amount_paid: session.amount_total ?? planConfig.price,
      currency: session.currency ?? 'gbp',
      status: 'active',
      expires_at: expiresAt.toISOString(),
    });

    if (error) {
      // Unique constraint violation = duplicate webhook, safe to ignore
      if (error.code === '23505') {
        return NextResponse.json({ received: true, duplicate: true });
      }
      console.error('Failed to insert subscription:', error);
      return NextResponse.json({ error: 'Database error' }, { status: 500 });
    }
  }

  return NextResponse.json({ received: true });
}
