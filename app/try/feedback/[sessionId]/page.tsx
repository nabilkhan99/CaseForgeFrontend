'use client';

import { useParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { ArrowRight } from 'lucide-react';
import FeedbackReport from '@/components/clinical-master/FeedbackReport';
import PricingTable from '@/components/landing/v5/PricingTable';
import { GuaranteeCard } from '@/components/landing/v5';
import {
  TRIAL_EMAIL_KEY,
  TRIAL_FEEDBACK_URL_KEY,
  TRIAL_USED_KEY,
} from '@/lib/trial/storage';

/**
 * The free mock station reveal: an email-only gate sits between finishing the
 * consultation and the full feedback report, which renders with the pricing
 * table directly beneath it. No password, no account, no confirmation email.
 */
export default function TryFeedbackPage() {
  const params = useParams();
  const sessionId = params.sessionId as string;

  const [email, setEmail] = useState('');
  const [unlocked, setUnlocked] = useState(false);
  const [checkingGate, setCheckingGate] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Returning visitors who already gave their email skip the gate.
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

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (submitting) return;
    setSubmitting(true);
    setError(null);

    try {
      const res = await fetch('/api/try/capture-lead', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId, email: email.trim() }),
      });
      const data = (await res.json()) as { ok?: boolean; error?: string };
      if (!res.ok || !data.ok) {
        setError(data.error ?? 'Something went wrong — please try again.');
        setSubmitting(false);
        return;
      }

      try {
        window.localStorage.setItem(TRIAL_EMAIL_KEY, email.trim().toLowerCase());
        window.localStorage.setItem(TRIAL_USED_KEY, '1');
        window.localStorage.setItem(TRIAL_FEEDBACK_URL_KEY, `/try/feedback/${sessionId}`);
      } catch {
        // Storage unavailable — the reveal still works for this visit.
      }
      setUnlocked(true);
    } catch {
      setError('Something went wrong — please try again.');
      setSubmitting(false);
    }
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
      <div className="min-h-[100dvh] flex items-center justify-center px-6 py-16">
        <motion.div
          className="w-full max-w-md"
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ type: 'spring', stiffness: 60, damping: 20 }}
        >
          <div className="rounded-[22px] border border-black/[0.06] bg-surface-raised p-7 text-center shadow-[0_16px_42px_rgba(180,83,9,0.06)] sm:p-9">
            <span
              className="mb-4 inline-flex items-center gap-1.5 rounded-lg px-3 py-1 text-[11px] font-semibold uppercase tracking-wide"
              style={{ background: 'rgba(22,163,74,0.08)', color: '#16A34A' }}
            >
              Consultation complete
            </span>
            <h1 className="mb-2 text-[26px] font-bold tracking-[-0.02em] text-heading">
              Your report is being marked
            </h1>
            <p className="mb-7 text-[14px] leading-relaxed text-muted">
              Enter your email to unlock your full feedback report — scored across the three SCA
              marking domains, just like the real exam.
            </p>

            <form onSubmit={handleSubmit} className="space-y-4 text-left">
              <div>
                <label
                  htmlFor="trial-email"
                  className="mb-1.5 block text-[13px] font-medium text-heading"
                >
                  Email address
                </label>
                <input
                  id="trial-email"
                  type="email"
                  required
                  autoComplete="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="doctor@example.com"
                  className="w-full rounded-xl border border-stone-200 bg-white px-4 py-3 text-[14px] text-heading outline-none transition-colors placeholder:text-stone-400 focus:border-primary"
                />
              </div>

              {error && (
                <div className="rounded-lg border border-danger/20 bg-danger/10 p-3">
                  <p className="text-center text-sm text-danger">{error}</p>
                </div>
              )}

              <button
                type="submit"
                disabled={submitting}
                className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-[#EF9F27] px-6 py-3.5 text-sm font-semibold text-[#2C2C2A] shadow-[0_3px_12px_rgba(186,117,23,0.4)] transition-all hover:brightness-105 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {submitting ? 'Unlocking…' : 'See my feedback'}
                {!submitting && <ArrowRight className="h-4 w-4" />}
              </button>
            </form>

            <p className="mt-4 text-[11px] leading-relaxed text-muted">
              By continuing you agree to receive occasional emails about the course — unsubscribe
              anytime.
            </p>
            <p className="mt-3 text-[12px] text-muted">
              Already have an account?{' '}
              <Link href="/auth/sign-in" className="text-primary hover:underline">
                Sign in
              </Link>
            </p>
          </div>
        </motion.div>
      </div>
    );
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
