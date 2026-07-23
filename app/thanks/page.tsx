import Link from 'next/link';
import type { Metadata } from 'next';
import { cookies, headers } from 'next/headers';
import { getStripe } from '@/lib/commerce/stripe';
import { getPlan } from '@/lib/commerce/plans';
import { getSupabaseAdmin } from '@/lib/supabase/admin';
import { REFERRAL_DISPLAY_COOKIE, REWARD_BY_PLAN, normalizeEmail, referralUrl } from '@/lib/commerce/referrals';
import CopyLinkButton from './CopyLinkButton';

export const metadata: Metadata = {
  title: 'You’re in — Fourteen Fisherman',
  robots: { index: false },
};

interface ThanksPageProps {
  searchParams: Promise<{ session_id?: string }>;
}

interface OrderSummary {
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
      planName: plan?.name ?? 'your plan',
      coachingDayLabel: session.metadata?.coaching_day_label ?? null,
      email: session.customer_details?.email ?? null,
    };
  } catch (error: unknown) {
    console.error('[thanks] failed to retrieve checkout session', error);
    return null;
  }
}

/**
 * Read-only lookup of the buyer's advocate code (minted by the Stripe webhook).
 * Returns null if the webhook hasn't run yet — the page tolerates the race.
 */
async function getReferralCode(email: string | null): Promise<string | null> {
  if (!email) return null;
  try {
    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase
      .from('referral_codes')
      .select('code')
      .eq('owner_email', normalizeEmail(email))
      .eq('active', true)
      .maybeSingle();
    if (error) {
      console.error('[thanks] referral code lookup failed', error);
      return null;
    }
    return data?.code ?? null;
  } catch (error: unknown) {
    console.error('[thanks] referral code lookup error', error);
    return null;
  }
}

async function getOrigin(): Promise<string> {
  const h = await headers();
  const host = h.get('host') ?? 'www.fourteenfisherman.com';
  const proto = h.get('x-forwarded-proto') ?? (host.startsWith('localhost') ? 'http' : 'https');
  return `${proto}://${host}`;
}

export default async function ThanksPage({ searchParams }: ThanksPageProps) {
  const { session_id } = await searchParams;
  const order = await getOrderSummary(session_id);
  const referralCode = await getReferralCode(order?.email ?? null);
  const link = referralCode ? referralUrl(await getOrigin(), referralCode) : null;
  const rewardPounds = `£${Math.round(REWARD_BY_PLAN.complete / 100)}`;
  // Display-only flag: tells the referred buyer the recommendation was
  // counted. Attribution itself happened server-side at checkout via `ff_ref`.
  const wasReferred = Boolean((await cookies()).get(REFERRAL_DISPLAY_COOKIE)?.value);

  return (
    <main className="min-h-screen bg-surface flex items-center justify-center px-6">
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
          <p className="text-body text-lg leading-relaxed mb-3">Your pre-order is confirmed.</p>
        )}

        <p className="text-muted leading-relaxed mb-10">
          {order?.email ? (
            <>A receipt is on its way to <span className="font-medium text-body">{order.email}</span>. </>
          ) : (
            <>A receipt is on its way to your inbox. </>
          )}
          This is a pre-order: everything starts on 1 September 2026 — your AI practice,
          on-demand lectures and coaching. Your 3 months’ access runs from that date, and
          we’ll email you everything you need before launch.
        </p>

        {wasReferred ? (
          <p className="text-sm text-muted -mt-6 mb-10">
            The recommendation that brought you here was counted with this order.
          </p>
        ) : null}

        {/* ── Referral block (read-only; code is minted by the Stripe webhook) ── */}
        <div className="mb-10 rounded-2xl border border-[#EBE4DB] bg-surface-raised px-6 py-7 text-left">
          <h2 className="text-lg font-semibold text-heading tracking-tight">
            Refer a mate — earn up to {rewardPounds}
          </h2>
          {link ? (
            <>
              <p className="text-muted leading-relaxed mt-1.5 mb-4">
                Know another GP trainee prepping for the SCA? Share your personal link. When they
                enrol, you earn up to {rewardPounds}.
              </p>
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5">
                <code className="flex-1 min-w-0 truncate rounded-lg border border-[#EBE4DB] bg-white px-3.5 py-2.5 font-mono text-sm text-body">
                  {link}
                </code>
                <CopyLinkButton url={link} />
              </div>
            </>
          ) : (
            <p className="text-muted leading-relaxed mt-1.5">
              Your personal referral link is on its way by email — keep an eye on your inbox.
            </p>
          )}
        </div>

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
