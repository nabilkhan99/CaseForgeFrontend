'use client';

import { motion } from 'framer-motion';
import type { TrialSubscription } from '@/app/api/subscription/route';

/**
 * Where a trainee stands in their five free stations.
 *
 * Two sentences, one line, at the top of the dashboard — this is standing
 * status somebody reads on every load for up to five days, so it is a hairline
 * row like the "your access hasn't opened yet" strip, not a card competing with
 * the page's primary action.
 *
 * It goes tinted for the last station or the last day, following the same rule
 * the expiry prompts on this page already follow: status is quiet, a deadline
 * that can still change the outcome is not. That is the moment the wall becomes
 * imminent and the only moment the strip is worth interrupting for.
 *
 * The word "trial" does not appear, deliberately. The offer is "five stations,
 * five days, no card"; "trial" is what it is called internally and reads as a
 * countdown to being sold something.
 */

const DAY_MS = 86_400_000;

/** Whole days from now until `iso`, rounded up. Negative once it has passed. */
function daysUntil(iso: string): number {
  return Math.ceil((new Date(iso).getTime() - Date.now()) / DAY_MS);
}

/**
 * "Thursday 12 September", in the reader's own timezone.
 *
 * NOT forced to UTC, unlike the coaching-day and expiry dates on this page.
 * Those are stored as calendar days (`YYYY-MM-DD`) and reading them locally
 * would shift them; this is a real instant, so the local day is the true answer
 * to "when does this stop working".
 */
function formatDay(iso: string): string {
  return new Date(iso).toLocaleDateString('en-GB', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  });
}

export default function TrialStrip({ trial }: { trial: TrialSubscription }) {
  const notStarted = trial.startedAt === null;
  const daysLeft = trial.expiresAt ? daysUntil(trial.expiresAt) : null;

  // The last station, or the last day. Either is a deadline rather than status.
  const urgent = !notStarted && (trial.remaining <= 1 || (daysLeft !== null && daysLeft <= 1));

  return (
    <motion.div
      className={
        urgent
          ? 'mb-6 tall:mb-8 rounded-[10px] border border-primary/[0.18] bg-primary/[0.08] px-4 py-3'
          : 'mb-6 tall:mb-8 border-y border-hairline py-3.5'
      }
      initial={{ opacity: 0, y: -4 }}
      animate={{ opacity: 1, y: 0 }}
    >
      <p className="text-[13px] text-heading">
        {notStarted ? (
          // Before the first consultation the clock is not running, and saying
          // so is the point: somebody handed a link on a Friday needs to know
          // the weekend is not being spent.
          <>
            <span className="font-medium">
              {trial.allowance} station{trial.allowance !== 1 ? 's' : ''}
            </span>{' '}
            &middot; {trial.windowDays} day{trial.windowDays !== 1 ? 's' : ''} &middot;{' '}
            <span className="text-muted">
              not started &mdash; your five days begin with your first consultation
            </span>
          </>
        ) : (
          <>
            <span className="font-medium">
              {trial.remaining} of {trial.allowance} left
            </span>
            {trial.expiresAt && (
              <>
                {' '}
                &middot;{' '}
                <span className={urgent ? 'text-heading' : 'text-muted'}>
                  ends {formatDay(trial.expiresAt)}
                </span>
              </>
            )}
          </>
        )}
      </p>
    </motion.div>
  );
}
