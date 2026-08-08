import { NextResponse } from 'next/server';
import { getStripe } from '@/lib/commerce/stripe';
import { getPlan } from '@/lib/commerce/plans';
import { isAdmin } from '@/lib/admin/guard';

/** How far back to look for abandoned checkout sessions. */
const LOOKBACK_DAYS = 30;

interface AbandonedCheckout {
  created: string;
  status: string;
  plan: string;
  coachingDay: string | null;
  email: string | null;
  name: string | null;
  amountTotal: number | null;
}

/**
 * Lists Stripe Checkout sessions from the last 30 days that were started but
 * never paid, including the email/name Stripe captured before the buyer left
 * (present whenever they typed it before abandoning). Admin-only: this is the
 * recovery list for follow-up emails.
 */
export async function GET() {
  if (!(await isAdmin())) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  try {
    const stripe = getStripe();
    const since = Math.floor(Date.now() / 1000) - LOOKBACK_DAYS * 24 * 60 * 60;

    const sessions = await stripe.checkout.sessions.list({
      created: { gte: since },
      limit: 100,
    });

    const abandoned: AbandonedCheckout[] = sessions.data
      .filter((s) => s.payment_status !== 'paid')
      .map((s) => ({
        created: new Date(s.created * 1000).toISOString(),
        status: s.status ?? 'unknown',
        plan: getPlan(s.metadata?.plan ?? '')?.name ?? s.metadata?.plan ?? 'unknown',
        coachingDay: s.metadata?.coaching_day ?? null,
        email: s.customer_details?.email ?? s.customer_email ?? null,
        name: s.customer_details?.name ?? null,
        amountTotal: s.amount_total,
      }));

    return NextResponse.json({
      lookbackDays: LOOKBACK_DAYS,
      count: abandoned.length,
      withEmail: abandoned.filter((a) => a.email).length,
      abandoned,
    });
  } catch (error: unknown) {
    console.error('[admin/abandoned-checkouts] Stripe list failed', error);
    return NextResponse.json({ error: 'Failed to list checkout sessions' }, { status: 500 });
  }
}
