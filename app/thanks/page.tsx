import Link from 'next/link';
import type { Metadata } from 'next';

import { getStripe } from '@/lib/commerce/stripe';
import { getPlan, isRollingPlan } from '@/lib/commerce/plans';
import { SET_PASSWORD_LINK_EXPIRY } from '@/lib/email/accountEmail';
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

        {/* The one step between paying and getting in. A buyer has no password
            yet — the account is created for them and the link that sets it
            rides in on the receipt — and a page that only mentioned the receipt
            left them with nothing to do. Stripe's checkout page already says
            this at the point of payment; saying it again here is the whole job
            of this paragraph. The expiry is imported rather than typed: it is a
            Supabase cap, not our choice, and a number stated in two places
            drifts. */}
        <p className="text-body leading-relaxed mb-4">
          Your receipt is on its way to{' '}
          {order?.email ? (
            <span className="font-medium text-heading">{order.email}</span>
          ) : (
            'your inbox'
          )}
          . It carries a <span className="font-medium text-heading">Set up your account</span>{' '}
          button &mdash; that link is how you choose a password and get in.
        </p>

        <p className="text-muted leading-relaxed mb-10">
          The link lasts {SET_PASSWORD_LINK_EXPIRY}; if it expires, the sign-in page will send
          you a fresh one.{' '}
          {/* The access term is read off the plan, not asserted. The rolling
              monthly has no three-month window, and telling a monthly buyer
              their access "starts today" for 3 months is a claim the billing
              does not honour. The coaching day is not repeated here: the line
              above already names it, and only for a plan that has one, which
              the sentence this replaced did not check. */}
          {order && !isRollingPlan(order.planKey) ? (
            <>Your AI practice and lectures are ready as soon as you&rsquo;re in, and your 3
              months&rsquo; access starts today.</>
          ) : order ? (
            <>Your AI practice and lectures are ready as soon as you&rsquo;re in, and your access
              renews monthly until you cancel.</>
          ) : (
            <>Your AI practice and lectures are ready as soon as you&rsquo;re in.</>
          )}
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
