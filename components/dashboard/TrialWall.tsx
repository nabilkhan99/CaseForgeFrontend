'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { getPlan, type PlanKey } from '@/lib/commerce/plans';
import { wallPlansFor } from '@/lib/commerce/trialWallPlans';
import { trackTrialWallHit } from '@/lib/trial/trialEvents';
import type { TrialSubscription } from '@/app/api/subscription/route';

/**
 * The end of the five stations.
 *
 * Two plans, not four, chosen by how close the exam is — see
 * lib/commerce/trialWallPlans.ts for why that is the axis. Everything the
 * trainee has already done stays exactly where it was: their reports, the board
 * and the Development page are all reachable from the nav above this, and none
 * of them was ever gated on the grant. Only stations lock, and this says so
 * rather than leaving them to discover it by clicking one.
 *
 * A "wall" in name only, then — it is the one screen in the funnel where
 * somebody has actually used the product and can judge it, so it argues from
 * what they did rather than from a feature list.
 */

/** How the two plans are bought. Self-Study posts to checkout; Complete picks a day first. */
function usePlanCheckout() {
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

/** The headline, which turns entirely on why the trial stopped. */
function heading(trial: TrialSubscription): { title: string; body: string } {
  if (trial.reason === 'expiry') {
    return {
      title: 'Your five days are up',
      body:
        trial.remaining > 0
          ? `You had ${trial.remaining} station${trial.remaining === 1 ? '' : 's'} left. Everything you did is still here — pick up where you stopped.`
          : 'Everything you did is still here — your reports, your board and your development picture.',
    };
  }
  return {
    title: `That's all ${trial.allowance} free stations`,
    body: 'Everything you did is still here — your reports, your board and your development picture. There are 200 cases in the bank.',
  };
}

interface PlanCardProps {
  planKey: PlanKey;
  lead: boolean;
  /** One sentence saying why this plan, for this person, now. */
  why: string;
  checkout: ReturnType<typeof usePlanCheckout>;
}

function PlanRow({ planKey, lead, why, checkout }: PlanCardProps) {
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

export default function TrialWall({
  trial,
  /**
   * `profiles.exam_date` — the authority, already loaded with the dashboard's
   * stats. `trial.examHint` is the fallback, derived from the questionnaire
   * answer, because most trialists never fill the dashboard's date field.
   */
  examDate,
}: {
  trial: TrialSubscription;
  examDate?: string | null;
}) {
  const checkout = usePlanCheckout();
  const wall = wallPlansFor({ examDate, examHint: trial.examHint });
  const { title, body } = heading(trial);

  // Fired once per mount, not per render, and not on the server: this is the
  // conversion moment the whole funnel is measured against, and double-counting
  // it on a re-render would quietly inflate the denominator of every rate
  // computed from it.
  useEffect(() => {
    trackTrialWallHit(trial.reason ?? 'allowance');
  }, [trial.reason]);

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
    <motion.section
      aria-labelledby="trial-wall-heading"
      className="mb-10 tall:mb-14 border-y border-hairline py-7 tall:py-9"
      initial={{ opacity: 0, y: -4 }}
      animate={{ opacity: 1, y: 0 }}
    >
      <div className="text-[10px] font-semibold uppercase tracking-[0.13em] text-primary">
        Keep practising
      </div>
      <h2
        id="trial-wall-heading"
        className="mt-2 text-[24px] font-bold leading-[1.2] tracking-[-0.025em] text-heading"
      >
        {title}
      </h2>
      <p className="mt-2 max-w-xl text-[13.5px] leading-relaxed text-body">{body}</p>

      {/* Two rows between rules, not two cards. The house style, and the right
          one here: a card grid at this moment reads as a pricing page, which is
          the thing this screen is trying not to be. */}
      <div className="mt-5 divide-y divide-hairline border-t border-hairline">
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
    </motion.section>
  );
}
