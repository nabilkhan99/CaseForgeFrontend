import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { getStripe } from '@/lib/commerce/stripe';
import { getPlan, stripePriceIdFor, type IntakeAvailability, type PlanKey } from '@/lib/commerce/plans';

function getSupabaseAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
  return createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } });
}

interface CheckoutBody {
  plan?: string;
  intakeMonth?: string; // ISO date, first of month, e.g. "2026-09-01"
}

/**
 * Creates a Stripe Checkout session for a pre-order.
 * Body: { plan: 'self_study' | 'complete', intakeMonth: 'YYYY-MM-01' }
 * Returns: { url } to redirect the buyer to Stripe's hosted checkout.
 */
export async function POST(request: Request) {
  try {
    const body = (await request.json()) as CheckoutBody;
    const plan = getPlan(body.plan ?? '');

    if (!plan || plan.cta !== 'checkout') {
      return NextResponse.json({ error: 'Invalid plan' }, { status: 400 });
    }
    if (!body.intakeMonth || !/^\d{4}-\d{2}-01$/.test(body.intakeMonth)) {
      return NextResponse.json({ error: 'Valid intake month is required' }, { status: 400 });
    }

    // Validate the intake exists, is open, and (for Complete) has seats left.
    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase
      .from('intake_availability')
      .select('month, label, capacity, seats_left, enrol_deadline, status, sort_order')
      .eq('month', body.intakeMonth)
      .maybeSingle();

    if (error) {
      console.error('[checkout] intake lookup failed', error);
      return NextResponse.json({ error: 'Failed to validate intake' }, { status: 500 });
    }

    const intake = data as IntakeAvailability | null;
    if (!intake || intake.status !== 'open') {
      return NextResponse.json({ error: 'This intake is not open for enrolment' }, { status: 409 });
    }
    if (plan.key === 'complete' && intake.seats_left <= 0) {
      return NextResponse.json(
        { error: `The ${intake.label} class is full — please choose another month` },
        { status: 409 },
      );
    }

    const origin = new URL(request.url).origin;
    const stripe = getStripe();
    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      line_items: [{ price: stripePriceIdFor(plan.key as PlanKey), quantity: 1 }],
      success_url: `${origin}/thanks?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${origin}/#pricing`,
      allow_promotion_codes: true,
      metadata: {
        plan: plan.key,
        intake_month: intake.month,
        intake_label: intake.label,
      },
      payment_intent_data: {
        description: `Fourteen Fisherman — ${plan.name}, ${intake.label} intake`,
      },
    });

    if (!session.url) {
      return NextResponse.json({ error: 'Failed to create checkout session' }, { status: 500 });
    }
    return NextResponse.json({ url: session.url });
  } catch (error: unknown) {
    console.error('[checkout] unexpected error', error);
    return NextResponse.json({ error: 'Failed to start checkout' }, { status: 500 });
  }
}
