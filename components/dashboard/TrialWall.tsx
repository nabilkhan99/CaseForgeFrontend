'use client';

import { useEffect } from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import TrialPlanOffer from '@/components/dashboard/TrialPlanOffer';
import { trackTrialWallHit } from '@/lib/trial/trialEvents';
import { numberWord } from '@/lib/trial/trialPanelCopy';
import type { TrialSubscription } from '@/app/api/subscription/route';

/**
 * The end of the five days.
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
 *
 * SINCE 7 SEPTEMBER 2026 IT HAS ONE TRIGGER. The trial used to end two ways —
 * the stations ran out, or the days did — and the headline turned on which. It
 * is now five cases with unlimited attempts, so there is nothing to exhaust and
 * expiry is the only way here. The offer itself is unchanged, and it is no
 * longer this screen's first appearance: TrialPanel has been making it on the
 * dashboard since day one, which is why this can lead with what they did rather
 * than with a price.
 */

/** The headline. One reason to be here now, so one thing to say. */
function heading(trial: TrialSubscription): { title: string; body: string } {
  const untried = Math.max(0, trial.remaining);
  return {
    title: `Your ${numberWord(trial.windowDays)} days are up`,
    body:
      untried > 0
        ? `You tried ${trial.casesTried} of the ${numberWord(trial.allowance)}. Everything you did is still here — your reports, your board and your development picture.`
        : 'You ran all of them. Everything you did is still here — your reports, your board and your development picture. There are 200 cases in the bank.',
  };
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
  const { title, body } = heading(trial);

  // Fired once per mount, not per render, and not on the server: this is the
  // conversion moment the whole funnel is measured against, and double-counting
  // it on a re-render would quietly inflate the denominator of every rate
  // computed from it.
  useEffect(() => {
    trackTrialWallHit('expiry');
  }, []);

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

      <div className="mt-5">
        <TrialPlanOffer examDate={examDate} examHint={trial.examHint} />
      </div>

      <p className="mt-3 text-[12px] text-muted">
        Your reports and{' '}
        <Link href="/dashboard/library" className="hover:text-primary hover:underline">
          your board
        </Link>{' '}
        stay open either way.
      </p>
    </motion.section>
  );
}
