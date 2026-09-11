'use client';

import Link from 'next/link';
import { motion } from 'framer-motion';
import TrialPlanOffer from '@/components/dashboard/TrialPlanOffer';
import { trialCountdown, trialProgressLine, trialTitleLine } from '@/lib/trial/trialPanelCopy';
import type { Station } from '@/lib/supabase/queries/station-library';
import type { TrialSubscription } from '@/app/api/subscription/route';

/**
 * The whole of a trial account's dashboard, at the top of it.
 *
 * REPLACES THE ONE-LINE STRIP, and the change is not cosmetic. The strip was
 * built for an allowance — "3 of 5 left" is standing status, and a hairline row
 * is the right weight for status somebody reads on every load for five days.
 * The offer is now five NAMED cases with unlimited attempts, which means the
 * dashboard has to answer a question the strip never could: *which five, and
 * where do I start*. A list of five cases with a Start beside each is the
 * shortest honest answer, and it is the page's primary action, so it leads.
 *
 * THE NOUN IS "CASES" for the five, everywhere a reader can see it — the same
 * word /free, the pricing table and the two emails use. "Station" is the whole
 * bank's word, and the bank is a different number about a different thing.
 *
 * FOUR THINGS, IN THIS ORDER, and the order is the argument:
 *   1. what the offer is  — "Unlimited attempts · five cases". First,
 *      because a trainee who saw the old five-consultation version is
 *      rationing, and rationing is the behaviour this is trying to stop.
 *   2. how long it runs   — a real date, never a manufactured countdown.
 *   3. how far through     — cases tried, not consultations. Repeating a case
 *      is the point of the offer, so counting attempts here would read as
 *      progress toward a limit that does not exist.
 *   4. the five cases      — with Start, in `free_trial_order` (chosen as
 *      pairs: a near miss, then a case where the same "one change" applies).
 *
 * THE UPGRADE OFFER IS HERE, NOT ONLY AT THE WALL. Two plans chosen by exam
 * date, from day one. Deliberately last and deliberately quiet — a person who
 * has just been handed five cases is not ready to buy, but a person on their
 * third run at case two has already decided and should not have to wait for a
 * wall to find a price. The wall (TrialWall) still exists for `trial_ended`;
 * this is the same offer, made earlier and with less weight.
 *
 * The word "trial" does not appear, deliberately. It is what the thing is
 * called internally and reads to a reader as a countdown to being sold
 * something.
 */

export default function TrialPanel({
  trial,
  /**
   * The five, resolved against the library index the dashboard has already
   * loaded — so a case reads here exactly as it does on the board, with its own
   * attempt history, and there is no second fetch to disagree with the first.
   * Empty while that index is loading, and empty if nothing is flagged.
   */
  stations,
  /** `profiles.exam_date`, for the plan choice. The questionnaire hint is on `trial`. */
  examDate,
}: {
  trial: TrialSubscription;
  stations: Station[];
  examDate?: string | null;
}) {
  const countdown = trialCountdown(trial.daysLeft, trial.expiresAt, trial.windowDays);
  const caseCount = trial.allowance;

  return (
    <motion.section
      aria-labelledby="trial-panel-heading"
      className="mb-10 tall:mb-14 border-y border-hairline py-7 tall:py-9"
      initial={{ opacity: 0, y: -4 }}
      animate={{ opacity: 1, y: 0 }}
    >
      <div className="text-[10px] font-semibold uppercase tracking-[0.13em] text-primary">
        Your free week
      </div>

      <h2
        id="trial-panel-heading"
        className="mt-2 text-[24px] font-bold leading-[1.2] tracking-[-0.025em] text-heading"
      >
        {trialTitleLine(caseCount)}
      </h2>

      {/* The deadline and the progress on one line: two facts, neither of which
          is worth a paragraph, and both of which are read at a glance. The
          deadline goes tinted on the last day, following the same rule the plan
          expiry prompts on this page follow — status is quiet, a deadline that
          can still change the outcome is not. */}
      <p className="mt-2 flex flex-wrap items-baseline gap-x-2 text-[13.5px] leading-relaxed">
        <span className={countdown.urgent ? 'font-medium text-primary' : 'text-heading'}>
          {countdown.headline}
        </span>
        {countdown.endsOn && (
          <>
            <span aria-hidden="true" className="text-black/20">
              &middot;
            </span>
            <span className="text-muted">{countdown.endsOn}</span>
          </>
        )}
        <span aria-hidden="true" className="text-black/20">
          &middot;
        </span>
        <span className="text-muted">{trialProgressLine(trial.casesTried, caseCount)}</span>
      </p>

      {/* The five, or an honest empty state. `freeStationIds` comes back empty
          when nothing carries the flag AND when the lookup failed — the trial
          fails closed to "opens nothing" — so this must not render as though
          the cases merely have not loaded. */}
      {stations.length > 0 ? (
        <ul className="mt-5 divide-y divide-hairline border-t border-hairline">
          {stations.map((station, index) => {
            const attempts = trial.attemptsByStation[station.id] ?? 0;
            return (
              <li
                key={station.id}
                className="flex flex-wrap items-center justify-between gap-x-6 gap-y-2 py-4"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex items-baseline gap-2.5">
                    {/* The pair order is the whole point of `free_trial_order`,
                        so it is numbered rather than left to be inferred. */}
                    <span className="font-mono text-[12px] font-semibold text-primary/40">
                      {String(index + 1).padStart(2, '0')}
                    </span>
                    <span className="min-w-0 text-[15px] font-semibold leading-snug text-heading">
                      {station.title}
                    </span>
                  </div>
                  <div className="mt-0.5 pl-[26px] text-[12px] text-muted">
                    {station.domain_name} &middot;{' '}
                    {Math.round(station.consultation_duration_seconds / 60)} min
                    {attempts > 0 && (
                      <>
                        {' '}
                        &middot; {attempts} attempt{attempts !== 1 ? 's' : ''}
                      </>
                    )}
                  </div>
                </div>
                <Link
                  href={`/clinical-master/station/${station.id}`}
                  className="flex-shrink-0 text-[13px] font-semibold text-primary hover:underline focus-visible-ring"
                >
                  {/* "Start" for a case never opened, "Run it again" once it
                      has — the sentence that tells somebody repeating is
                      allowed, at the moment they are deciding whether to. */}
                  {attempts > 0 ? 'Run it again' : 'Start'} &rarr;
                </Link>
              </li>
            );
          })}
        </ul>
      ) : (
        <p className="mt-4 text-[13px] text-muted">
          Your cases are being set up. Nothing is lost &mdash; your five days do not start until
          your first consultation.
        </p>
      )}

      {/* The offer, from day one. Under a rule so it reads as a footnote to the
          five cases above rather than a second headline competing with them. */}
      <div className="mt-8">
        <p className="text-[10px] font-semibold uppercase tracking-[0.13em] text-primary">
          When you want the other 195
        </p>
        <p className="mt-1.5 max-w-xl text-[13px] leading-relaxed text-muted">
          These five stay yours for the week. The full bank is 200 cases, every one marked the same
          way.
        </p>
        <div className="mt-3">
          <TrialPlanOffer examDate={examDate} examHint={trial.examHint} />
        </div>
      </div>
    </motion.section>
  );
}
