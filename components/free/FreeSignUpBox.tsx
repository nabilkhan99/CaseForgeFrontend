'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { trackEvent } from '@/lib/analytics';
import { trackTrialAccountCreated } from '@/lib/trial/trialEvents';
import { CODE_LENGTH } from '@/lib/trial/verification';

/**
 * "Start your five" — door (a).
 *
 * Two fields and a code. Everything else this product wants to know (exam
 * sitting, training stage) is asked on the dashboard AFTER the first station,
 * while the mark is being generated — see components/dashboard/
 * TrialQuestionnaireCard. That ordering is the offer, not a nicety: five
 * stations for an address, not for a form.
 *
 * The code step is the same one-real-input-six-boxes pattern
 * components/try/EmailVerificationGate uses, so paste and iOS autofill work
 * exactly as they do at the guest reveal, and the two screens read as one
 * product. It is duplicated rather than extracted because that component is
 * owned by the guest-reveal workstream on this build and is mid-change; the
 * pattern is ~30 lines of markup and one handler.
 *
 * On success the server has already created the account, claimed anything that
 * address sat as a guest, granted the five and minted a one-time sign-in URL.
 * All that is left here is to follow it.
 */

type Step = 'details' | 'code' | 'stranded';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

interface VerifyBody {
  ok?: true;
  error?: string;
  account?: { userId: string; created: boolean; signInUrl: string | null } | null;
}

export default function FreeSignUpBox() {
  const [step, setStep] = useState<Step>('details');
  const [email, setEmail] = useState('');
  const [firstName, setFirstName] = useState('');
  const [code, setCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [cooldown, setCooldown] = useState(0);
  const [resent, setResent] = useState(false);
  const codeInputRef = useRef<HTMLInputElement>(null);

  const cleanEmail = email.trim().toLowerCase();
  const detailsReady = EMAIL_RE.test(cleanEmail) && firstName.trim().length > 0;

  useEffect(() => {
    if (cooldown <= 0) return;
    const timer = setTimeout(() => setCooldown((seconds) => seconds - 1), 1000);
    return () => clearTimeout(timer);
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
        // `mode: 'signup'` is what tells the route there is no consultation to
        // look a lead up by. It is only honoured when no sessionId is sent.
        body: JSON.stringify({ mode: 'signup', email: cleanEmail, firstName: firstName.trim() }),
      });
      const data = (await res.json()) as { error?: string; retryAfter?: number; resendCooldown?: number };
      if (!res.ok) {
        if (res.status === 429 && data.retryAfter) {
          // Already sent a moment ago (a reload, or a double submit) — the code
          // in their inbox is still live, so move on rather than dead-ending.
          setCooldown(data.retryAfter);
          setStep('code');
          return;
        }
        setError(data.error ?? 'Something went wrong — please try again');
        return;
      }
      setCooldown(data.resendCooldown ?? 0);
      setStep('code');
      void trackEvent('trial_gate_code_requested', { door: 'free' });
    } catch {
      setError('Something went wrong — please try again');
    } finally {
      setSubmitting(false);
    }
  }

  async function submitCode(candidate: string) {
    if (submitting) return;
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch('/api/try/verify-code', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: cleanEmail, code: candidate }),
      });
      const data = (await res.json()) as VerifyBody;
      if (!res.ok) {
        setCode('');
        codeInputRef.current?.focus();
        setError(data.error ?? "That code isn't right — check the email and try again");
        return;
      }

      // Awaited so the capture flushes before the navigation tears the page down.
      await trackTrialAccountCreated('free');

      const signInUrl = data.account?.signInUrl;
      if (signInUrl) {
        window.location.assign(signInUrl);
        return;
      }
      // Verified, account made, grant made — but no link to walk through. Rare,
      // and recoverable: the same link can be emailed. Never a dead end.
      setStep('stranded');
    } catch {
      setError('Something went wrong — please try again');
    } finally {
      setSubmitting(false);
    }
  }

  function handleCodeChange(raw: string) {
    const digits = raw.replace(/\D/g, '').slice(0, CODE_LENGTH);
    setCode(digits);
    setError(null);
    if (digits.length === CODE_LENGTH) void submitCode(digits);
  }

  async function emailMeALink() {
    setSubmitting(true);
    try {
      await fetch('/api/try/dashboard-link', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: cleanEmail }),
      });
    } catch {
      // The route answers identically whatever happens, so there is nothing to
      // branch on and the copy below already says "if that address…".
    } finally {
      setSubmitting(false);
      setResent(true);
    }
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay: 0.1 }}
      className="rounded-3xl border border-heading/[0.07] bg-white/85 p-6 shadow-elevation-2 backdrop-blur sm:p-7"
    >
      {step === 'details' && (
        <>
          <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-heading sm:text-[11px]">
            Start your five
          </p>

          <form
            className="mt-5 flex flex-col gap-3"
            onSubmit={(event) => {
              event.preventDefault();
              if (detailsReady) void requestCode();
            }}
          >
            <label htmlFor="free-email" className="sr-only">
              Email
            </label>
            <input
              id="free-email"
              type="email"
              inputMode="email"
              autoComplete="email"
              placeholder="Email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              className="w-full rounded-xl border border-defined bg-white px-4 py-3.5 text-base text-heading outline-none transition placeholder:text-muted focus:border-primary"
            />

            <label htmlFor="free-first-name" className="sr-only">
              First name
            </label>
            <input
              id="free-first-name"
              type="text"
              autoComplete="given-name"
              placeholder="First name"
              value={firstName}
              onChange={(event) => setFirstName(event.target.value)}
              className="w-full rounded-xl border border-defined bg-white px-4 py-3.5 text-base text-heading outline-none transition placeholder:text-muted focus:border-primary"
            />

            <button
              type="submit"
              disabled={!detailsReady || submitting}
              className="cta-button mt-1 w-full px-6 py-4 text-base"
            >
              {submitting ? 'Sending…' : 'Send my code'}
            </button>
          </form>

          {error && (
            <div className="mt-3 rounded-lg border border-danger/20 bg-danger/10 p-3">
              <p className="text-center text-sm text-danger">{error}</p>
            </div>
          )}

          <p className="mt-3.5 text-[13px] leading-relaxed text-muted">
            A 6-digit code by email, then your dashboard. Exam date and training stage are asked
            after your first station.
          </p>
        </>
      )}

      {step === 'code' && (
        <div className="text-center">
          <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-heading sm:text-[11px]">
            Check your inbox
          </p>
          <p className="mx-auto mt-3 mb-5 max-w-sm text-[14px] leading-relaxed text-muted">
            Enter the 6-digit code we&apos;ve just sent to{' '}
            <b className="font-semibold text-heading">{cleanEmail}</b>.
          </p>

          {/* One real input drives six display boxes, so paste and autofill
              work exactly like a normal field. */}
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
              onChange={(event) => handleCodeChange(event.target.value)}
              disabled={submitting}
              className="absolute inset-0 h-full w-full cursor-text opacity-0"
            />
            {Array.from({ length: CODE_LENGTH }, (_, index) => {
              const filled = index < code.length;
              const active = index === code.length && !submitting;
              return (
                <span
                  key={index}
                  aria-hidden="true"
                  className={`flex h-14 w-11 items-center justify-center rounded-xl border-[1.5px] bg-white font-mono text-[22px] font-medium text-heading transition-shadow sm:w-12 ${
                    active
                      ? 'border-primary shadow-[0_0_0_3px_rgba(180,83,9,0.15)]'
                      : filled
                        ? 'border-stone-400'
                        : 'border-stone-200'
                  }`}
                >
                  {code[index] ?? ''}
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
              <span>Resend code (0:{String(cooldown).padStart(2, '0')})</span>
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

          <button
            type="button"
            onClick={() => {
              setStep('details');
              setCode('');
              setError(null);
            }}
            className="mt-4 text-[13px] text-muted underline underline-offset-2"
          >
            Wrong address?
          </button>
        </div>
      )}

      {step === 'stranded' && (
        <div className="text-center">
          <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-heading sm:text-[11px]">
            You&apos;re in
          </p>
          <p className="mx-auto mt-3 mb-5 max-w-sm text-[14px] leading-relaxed text-muted">
            {resent
              ? `A sign-in link is on its way to ${cleanEmail}.`
              : 'Your five stations are ready. We could not open your dashboard automatically — we can email you a link instead.'}
          </p>
          {!resent && (
            <button
              type="button"
              onClick={() => void emailMeALink()}
              disabled={submitting}
              className="cta-button w-full px-6 py-4 text-base"
            >
              {submitting ? 'Sending…' : 'Email me a sign-in link'}
            </button>
          )}
          <p className="mt-4 text-[13px] text-muted">
            Already set a password?{' '}
            <Link href="/auth/sign-in" className="font-semibold text-primary">
              Sign in
            </Link>
            .
          </p>
        </div>
      )}
    </motion.div>
  );
}
