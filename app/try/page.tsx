'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import Container from '@/components/ui/Container';
import PrimaryButton from '@/components/ui/PrimaryButton';
import DomainTag from '@/components/ui/DomainTag';

interface FreeCaseStation {
  id: string;
  title: string;
  patient_name: string;
  patient_age: number;
  difficulty: string;
  reading_duration_seconds: number;
  consultation_duration_seconds: number;
  domains: { id: string; name: string } | null;
}

export default function TryCasePickerPage() {
  const [cases, setCases] = useState<FreeCaseStation[]>([]);
  const [loading, setLoading] = useState(true);
  const [trialUsed, setTrialUsed] = useState(false);

  useEffect(() => {
    // Check free trial cookie
    if (document.cookie.includes('ff_free_trial_used=true')) {
      setTrialUsed(true);
      setLoading(false);
      return;
    }

    async function fetchFreeCases() {
      try {
        const res = await fetch('/api/try/free-cases');
        if (res.ok) {
          const data = await res.json();
          setCases(data.stations || []);
        }
      } catch {
        // Handle silently
      } finally {
        setLoading(false);
      }
    }
    fetchFreeCases();
  }, []);

  if (trialUsed) {
    return (
      <div className="min-h-[100dvh] flex flex-col items-center justify-center px-6 py-16">
        <motion.div
          className="text-center max-w-md"
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ type: 'spring', stiffness: 60, damping: 20 }}
        >
          <div
            className="w-14 h-14 rounded-2xl flex items-center justify-center mx-auto mb-5"
            style={{ background: 'rgba(180,83,9,0.08)' }}
          >
            <svg className="w-7 h-7 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <h1 className="text-[28px] font-bold text-heading tracking-[-0.02em] mb-3">
            You&apos;ve Tried Your Free Case
          </h1>
          <p className="text-[15px] text-muted leading-relaxed mb-8">
            Sign up to unlock unlimited practice sessions and track your progress across all 250+ cases.
          </p>
          <div className="space-y-3">
            <Link href="/auth/sign-up" className="block">
              <PrimaryButton fullWidth>Create Account</PrimaryButton>
            </Link>
            <Link href="/pricing" className="block">
              <button className="w-full min-h-[44px] py-2.5 text-[14px] font-medium text-primary hover:underline cursor-pointer">
                See Plans &rarr;
              </button>
            </Link>
          </div>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-[100dvh] flex flex-col items-center justify-center px-6 py-16">
      {/* Header */}
      <motion.div
        className="text-center mb-10 max-w-lg"
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ type: 'spring', stiffness: 60, damping: 20 }}
      >
        <span
          className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg text-[11px] font-semibold uppercase tracking-wide mb-4"
          style={{ background: 'rgba(180,83,9,0.06)', color: '#92400E' }}
        >
          Free Trial
        </span>
        <h1 className="text-[32px] font-bold text-heading tracking-[-0.02em] mb-3">
          Try a Free Case
        </h1>
        <p className="text-[15px] text-muted leading-relaxed">
          Pick a station and start a consultation. No account needed.
        </p>
      </motion.div>

      {/* Cases */}
      {loading ? (
        <motion.div
          className="w-8 h-8 rounded-full border-2 border-primary border-t-transparent"
          animate={{ rotate: 360 }}
          transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
        />
      ) : (
        <div className="w-full max-w-[600px] space-y-4">
          {cases.map((station, i) => {
            const domainName = station.domains?.name || 'General Practice';
            return (
              <motion.div
                key={station.id}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.08 }}
              >
                <Container>
                  <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 sm:gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="text-[16px] font-semibold text-heading mb-1">{station.title}</div>
                      <div className="flex items-center gap-2 mb-2">
                        <span className="text-[13px] text-muted">
                          {station.patient_name}, {station.patient_age}y
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <DomainTag name={domainName} size="sm" />
                        <span
                          className="text-[11px] font-mono font-semibold px-2 py-0.5 rounded-md"
                          style={{ background: 'rgba(180,83,9,0.06)', color: '#92400E' }}
                        >
                          {Math.floor((station.consultation_duration_seconds || 300) / 60)} min
                        </span>
                      </div>
                    </div>
                    <Link href={`/try/station/${station.id}`}>
                      <PrimaryButton size="sm">Start</PrimaryButton>
                    </Link>
                  </div>
                </Container>
              </motion.div>
            );
          })}
        </div>
      )}

      {/* Bottom info */}
      <motion.div
        className="mt-10 text-center"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.4 }}
      >
        <p className="text-[13px] text-muted mb-3">
          After completing your consultation, sign up to receive your detailed AI feedback report.
        </p>
        <Link
          href="/auth/sign-in"
          className="text-[13px] text-primary hover:underline font-medium transition-colors"
        >
          Already have an account? Sign in
        </Link>
      </motion.div>
    </div>
  );
}
