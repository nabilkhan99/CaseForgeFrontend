'use client';

import { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import Link from 'next/link';
import LandingNavbar from '@/components/landing/LandingNavbar';
import { createClient } from '@/lib/supabase/client';
import { NumberTicker } from '@/components/magicui/number-ticker';

type FormState = 'idle' | 'loading' | 'success';

interface FormData {
  fullName: string;
  email: string;
  trainingStage: string;
  scaDate: string;
}

interface FormErrors {
  fullName?: string;
  email?: string;
  trainingStage?: string;
  scaDate?: string;
}

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

function generateScaDateOptions(): { value: string; label: string }[] {
  const options: { value: string; label: string }[] = [{ value: 'not_sure', label: 'Not sure' }];
  const now = new Date();
  const startMonth = now.getMonth();
  const startYear = now.getFullYear();

  for (let i = 1; i <= 24; i++) {
    const totalMonths = startMonth + i;
    const month = totalMonths % 12;
    const year = startYear + Math.floor(totalMonths / 12);
    const label = `${MONTH_NAMES[month]} ${year}`;
    const value = `${year}-${String(month + 1).padStart(2, '0')}`;
    options.push({ value, label });
  }

  return options;
}

const inputBase =
  'w-full bg-white/70 border border-black/[0.06] rounded-xl text-[14px] text-heading placeholder:text-muted/60 focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary/30 transition-all disabled:opacity-60';

const iconClass = 'absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-muted pointer-events-none';

export default function WaitlistPage() {
  const [user, setUser] = useState<{ id: string } | null>(null);
  const [formData, setFormData] = useState<FormData>({
    fullName: '',
    email: '',
    trainingStage: '',
    scaDate: '',
  });
  const [formState, setFormState] = useState<FormState>('idle');
  const [errors, setErrors] = useState<FormErrors>({});
  const [waitlistCount, setWaitlistCount] = useState(0);

  const scaDateOptions = useMemo(() => generateScaDateOptions(), []);

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

  function validate(): FormErrors {
    const newErrors: FormErrors = {};

    if (!formData.fullName.trim()) {
      newErrors.fullName = 'Please enter your full name.';
    }

    if (!formData.email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
      newErrors.email = 'Please enter a valid email address.';
    }

    if (!formData.trainingStage) {
      newErrors.trainingStage = 'Please select your training stage.';
    }

    if (!formData.scaDate) {
      newErrors.scaDate = 'Please select your planned SCA date.';
    }

    return newErrors;
  }

  function handleChange(field: keyof FormData, value: string) {
    setFormData((prev) => ({ ...prev, [field]: value }));
    if (errors[field]) {
      setErrors((prev) => ({ ...prev, [field]: undefined }));
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const validationErrors = validate();
    if (Object.keys(validationErrors).length > 0) {
      setErrors(validationErrors);
      return;
    }

    setFormState('loading');

    try {
      const res = await fetch('/api/waitlist', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: formData.email,
          full_name: formData.fullName,
          training_stage: formData.trainingStage,
          sca_date: formData.scaDate,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Something went wrong');
      }

      setFormState('success');
      setWaitlistCount((prev) => prev + 1);
    } catch (err) {
      setErrors({
        email: err instanceof Error ? err.message : 'Something went wrong. Please try again.',
      });
      setFormState('idle');
    }
  };

  const springTransition = { type: 'spring' as const, stiffness: 60, damping: 20 };

  return (
    <div className="min-h-[100dvh] bg-surface relative overflow-hidden">
      {/* Ambient orbs */}
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_70%_30%,rgba(180,83,9,0.05)_0%,transparent_55%)] pointer-events-none" />
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_80%,rgba(180,83,9,0.03)_0%,transparent_45%)] pointer-events-none" />

      <LandingNavbar user={user} hideAuth />

      <main className="flex items-center justify-center px-4 pt-28 pb-16 min-h-[100dvh]">
        <div className="w-full max-w-lg relative z-10">
          <AnimatePresence mode="wait">
            {formState !== 'success' ? (
              <motion.div
                key="form"
                initial={{ opacity: 0, y: 24 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -16 }}
                transition={springTransition}
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
                  transition={{ delay: 0.15, ...springTransition }}
                >
                  Join the Waitlist
                </motion.h1>

                {/* Subtext */}
                <motion.p
                  className="text-[15px] text-muted leading-[1.7] mb-8"
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.2, ...springTransition }}
                >
                  Stop waiting for study group sessions. Practice SCA consultations with our AI patients, whenever you need.
                </motion.p>

                {/* Form */}
                <motion.form
                  onSubmit={handleSubmit}
                  className="flex flex-col gap-4 mb-4"
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.25, ...springTransition }}
                  noValidate
                >
                  {/* Full name */}
                  <div className="flex flex-col gap-1">
                    <div className="relative">
                      {/* Person icon */}
                      <svg
                        className={iconClass}
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                        strokeWidth={2}
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
                        />
                      </svg>
                      <input
                        type="text"
                        value={formData.fullName}
                        onChange={(e) => handleChange('fullName', e.target.value)}
                        placeholder="Your full name"
                        disabled={formState === 'loading'}
                        className={`${inputBase} pl-11 pr-4 py-3.5 min-h-[44px]${errors.fullName ? ' ring-2 ring-red-400/40 border-red-300' : ''}`}
                      />
                    </div>
                    <AnimatePresence>
                      {errors.fullName && (
                        <motion.p
                          initial={{ opacity: 0, y: -4 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0, y: -4 }}
                          className="text-[12px] text-red-600 pl-1"
                        >
                          {errors.fullName}
                        </motion.p>
                      )}
                    </AnimatePresence>
                  </div>

                  {/* Email */}
                  <div className="flex flex-col gap-1">
                    <div className="relative">
                      {/* Email icon */}
                      <svg
                        className={iconClass}
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
                        value={formData.email}
                        onChange={(e) => handleChange('email', e.target.value)}
                        placeholder="you@email.com"
                        disabled={formState === 'loading'}
                        className={`${inputBase} pl-11 pr-4 py-3.5 min-h-[44px]${errors.email ? ' ring-2 ring-red-400/40 border-red-300' : ''}`}
                      />
                    </div>
                    <AnimatePresence>
                      {errors.email && (
                        <motion.p
                          initial={{ opacity: 0, y: -4 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0, y: -4 }}
                          className="text-[12px] text-red-600 pl-1"
                        >
                          {errors.email}
                        </motion.p>
                      )}
                    </AnimatePresence>
                  </div>

                  {/* GP training stage */}
                  <div className="flex flex-col gap-1">
                    <div className="relative">
                      {/* Graduation icon */}
                      <svg
                        className={iconClass}
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                        strokeWidth={2}
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          d="M12 14l9-5-9-5-9 5 9 5z"
                        />
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          d="M12 14l6.16-3.422a12.083 12.083 0 01.665 6.479A11.952 11.952 0 0012 20.055a11.952 11.952 0 00-6.824-2.998 12.078 12.078 0 01.665-6.479L12 14z"
                        />
                      </svg>
                      <select
                        value={formData.trainingStage}
                        onChange={(e) => handleChange('trainingStage', e.target.value)}
                        disabled={formState === 'loading'}
                        className={`${inputBase} pl-11 pr-8 py-3.5 min-h-[44px] appearance-none cursor-pointer${errors.trainingStage ? ' ring-2 ring-red-400/40 border-red-300' : ''}`}
                      >
                        <option value="" disabled>GP training stage</option>
                        <option value="ST1">ST1</option>
                        <option value="ST2">ST2</option>
                        <option value="ST3">ST3</option>
                      </select>
                      {/* Chevron */}
                      <svg
                        className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted pointer-events-none"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                        strokeWidth={2}
                      >
                        <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                      </svg>
                    </div>
                    <AnimatePresence>
                      {errors.trainingStage && (
                        <motion.p
                          initial={{ opacity: 0, y: -4 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0, y: -4 }}
                          className="text-[12px] text-red-600 pl-1"
                        >
                          {errors.trainingStage}
                        </motion.p>
                      )}
                    </AnimatePresence>
                  </div>

                  {/* SCA date */}
                  <div className="flex flex-col gap-1">
                    <div className="relative">
                      {/* Calendar icon */}
                      <svg
                        className={iconClass}
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                        strokeWidth={2}
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
                        />
                      </svg>
                      <select
                        value={formData.scaDate}
                        onChange={(e) => handleChange('scaDate', e.target.value)}
                        disabled={formState === 'loading'}
                        className={`${inputBase} pl-11 pr-8 py-3.5 min-h-[44px] appearance-none cursor-pointer${errors.scaDate ? ' ring-2 ring-red-400/40 border-red-300' : ''}`}
                      >
                        <option value="" disabled>When are you planning to sit your SCA?</option>
                        {scaDateOptions.map((opt) => (
                          <option key={opt.value} value={opt.value}>
                            {opt.label}
                          </option>
                        ))}
                      </select>
                      {/* Chevron */}
                      <svg
                        className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted pointer-events-none"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                        strokeWidth={2}
                      >
                        <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                      </svg>
                    </div>
                    <AnimatePresence>
                      {errors.scaDate && (
                        <motion.p
                          initial={{ opacity: 0, y: -4 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0, y: -4 }}
                          className="text-[12px] text-red-600 pl-1"
                        >
                          {errors.scaDate}
                        </motion.p>
                      )}
                    </AnimatePresence>
                  </div>

                  {/* Submit */}
                  <div className="flex justify-center mt-1">
                    <motion.button
                      type="submit"
                      disabled={formState === 'loading'}
                      className="min-w-fit px-7 py-3.5 rounded-xl text-[14px] font-semibold text-white min-h-[44px] disabled:opacity-70 cursor-pointer"
                      style={{
                        background: 'linear-gradient(135deg, #B45309, #D97706)',
                        boxShadow: '0 4px 16px rgba(180,83,9,0.18)',
                      }}
                      whileHover={{ y: -2, boxShadow: '0 8px 24px rgba(180,83,9,0.25)' }}
                      whileTap={{ scale: 0.98 }}
                    >
                      {formState === 'loading' ? (
                        <span className="flex items-center justify-center gap-2">
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
                  </div>
                </motion.form>

                {/* Counter */}
                {waitlistCount > 0 && (
                  <motion.div
                    className="flex items-center justify-center gap-2 text-[13px] text-body"
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
                transition={springTransition}
                className="bg-white/60 backdrop-blur-xl border border-black/[0.04] rounded-2xl p-6 sm:p-10 shadow-elevation-2 text-center"
              >
                {/* Animated checkmark */}
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

                <motion.h2
                  className="text-[24px] sm:text-[28px] font-bold text-heading tracking-[-0.02em] mb-3"
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.25 }}
                >
                  Spot reserved.
                </motion.h2>

                <motion.p
                  className="text-[15px] text-muted leading-[1.7] mb-6"
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.3 }}
                >
                  We&apos;ll notify you when we go live — and send you high-yield SCA tips while you wait.
                </motion.p>

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
