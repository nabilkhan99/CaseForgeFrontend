import Link from 'next/link';
import type { Metadata } from 'next';

import { getStripe } from '@/lib/commerce/stripe';
import { getPlan } from '@/lib/commerce/plans';
import PurchaseTracker from '@/components/common/PurchaseTracker';

export const metadata: Metadata = {
  title: 'You’re in — Fourteen Fisherman',
  robots: { index: false },
};

interface ThanksPageProps {
  searchParams: Promise<{ session_id?: string }>;
}

interface OrderSummary {
  planKey: string;
  planName: string;
  coachingDayLabel: string | null;
  email: string | null;
}

async function getOrderSummary(sessionId: string | undefined): Promise<OrderSummary | null> {
  if (!sessionId) return null;
  try {
    const session = await getStripe().checkout.sessions.retrieve(sessionId);
    if (session.payment_status !== 'paid') return null;
    const plan = getPlan(session.metadata?.plan ?? '');
    return {
      planKey: session.metadata?.plan ?? 'unknown',
      planName: plan?.name ?? 'your plan',
      coachingDayLabel: session.metadata?.coaching_day_label ?? null,
      email: session.customer_details?.email ?? null,
    };
  } catch (error: unknown) {
    console.error('[thanks] failed to retrieve checkout session', error);
    return null;
  }
}

export default async function ThanksPage({ searchParams }: ThanksPageProps) {
  const { session_id } = await searchParams;
  const order = await getOrderSummary(session_id);

  return (
    <main className="min-h-screen bg-surface flex items-center justify-center px-6">
      {order && session_id && (
        <PurchaseTracker
          stripeSessionId={session_id}
          plan={order.planKey}
          coachingDay={order.coachingDayLabel}
        />
      )}
      <div className="max-w-xl w-full text-center py-24">
        <div className="mx-auto mb-8 flex h-16 w-16 items-center justify-center rounded-full bg-[#EAF3DE]">
          <svg viewBox="0 0 24 24" className="h-8 w-8 text-[#3B6D11]" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M20 6L9 17l-5-5" />
          </svg>
        </div>

        <h1 className="text-3xl sm:text-4xl font-semibold text-heading tracking-tight mb-4">
          You’re in.
        </h1>

        {order ? (
          <p className="text-body text-lg leading-relaxed mb-3">
            Your place on <span className="font-semibold text-heading">{order.planName}</span>
            {order.coachingDayLabel ? (
              <>
                {' '}— coaching day{' '}
                <span className="font-semibold text-heading">{order.coachingDayLabel}</span> —
              </>
            ) : null}{' '}
            is confirmed.
          </p>
        ) : (
          <p className="text-body text-lg leading-relaxed mb-3">Your order is confirmed.</p>
        )}

        <p className="text-muted leading-relaxed mb-10">
          {order?.email ? (
            <>A receipt is on its way to <span className="font-medium text-body">{order.email}</span>. </>
          ) : (
            <>A receipt is on its way to your inbox. </>
          )}
          Your AI practice and on-demand lectures are ready now, and your 3 months&rsquo;
          access starts today. Your coaching day runs on the date you picked.
        </p>

        <Link
          href="/"
          className="inline-flex items-center gap-2 rounded-lg bg-primary px-6 py-3 text-white font-medium shadow-elevation-2 transition-colors hover:bg-primary-light"
        >
          Back to home
        </Link>
      </div>
    </main>
  );
}
