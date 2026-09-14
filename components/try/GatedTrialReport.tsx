'use client';

import { useState } from 'react';
import FeedbackReport from '@/components/clinical-master/FeedbackReport';
import PricingTable from '@/components/landing/v5/PricingTable';
import { GuaranteeCard } from '@/components/landing/v5';
import EmailVerificationGate from '@/components/try/EmailVerificationGate';
import TrialProof from '@/components/try/TrialProof';
import StationsPassedBar from '@/components/progress/StationsPassedBar';
import { trialStationsPassed, type StationsPassed } from '@/lib/stations/passedProgress';
import {
  TRIAL_EMAIL_KEY,
  TRIAL_FEEDBACK_URL_KEY,
  TRIAL_USED_KEY,
  markTrialClaimed,
} from '@/lib/trial/storage';

/**
 * A report opened from a link this browser did not run: the page main had.
 *
 * Old report links (from before the guest cookie existed, forwarded ones, the
 * one in a founder's lead alert) behave exactly as they did on main (owner
 * decision, Sept 2026). A lead that has already verified its address sees the
 * full report straight away; anybody else gets the email gate first, then the
 * report. The offer, the stations bar, the quotes and the plans sit under it
 * as they did.
 *
 * `verified` is decided on the server by /try/feedback, from the lead row, so
 * a session verified on a laptop opens on a phone without asking again. Once
 * the gate has been passed in this visit the report opens in place.
 */

interface GatedTrialReportProps {
  sessionId: string;
  /** The lead on this session has verified its email. */
  verified: boolean;
}

export default function GatedTrialReport({ sessionId, verified }: GatedTrialReportProps) {
  const [unlocked, setUnlocked] = useState(verified);
  /**
   * Filled in by the report once it has been marked, so the bar can say whether
   * this station was passed rather than only that it was sat. Null until then:
   * the bar is not rendered on a guess.
   */
  const [progress, setProgress] = useState<StationsPassed | null>(null);

  function handleUnlock(email: string) {
    try {
      window.localStorage.setItem(TRIAL_EMAIL_KEY, email);
      window.localStorage.setItem(TRIAL_USED_KEY, '1');
      window.localStorage.setItem(TRIAL_FEEDBACK_URL_KEY, `/try/feedback/${sessionId}`);
    } catch {
      // Storage unavailable. The report still opens for this visit.
    }
    // The report behind this link is readable now, so the navbar can offer it.
    markTrialClaimed();
    setUnlocked(true);
  }

  if (!unlocked) {
    return <EmailVerificationGate sessionId={sessionId} onUnlock={handleUnlock} />;
  }

  return (
    <div className="bg-surface">
      <FeedbackReport
        sessionId={sessionId}
        variant="trial"
        onResult={(overall) => setProgress(trialStationsPassed(overall.verdict, overall.weighted_score))}
      />

      {/* The offer, at the moment the product has just proved itself. */}
      <div className="mx-auto max-w-[1180px] px-5 pb-6 sm:px-7 lg:px-10">
        <div className="border-t border-[#E4DDC9] pt-10 text-center">
          <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[#854F0B] sm:text-xs">
            That was 1 of 200 cases
          </p>
          <h2 className="mx-auto mt-2 max-w-xl text-2xl font-semibold tracking-tight text-heading sm:text-3xl">
            Keep practising until you pass, or we pay you £500.
          </h2>
        </div>
      </div>

      {/* One tick of two hundred: the gap is the argument. */}
      {progress && (
        <div className="mx-auto max-w-[1180px] px-5 pb-10 sm:px-7 lg:px-10">
          <StationsPassedBar progress={progress} variant="trial" ground="#FAFAF7" />
        </div>
      )}

      {/* Someone else's word for it, before the price rather than after. */}
      <TrialProof />

      <PricingTable />
      <GuaranteeCard />
    </div>
  );
}
