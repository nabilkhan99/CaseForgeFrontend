import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getSupabaseAdmin } from '@/lib/supabase/admin';
import { getStripe, PLAN_CONFIG, isValidPlan } from '@/lib/stripe';

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json(
      { error: 'Unauthorized', redirect: '/auth/sign-up?redirect=/pricing' },
      { status: 401 }
    );
  }

  const body = await req.json();
  const { plan } = body;

  if (!plan || !isValidPlan(plan)) {
    return NextResponse.json(
      { error: 'Invalid plan. Must be sprint, standard, or mastery.' },
      { status: 400 }
    );
  }

  const planConfig = PLAN_CONFIG[plan];
  const adminSupabase = getSupabaseAdmin();

  // Look up or create Stripe customer
  const { data: profile } = await adminSupabase
    .from('profiles')
    .select('stripe_customer_id')
    .eq('id', user.id)
    .single();

  const stripe = getStripe();
  let stripeCustomerId = profile?.stripe_customer_id;

  if (!stripeCustomerId) {
    const customer = await stripe.customers.create({
      email: user.email,
      metadata: { supabase_user_id: user.id },
    });
    stripeCustomerId = customer.id;

    await adminSupabase
      .from('profiles')
      .update({ stripe_customer_id: stripeCustomerId })
      .eq('id', user.id);
  }

  // Create Checkout Session
  const origin = req.headers.get('origin') || 'https://www.fourteenfisherman.com';

  const session = await stripe.checkout.sessions.create({
    mode: 'payment',
    customer: stripeCustomerId,
    line_items: [{ price: planConfig.priceId, quantity: 1 }],
    metadata: {
      plan,
      supabase_user_id: user.id,
    },
    success_url: `${origin}/checkout/success?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${origin}/pricing`,
  });

  return NextResponse.json({ url: session.url });
}
