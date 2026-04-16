'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import Link from 'next/link';
import LandingNavbar from '@/components/landing/LandingNavbar';
import { createClient } from '@/lib/supabase/client';
import { NumberTicker } from '@/components/magicui/number-ticker';

type FormState = 'idle' | 'loading' | 'success';

export default function WaitlistPage() {
  const [user, setUser] = useState<{ id: string } | null>(null);
  const [email, setEmail] = useState('');
  const [formState, setFormState] = useState<FormState>('idle');
  const [error, setError] = useState('');
  const [waitlistCount, setWaitlistCount] = useState(0);

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then(({ data }) => setUser(data.user as { id: string } | null));
  }, []);

  useEffect(() => {
    fetch('/api/waitlist')
      .then((res) => res.json())
      .then((data) => setWaitlistCount(data.count))
      .catch(() => {});
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setError('Please enter a valid email address.');
      return;
    }

    setFormState('loading');

    try {
      const res = await fetch('/api/waitlist', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Something went wrong');
      }

      setFormState('success');
      setWaitlistCount((prev) => prev + 1);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong. Please try again.');
      setFormState('idle');
    }
  };

  return (
    <div className="min-h-[100dvh] bg-surface relative overflow-hidden">
      {/* Warm ambient orb */}
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_70%_30%,rgba(180,83,9,0.05)_0%,transparent_55%)] pointer-events-none" />
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_80%,rgba(180,83,9,0.03)_0%,transparent_45%)] pointer-events-none" />

      <LandingNavbar user={user} hideAuth />

      <main className="flex items-center justify-center px-4 pt-32 pb-16 min-h-[100dvh]">
        <div className="w-full max-w-lg relative z-10">
          <AnimatePresence mode="wait">
            {formState !== 'success' ? (
              <motion.div
                key="form"
                initial={{ opacity: 0, y: 24 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -16 }}
                transition={{ type: 'spring', stiffness: 60, damping: 20 }}
                className="bg-white/60 backdrop-blur-xl border border-black/[0.04] rounded-2xl p-6 sm:p-10 shadow-elevation-2"
              >
                {/* Eyebrow */}
                <motion.span
                  className="text-[10px] font-mono font-semibold tracking-[0.14em] uppercase text-primary block mb-4"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 0.1 }}
                >
                  AI Consultations · Coming Soon
                </motion.span>

                {/* Heading */}
                <motion.h1
                  className="text-[28px] sm:text-[36px] font-bold text-heading tracking-[-0.02em] leading-[1.15] mb-3"
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.15, type: 'spring', stiffness: 60, damping: 20 }}
                >
                  Be the first to practise with AI patients
                </motion.h1>

                {/* Subtext */}
                <motion.p
                  className="text-[15px] text-muted leading-[1.7] mb-8"
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.2, type: 'spring', stiffness: 60, damping: 20 }}
                >
                  AI patients that talk back, push back, and score you on every SCA domain. Be the first to try it.
                </motion.p>

                {/* Email form */}
                <motion.form
                  onSubmit={handleSubmit}
                  className="flex flex-col sm:flex-row gap-3 mb-4"
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.25, type: 'spring', stiffness: 60, damping: 20 }}
                >
                  <div className="flex-1 relative">
                    <svg
                      className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-muted pointer-events-none"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                      strokeWidth={2}
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"
                      />
                    </svg>
                    <input
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="you@nhs.net"
                      disabled={formState === 'loading'}
                      className="w-full bg-white/70 border border-black/[0.06] rounded-xl pl-11 pr-4 py-3.5 text-[14px] text-heading placeholder:text-muted/60 focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary/30 transition-all disabled:opacity-60"
                    />
                  </div>
                  <motion.button
                    type="submit"
                    disabled={formState === 'loading'}
                    className="px-7 py-3.5 rounded-xl text-[14px] font-semibold text-white whitespace-nowrap disabled:opacity-70 cursor-pointer"
                    style={{
                      background: 'linear-gradient(135deg, #B45309, #D97706)',
                      boxShadow: '0 4px 16px rgba(180,83,9,0.18)',
                    }}
                    whileHover={{ y: -2, boxShadow: '0 8px 24px rgba(180,83,9,0.25)' }}
                    whileTap={{ scale: 0.98 }}
                  >
                    {formState === 'loading' ? (
                      <span className="flex items-center gap-2">
                        <motion.span
                          animate={{ rotate: 360 }}
                          transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
                          className="inline-block w-4 h-4 border-2 border-white/30 border-t-white rounded-full"
                        />
                        Joining...
                      </span>
                    ) : (
                      'Join the waitlist'
                    )}
                  </motion.button>
                </motion.form>

                {/* Error message */}
                {error && (
                  <motion.p
                    initial={{ opacity: 0, y: -4 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="text-[13px] text-red-600 mb-3"
                  >
                    {error}
                  </motion.p>
                )}

                {/* Fine print */}
                <motion.p
                  className="text-[12px] text-muted text-center sm:text-left mb-6"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 0.35 }}
                >
                  No spam, ever. Just one email when we launch.
                </motion.p>

                {/* Counter */}
                {waitlistCount > 0 && (
                  <motion.div
                    className="flex items-center justify-center sm:justify-start gap-2 text-[13px] text-body mb-4"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 0.4 }}
                  >
                    <span className="w-2 h-2 rounded-full bg-primary/40" />
                    <span>
                      Join{' '}
                      <NumberTicker
                        value={waitlistCount}
                        className="font-semibold text-heading text-[13px]"
                      />{' '}
                      trainees on the waitlist
                    </span>
                  </motion.div>
                )}

              </motion.div>
            ) : (
              <motion.div
                key="success"
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ type: 'spring', stiffness: 60, damping: 20 }}
                className="bg-white/60 backdrop-blur-xl border border-black/[0.04] rounded-2xl p-6 sm:p-10 shadow-elevation-2 text-center"
              >
                {/* Animated checkmark circle */}
                <motion.div
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={{ type: 'spring', stiffness: 200, damping: 12, delay: 0.1 }}
                  className="w-20 h-20 rounded-full mx-auto mb-6 flex items-center justify-center"
                  style={{
                    background: 'linear-gradient(135deg, #B45309, #D97706)',
                    boxShadow: '0 8px 32px rgba(180,83,9,0.2)',
                  }}
                >
                  <motion.svg
                    width="32"
                    height="32"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="white"
                    strokeWidth="3"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    initial={{ pathLength: 0 }}
                    animate={{ pathLength: 1 }}
                    transition={{ delay: 0.3, duration: 0.4 }}
                  >
                    <polyline points="20 6 9 17 4 12" />
                  </motion.svg>
                </motion.div>

                {/* Success heading */}
                <motion.h2
                  className="text-[24px] sm:text-[28px] font-bold text-heading tracking-[-0.02em] mb-2"
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.25 }}
                >
                  You&apos;re on the list!
                </motion.h2>

                <motion.p
                  className="text-[15px] text-muted leading-[1.7] mb-6"
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.3 }}
                >
                  We&apos;ll email you the moment AI consultations go live.
                </motion.p>

                {/* Updated counter */}
                {waitlistCount > 0 && (
                  <motion.div
                    className="flex items-center justify-center gap-2 text-[13px] text-body mb-6"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 0.4 }}
                  >
                    <span className="w-2 h-2 rounded-full bg-primary/40" />
                    <span>
                      <NumberTicker
                        value={waitlistCount}
                        className="font-semibold text-heading text-[13px]"
                      />{' '}
                      trainees on the waitlist
                    </span>
                  </motion.div>
                )}

                {/* Back to home */}
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 0.5 }}
                >
                  <Link
                    href="/"
                    className="text-[13px] text-primary hover:underline font-medium"
                  >
                    Back to home
                  </Link>
                </motion.div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </main>
    </div>
  );
}
