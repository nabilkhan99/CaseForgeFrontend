'use client';

import { useState } from 'react';
import Link from 'next/link';
import { getPlan, type PlanKey } from '@/lib/commerce/plans';
import { wallPlansFor } from '@/lib/commerce/trialWallPlans';

/**
 * The two plans, chosen by exam date — shared by the trial panel and the wall.
 *
 * Extracted from TrialWall when the offer moved forward in the trial. It used
 * to appear once, at the end; the 7 September decision put it on the dashboard
 * from day one, because a trainee who is running the same case for the third
 * time has already made up their mind about the product and should not have to
 * wait five days to be shown a price. Two copies of a checkout POST is exactly
 * the kind of duplication that ends with one of them quietly using a retired
 * plan key, so there is one.
 *
 * TWO PLANS, NOT FOUR — see lib/commerce/trialWallPlans.ts for the axis. A quiet
 * "see all plans" link sits beside them; the point is to make a choice easy,
 * not to hide the other two.
 */

/** How the two plans are bought. Self-Study posts to checkout; Complete picks a day first. */
export function usePlanCheckout() {
  const [submitting, setSubmitting] = useState<PlanKey | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function start(plan: PlanKey) {
    if (submitting) return;
    setSubmitting(plan);
    setError(null);
    try {
      const res = await fetch('/api/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ plan }),
      });
      const data = (await res.json()) as { url?: string; error?: string };
      if (!res.ok || !data.url) {
        setError(data.error ?? 'Something went wrong, please try again.');
        setSubmitting(null);
        return;
      }
      window.location.assign(data.url);
    } catch {
      setError('Something went wrong, please try again.');
      setSubmitting(null);
    }
  }

  return { start, submitting, error };
}

interface PlanRowProps {
  planKey: PlanKey;
  lead: boolean;
  /** One sentence saying why this plan, for this person, now. */
  why: string;
  checkout: ReturnType<typeof usePlanCheckout>;
}

function PlanRow({ planKey, lead, why, checkout }: PlanRowProps) {
  const plan = getPlan(planKey);
  if (!plan) return null;

  // Complete is never bought straight from a button: the coaching day is the
  // unit of scarcity (a class of six) and has to be chosen before Stripe sees
  // the order. Same split as the pricing table.
  const picksADay = planKey === 'complete';
  const busy = checkout.submitting === planKey;

  return (
    <div className="flex flex-wrap items-end justify-between gap-x-8 gap-y-3 py-5">
      <div className="min-w-0">
        <div className="flex items-baseline gap-2.5">
          <span className="text-[17px] font-semibold tracking-[-0.01em] text-heading">
            {plan.name}
          </span>
          <span className="font-mono text-[15px] font-bold text-heading">{plan.displayPrice}</span>
          <span className="text-[12px] text-muted">{plan.priceSuffix}</span>
        </div>
        <p className="mt-1 text-[13px] leading-relaxed text-muted">{why}</p>
      </div>

      {picksADay ? (
        <Link
          href="/coaching-day"
          className={
            lead
              ? 'flex-shrink-0 rounded-full bg-primary px-5 py-2.5 text-[13px] font-semibold text-white transition-opacity hover:opacity-90'
              : 'flex-shrink-0 rounded-full border border-heading/15 bg-white px-5 py-2.5 text-[13px] font-semibold text-heading transition-colors hover:bg-surface-warm'
          }
        >
          {plan.ctaLabel}
        </Link>
      ) : (
        <button
          type="button"
          onClick={() => checkout.start(planKey)}
          disabled={checkout.submitting !== null}
          className={
            lead
              ? 'flex-shrink-0 rounded-full bg-primary px-5 py-2.5 text-[13px] font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-60'
              : 'flex-shrink-0 rounded-full border border-heading/15 bg-white px-5 py-2.5 text-[13px] font-semibold text-heading transition-colors hover:bg-surface-warm disabled:opacity-60'
          }
        >
          {busy ? 'Redirecting…' : plan.ctaLabel}
        </button>
      )}
    </div>
  );
}

export default function TrialPlanOffer({
  /**
   * `profiles.exam_date` — the authority, already loaded with the dashboard's
   * stats.
   */
  examDate,
  /** The questionnaire fallback (`trial_leads.sca_sitting`), via /api/subscription. */
  examHint,
}: {
  examDate?: string | null;
  examHint?: string | null;
}) {
  const checkout = usePlanCheckout();
  const wall = wallPlansFor({ examDate, examHint });

  // The argument for each plan, in the reader's own situation. The imminent
  // case is the only one where the rolling plan is the honest recommendation,
  // and saying why out loud is what stops it reading as an upsell.
  const why: Record<'primary' | 'secondary', string> =
    wall.proximity === 'imminent'
      ? {
          primary: 'Month by month, cancel any time — the right shape when the exam is weeks away.',
          secondary: 'Adds the lectures and a coaching day in a class of six.',
        }
      : {
          primary: 'One payment, three months, nothing renews. All 200 cases, every one marked.',
          secondary: 'Everything in Self-Study, plus the lectures and a coaching day.',
        };

  return (
    <div>
      {/* Two rows between rules, not two cards. The house style, and the right
          one here: a card grid at this moment reads as a pricing page, which is
          the thing this surface is trying not to be. */}
      <div className="divide-y divide-hairline border-t border-hairline">
        <PlanRow planKey={wall.primary} lead why={why.primary} checkout={checkout} />
        <PlanRow planKey={wall.secondary} lead={false} why={why.secondary} checkout={checkout} />
      </div>

      {checkout.error && (
        <p className="mt-3 text-[12px] font-medium text-danger">{checkout.error}</p>
      )}

      <p className="mt-4 text-[12px] text-muted">
        {/* Quiet, and deliberately last. Two plans is a decision somebody can
            make; four is a comparison they postpone. The other two are still
            one click away for anyone who wants them. */}
        <Link href="/#pricing" className="hover:text-primary hover:underline">
          See all plans
        </Link>
      </p>
    </div>
  );
}
