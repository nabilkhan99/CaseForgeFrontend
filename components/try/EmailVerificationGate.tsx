'use client';

import { useEffect, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { ArrowRight, Check } from 'lucide-react';
import { suggestEmailFix } from '@/lib/trial/emailTypo';
import { SCA_SIT_DATES, TRAINING_STAGES } from '@/lib/trial/leadFields';

const FIELD_CLASSES =
  'w-full rounded-xl border border-stone-200 bg-white px-4 py-3 text-[14px] text-heading outline-none transition-colors focus:border-primary';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const CODE_LENGTH = 6;

type GateStep = 'details' | 'code' | 'verified';

interface EmailVerificationGateProps {
  sessionId: string;
  /** Called when the verified user clicks through to their report. */
  onUnlock: (email: string) => void;
}

function CompletePill() {
  return (
    <span
      className="mb-4 inline-flex items-center gap-1.5 rounded-lg px-3 py-1 text-[11px] font-semibold uppercase tracking-wide"
      style={{ background: 'rgba(22,163,74,0.08)', color: '#16A34A' }}
    >
      <Check className="h-3 w-3" strokeWidth={3} aria-hidden="true" />
      Consultation complete
    </span>
  );
}

/**
 * The email gate between finishing the free mock station and the feedback
 * report, in three states: details → 6-digit email verification → verified.
 * The report only opens once the address has proven it can receive email.
 */
export default function EmailVerificationGate({ sessionId, onUnlock }: EmailVerificationGateProps) {
  const [step, setStep] = useState<GateStep>('details');

  const [email, setEmail] = useState('');
  const [firstName, setFirstName] = useState('');
  const [trainingStage, setTrainingStage] = useState('');
  const [scaSitDate, setScaSitDate] = useState('');

  const [code, setCode] = useState('');
  const [cooldown, setCooldown] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const codeInputRef = useRef<HTMLInputElement>(null);
  const emailSuggestion = suggestEmailFix(email);
  const detailsComplete =
    EMAIL_RE.test(email.trim()) && firstName.trim().length > 0 && !!trainingStage && !!scaSitDate;

  // Resend countdown.
  useEffect(() => {
    if (cooldown <= 0) return;
    const id = setInterval(() => setCooldown((s) => Math.max(0, s - 1)), 1000);
    return () => clearInterval(id);
  }, [cooldown]);

  useEffect(() => {
    if (step === 'code') codeInputRef.current?.focus();
  }, [step]);

  async function requestCode() {
    if (submitting) return;
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch('/api/try/send-code', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionId,
          email: email.trim(),
          firstName: firstName.trim(),
          trainingStage,
          scaSitDate,
        }),
      });
      const data = (await res.json()) as {
        ok?: boolean;
        error?: string;
        resendCooldown?: number;
        retryAfter?: number;
      };
      if (!res.ok || !data.ok) {
        if (res.status === 429 && data.retryAfter) {
          // Already sent recently (e.g. after a reload) — go to the code step.
          setCooldown(data.retryAfter);
          setCode('');
          setStep('code');
        } else {
          setError(data.error ?? 'Something went wrong — please try again.');
        }
        return;
      }
      setCooldown(data.resendCooldown ?? 60);
      setCode('');
      setStep('code');
    } catch {
      setError('Something went wrong — please try again.');
    } finally {
      setSubmitting(false);
    }
  }

  async function verifyCode(candidate: string) {
    if (submitting) return;
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch('/api/try/verify-code', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId, code: candidate }),
      });
      const data = (await res.json()) as { ok?: boolean; error?: string };
      if (!res.ok || !data.ok) {
        setError(data.error ?? 'Something went wrong — please try again.');
        setCode('');
        codeInputRef.current?.focus();
        return;
      }
      setStep('verified');
    } catch {
      setError('Something went wrong — please try again.');
    } finally {
      setSubmitting(false);
    }
  }

  function handleCodeChange(raw: string) {
    const digits = raw.replace(/\D/g, '').slice(0, CODE_LENGTH);
    setCode(digits);
    setError(null);
    if (digits.length === CODE_LENGTH) {
      void verifyCode(digits);
    }
  }

  const card =
    'rounded-[22px] border border-black/[0.06] bg-surface-raised p-7 shadow-[0_16px_42px_rgba(180,83,9,0.06)] sm:p-9';

  return (
    <div className="min-h-[100dvh] flex items-center justify-center px-6 py-16">
      <motion.div
        className="w-full max-w-md"
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ type: 'spring', stiffness: 60, damping: 20 }}
      >
        {step === 'details' && (
          <div className={`${card} text-center`}>
            <CompletePill />
            <h1 className="mb-2 text-[26px] font-bold tracking-[-0.02em] text-heading">
              Enter your details to see your feedback
            </h1>
            <p className="mb-7 text-[14px] leading-relaxed text-muted">
              We&apos;ll send a 6-digit code to verify your email, then your report opens straight
              away.
            </p>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                if (detailsComplete) void requestCode();
              }}
              className="space-y-4 text-left"
            >
              <div>
                <label htmlFor="trial-email" className="mb-1.5 block text-[13px] font-medium text-heading">
                  Email
                </label>
                <input
                  id="trial-email"
                  type="email"
                  required
                  autoComplete="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="doctor@example.com"
                  className={`${FIELD_CLASSES} placeholder:text-stone-400 ${
                    emailSuggestion ? '!border-[#D9A67C]' : ''
                  }`}
                />
                {emailSuggestion && (
                  <p className="mt-1.5 flex items-center gap-1.5 text-[12.5px] text-[#A65B2A]">
                    <span aria-hidden="true">⚠</span>
                    Did you mean{' '}
                    <button
                      type="button"
                      onClick={() => setEmail(emailSuggestion)}
                      className="font-semibold underline underline-offset-2"
                    >
                      {emailSuggestion}
                    </button>
                    ?
                  </p>
                )}
              </div>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 sm:gap-3">
                <div>
                  <label htmlFor="trial-first-name" className="mb-1.5 block text-[13px] font-medium text-heading">
                    First name
                  </label>
                  <input
                    id="trial-first-name"
                    type="text"
                    required
                    autoComplete="given-name"
                    maxLength={60}
                    value={firstName}
                    onChange={(e) => setFirstName(e.target.value)}
                    placeholder="Sarah"
                    className={`${FIELD_CLASSES} placeholder:text-stone-400`}
                  />
                </div>
                <div>
                  <label htmlFor="trial-stage" className="mb-1.5 block text-[13px] font-medium text-heading">
                    Training stage
                  </label>
                  <select
                    id="trial-stage"
                    required
                    value={trainingStage}
                    onChange={(e) => setTrainingStage(e.target.value)}
                    className={`${FIELD_CLASSES} ${trainingStage ? '' : 'text-stone-400'}`}
                  >
                    <option value="" disabled>
                      Select…
                    </option>
                    {TRAINING_STAGES.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label htmlFor="trial-sit-date" className="mb-1.5 block text-[13px] font-medium text-heading">
                  When are you planning on sitting the SCA?
                </label>
                <select
                  id="trial-sit-date"
                  required
                  value={scaSitDate}
                  onChange={(e) => setScaSitDate(e.target.value)}
                  className={`${FIELD_CLASSES} ${scaSitDate ? '' : 'text-stone-400'}`}
                >
                  <option value="" disabled>
                    Select…
                  </option>
                  {SCA_SIT_DATES.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </div>

              {error && (
                <div className="rounded-lg border border-danger/20 bg-danger/10 p-3">
                  <p className="text-center text-sm text-danger">{error}</p>
                </div>
              )}

              <button
                type="submit"
                disabled={!detailsComplete || submitting}
                className="cta-button w-full px-6 py-4 text-base disabled:cursor-not-allowed disabled:opacity-50"
              >
                {submitting ? 'Sending…' : 'Send my verification code'}
                {!submitting && <ArrowRight className="h-4 w-4" />}
              </button>
            </form>

            <p className="mt-4 text-[11px] leading-relaxed text-muted">
              By continuing you agree to receive your feedback report and SCA preparation emails
              from Fourteen Fisherman. Unsubscribe anytime.
            </p>
          </div>
        )}

        {step === 'code' && (
          <div className={`${card} text-center`}>
            <CompletePill />
            <h1 className="mb-2 text-[26px] font-bold tracking-[-0.02em] text-heading">
              Check your inbox
            </h1>
            <p className="mb-6 text-[14px] leading-relaxed text-muted">
              Enter the 6-digit code we&apos;ve just sent to{' '}
              <b className="font-semibold text-heading">{email.trim().toLowerCase()}</b>.
            </p>

            {/* One real input drives six display boxes, so paste and
                autofill work exactly like a normal field. */}
            <div
              className="relative mx-auto mb-2 flex w-fit cursor-text justify-center gap-2"
              onClick={() => codeInputRef.current?.focus()}
            >
              <input
                ref={codeInputRef}
                inputMode="numeric"
                autoComplete="one-time-code"
                pattern="[0-9]*"
                aria-label="6-digit verification code"
                value={code}
                onChange={(e) => handleCodeChange(e.target.value)}
                disabled={submitting}
                className="absolute inset-0 h-full w-full cursor-text opacity-0"
              />
              {Array.from({ length: CODE_LENGTH }, (_, i) => {
                const filled = i < code.length;
                const active = i === code.length && !submitting;
                return (
                  <span
                    key={i}
                    aria-hidden="true"
                    className={`flex h-14 w-12 items-center justify-center rounded-xl border-[1.5px] bg-white font-mono text-[22px] font-medium text-heading transition-shadow ${
                      active
                        ? 'border-primary shadow-[0_0_0_3px_rgba(180,83,9,0.15)]'
                        : filled
                          ? 'border-stone-400'
                          : 'border-stone-200'
                    }`}
                  >
                    {code[i] ?? ''}
                  </span>
                );
              })}
            </div>

            {error && (
              <div className="mt-3 rounded-lg border border-danger/20 bg-danger/10 p-3">
                <p className="text-center text-sm text-danger">{error}</p>
              </div>
            )}

            <div className="mt-4 flex items-center justify-between text-[12.5px] text-muted">
              <span>No email? Check spam.</span>
              {cooldown > 0 ? (
                <span>
                  Resend code (0:{String(cooldown).padStart(2, '0')})
                </span>
              ) : (
                <button
                  type="button"
                  onClick={() => void requestCode()}
                  disabled={submitting}
                  className="font-medium text-heading underline underline-offset-2"
                >
                  Resend code
                </button>
              )}
            </div>

            <div className="mt-4 flex items-center justify-between gap-3 rounded-xl border border-stone-200 bg-surface-warm px-3.5 py-3 text-left text-[13px]">
              <span className="text-muted">
                Wrong address?{' '}
                <span className="break-all font-semibold text-heading">
                  {email.trim().toLowerCase()}
                </span>
              </span>
              <button
                type="button"
                onClick={() => {
                  setStep('details');
                  setCode('');
                  setError(null);
                }}
                className="flex-none rounded-lg border border-stone-200 bg-white px-3.5 py-2 text-[12.5px] font-medium text-heading"
              >
                Edit email
              </button>
            </div>
          </div>
        )}

        {step === 'verified' && (
          <div className={`${card} text-center`}>
            <div
              className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full"
              style={{ background: 'rgba(22,163,74,0.08)', border: '1px solid rgba(22,163,74,0.2)' }}
            >
              <Check className="h-6 w-6 text-[#16A34A]" strokeWidth={3} aria-hidden="true" />
            </div>
            <h1 className="mb-2 text-[26px] font-bold tracking-[-0.02em] text-heading">
              Email verified
            </h1>
            <p className="mb-6 text-[14px] leading-relaxed text-muted">
              Your report is ready — a copy of your practice insights will go to{' '}
              <b className="font-semibold text-heading">{email.trim().toLowerCase()}</b>.
            </p>
            <button
              type="button"
              onClick={() => onUnlock(email.trim().toLowerCase())}
              className="cta-button w-full px-6 py-4 text-base"
            >
              Show my feedback
              <ArrowRight className="h-4 w-4" />
            </button>
          </div>
        )}
      </motion.div>
    </div>
  );
}
