'use client';

import { useParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import FeedbackReport from '@/components/clinical-master/FeedbackReport';
import PricingTable from '@/components/landing/v5/PricingTable';
import { GuaranteeCard } from '@/components/landing/v5';
import EmailVerificationGate from '@/components/try/EmailVerificationGate';
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

  // Returning visitors who already verified their email skip the gate.
  useEffect(() => {
    try {
      if (window.localStorage.getItem(TRIAL_EMAIL_KEY)) {
        setUnlocked(true);
      }
    } catch {
      // Storage unavailable — show the gate.
    }
    setCheckingGate(false);
  }, []);

  function handleUnlock(email: string) {
    try {
      window.localStorage.setItem(TRIAL_EMAIL_KEY, email);
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
    return <EmailVerificationGate sessionId={sessionId} onUnlock={handleUnlock} />;
  }

  return (
    <div className="bg-surface">
      <FeedbackReport sessionId={sessionId} variant="trial" />

      {/* The offer, at the moment the product has just proved itself. */}
      <div className="mx-auto max-w-[1180px] px-5 pb-6 sm:px-7 lg:px-10">
        <div className="border-t border-[#E4DDC9] pt-10 text-center">
          <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[#854F0B] sm:text-xs">
            That was 1 of 200 stations
          </p>
          <h2 className="mx-auto mt-2 max-w-xl text-2xl font-semibold tracking-tight text-heading sm:text-3xl">
            Keep practising until you pass — or we pay you £500.
          </h2>
        </div>
      </div>
      <PricingTable />
      <GuaranteeCard />
    </div>
  );
}
