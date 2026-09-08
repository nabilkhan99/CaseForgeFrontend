'use client';

import { useParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import FeedbackReport from '@/components/clinical-master/FeedbackReport';
import PricingTable from '@/components/landing/v5/PricingTable';
import { GuaranteeCard } from '@/components/landing/v5';
import EmailVerificationGate from '@/components/try/EmailVerificationGate';
import TrialProof from '@/components/try/TrialProof';
import VerdictReveal from '@/components/try/VerdictReveal';
import OpenDashboardButton from '@/components/try/OpenDashboardButton';
import StationsPassedBar from '@/components/progress/StationsPassedBar';
import { trialStationsPassed, type StationsPassed } from '@/lib/stations/passedProgress';
import {
  TRIAL_EMAIL_KEY,
  TRIAL_FEEDBACK_URL_KEY,
  TRIAL_USED_KEY,
} from '@/lib/trial/storage';

/**
 * The free mock station reveal: a verified email gate sits between finishing
 * the consultation and the full feedback report, which renders with the
 * pricing table directly beneath it. The gate emails a 6-digit code, so only
 * a deliverable address unlocks the report.
 */
export default function TryFeedbackPage() {
  const params = useParams();
  const sessionId = params.sessionId as string;

  const [unlocked, setUnlocked] = useState(false);
  const [checkingGate, setCheckingGate] = useState(true);
  /**
   * The address that unlocked this report, when this browser knows it — from
   * the gate they have just come through, or from the last time they did. Only
   * used to prefill /free/open, so a miss costs one typed address.
   */
  const [email, setEmail] = useState<string | null>(null);
  /**
   * Filled in by the report once it has been marked, so the bar can say whether
   * this station was passed rather than only that it was sat. Null until then —
   * the bar is not rendered on a guess.
   */
  const [progress, setProgress] = useState<StationsPassed | null>(null);

  // Whether this session is verified is a fact the server holds, not the
  // browser. Checking localStorage alone meant a session verified on a laptop
  // demanded the whole questionnaire again on a phone. localStorage stays as
  // an instant path so the usual case never waits on a request.
  useEffect(() => {
    let cancelled = false;

    try {
      const stored = window.localStorage.getItem(TRIAL_EMAIL_KEY);
      if (stored) {
        setEmail(stored);
        setUnlocked(true);
        setCheckingGate(false);
        return;
      }
    } catch {
      // Storage unavailable — fall through to the server check.
    }

    fetch(`/api/try/gate-status?sessionId=${encodeURIComponent(sessionId)}`)
      .then((res) => (res.ok ? res.json() : { verified: false }))
      .then((data: { verified?: boolean }) => {
        if (cancelled) return;
        if (data.verified) setUnlocked(true);
      })
      .catch(() => {
        // Network failure — show the gate rather than the report.
      })
      .finally(() => {
        if (!cancelled) setCheckingGate(false);
      });

    return () => {
      cancelled = true;
    };
  }, [sessionId]);

  function handleUnlock(verifiedEmail: string) {
    setEmail(verifiedEmail);
    try {
      window.localStorage.setItem(TRIAL_EMAIL_KEY, verifiedEmail);
      window.localStorage.setItem(TRIAL_USED_KEY, '1');
      window.localStorage.setItem(TRIAL_FEEDBACK_URL_KEY, `/try/feedback/${sessionId}`);
    } catch {
      // Storage unavailable — the reveal still works for this visit.
    }
    setUnlocked(true);
  }

  if (checkingGate) {
    return (
      <div className="min-h-[100dvh] flex items-center justify-center">
        <motion.div
          className="h-8 w-8 rounded-full border-2 border-primary border-t-transparent"
          animate={{ rotate: 360 }}
          transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
        />
      </div>
    );
  }

  if (!unlocked) {
    return (
      <div className="bg-surface">
        {/*
          Their own verdict, score and one-line summary, above the gate.
          Roughly a quarter of finishers abandon here, and until now they left
          without seeing a single mark from the consultation they had just sat.

          Only the summary crosses: the domain breakdown, the evidence and the
          "one change" stay below, which is what the email is being asked for.
          The gate is rendered unconditionally and never waits on this — see
          VerdictReveal, which renders nothing at all if the mark never lands.
        */}
        <VerdictReveal sessionId={sessionId} />
        <EmailVerificationGate sessionId={sessionId} onUnlock={handleUnlock} />
      </div>
    );
  }

  return (
    <div className="bg-surface">
      <FeedbackReport
        sessionId={sessionId}
        variant="trial"
        onResult={(overall) => setProgress(trialStationsPassed(overall.verdict, overall.weighted_score))}
      />

      {/* One way on, and it is the free thing they already own rather than the
          paid thing they might buy — hence above the pricing table. Verifying
          the address created the account and granted the five, so the other
          four stations exist; this is the way into them from a browser that may
          not be the one that sat this consultation. */}
      <div className="mx-auto max-w-[1180px] px-5 pb-6 sm:px-7 lg:px-10">
        <div className="border-t border-[#E4DDC9] pt-10 text-center">
          <OpenDashboardButton email={email} />
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
