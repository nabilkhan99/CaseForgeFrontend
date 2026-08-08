import { NextRequest, NextResponse } from 'next/server';
import { isAdmin } from '@/lib/admin/guard';
import { getStripe } from '@/lib/commerce/stripe';

/** Widest window Stripe list pagination stays cheap for; ~2 launch cycles. */
const MAX_DAYS = 90;

interface AbandonedCheckout {
  created: string;
  status: string;
  paymentStatus: string;
  plan: string;
  coachingDay: string | null;
  email: string | null;
  name: string | null;
  amountTotal: number | null;
  referralCode: string | null;
}

/**
 * Lists Stripe Checkout sessions that were started but never paid, with the
 * email the buyer typed on the Stripe page (present whenever they got as far
 * as the contact field). This is the recovery list for abandoned checkouts —
 * checkout_holds only stores the session id, so Stripe is the sole source of
 * who these people are.
 *
 * GET /api/admin/abandoned-checkouts?days=14 — ADMIN_EMAILS only.
 */
export async function GET(request: NextRequest) {
  if (!(await isAdmin())) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const daysParam = Number(request.nextUrl.searchParams.get('days') ?? 14);
  const days = Number.isFinite(daysParam) ? Math.min(Math.max(daysParam, 1), MAX_DAYS) : 14;
  const createdAfter = Math.floor(Date.now() / 1000) - days * 24 * 60 * 60;

  try {
    const stripe = getStripe();
    const abandoned: AbandonedCheckout[] = [];

    for await (const session of stripe.checkout.sessions.list({
      created: { gte: createdAfter },
      limit: 100,
    })) {
      if (session.payment_status === 'paid') continue;
      abandoned.push({
        created: new Date(session.created * 1000).toISOString(),
        status: session.status ?? 'unknown',
        paymentStatus: session.payment_status,
        plan: session.metadata?.plan ?? 'unknown',
        coachingDay: session.metadata?.coaching_day ?? null,
        email: session.customer_details?.email ?? session.customer_email ?? null,
        name: session.customer_details?.name ?? null,
        amountTotal: session.amount_total,
        referralCode: session.metadata?.referral_code ?? null,
      });
    }

    return NextResponse.json({ days, count: abandoned.length, abandoned });
  } catch (error: unknown) {
    console.error('[abandoned-checkouts] Stripe list failed', error);
    return NextResponse.json({ error: 'Failed to list checkout sessions' }, { status: 500 });
  }
}
