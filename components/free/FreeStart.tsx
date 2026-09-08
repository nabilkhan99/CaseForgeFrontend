'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { ArrowRight, Eye, EyeOff } from 'lucide-react';
import LandingNavbar from '@/components/landing/LandingNavbar';
import LandingFooter from '@/components/landing/LandingFooter';
import { WASH } from '@/components/landing/v5/editorial';
import { createClient } from '@/lib/supabase/client';
import { MIN_PASSWORD_LENGTH, PASSWORD_HINT, passwordLongEnough } from '@/lib/auth/passwordPolicy';
import { trackEvent } from '@/lib/analytics';
import { suggestEmailFix } from '@/lib/trial/emailTypo';
import { trackTrialAccountCreated } from '@/lib/trial/trialEvents';

/**
 * Create your free account — the only door into the trial.
 *
 * Three fields and one code. The address is the account, the password means
 * they can come back on any device without waiting for an email, and the mobile
 * is a line to a human if they get stuck. Nothing is texted to it, ever.
 *
 * ## Why the password is asked for BEFORE the code
 *
 * Because the code is the last thing between them and a patient. Everything the
 * account needs is collected on one screen, the code proves the address, and the
 * response to that code carries the session cookies — so the next thing that
 * happens is the station, not an inbox. The old shape (verify, then go and find
 * a sign-in link in a second email) asked for two inbox trips in ninety seconds.
 *
 * ## The code boxes
 *
 * One real input driving six display boxes, matching
 * components/try/EmailVerificationGate and components/free/FreeSignUpBox, so
 * paste and iOS one-time-code autofill behave the same on all three screens.
 * Duplicated rather than extracted for the reason FreeSignUpBox gives: the
 * constant's home (lib/trial/verification) is `server-only`, and the markup is
 * thirty lines.
 */

type Step = 'details' | 'code' | 'exists' | 'stranded';

/** Six, matching `CODE_LENGTH` in the server-only lib/trial/verification. */
const CODE_LENGTH = 6;

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const FIELD =
  'w-full rounded-xl border border-defined bg-white px-4 py-3.5 text-base text-heading outline-none transition placeholder:text-muted focus:border-primary';

const LABEL = 'mb-1.5 block text-[13px] font-medium text-heading';

interface VerifyBody {
  ok?: true;
  error?: string;
  signedIn?: boolean;
  redirectTo?: string;
  account?: { userId: string; created: boolean } | null;
}

export interface FreeStartProps {
  /** Pre-fills the address — carried in the query from wherever it was typed. */
  initialEmail?: string;
  /** The case they clicked, carried through the flow and landed on afterwards. */
  station?: string;
  /** That case's title, resolved on the server. Null when there is nothing to name. */
  stationTitle?: string | null;
}

export default function FreeStart({ initialEmail, station, stationTitle }: FreeStartProps) {
  const [user, setUser] = useState<{ id: string } | null>(null);
  const [step, setStep] = useState<Step>('details');

  const [email, setEmail] = useState(initialEmail ?? '');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [revealPassword, setRevealPassword] = useState(false);

  const [code, setCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [cooldown, setCooldown] = useState(0);
  const codeInputRef = useRef<HTMLInputElement>(null);

  const cleanEmail = email.trim().toLowerCase();
  const emailSuggestion = suggestEmailFix(email);
  const detailsReady = EMAIL_RE.test(cleanEmail) && passwordLongEnough(password);

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then(({ data }) => setUser(data.user as { id: string } | null));
  }, []);

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
        // `mode` says there is no consultation to find a lead by; `intent` says
        // this is a sign-up, which is the only caller allowed to be told that
        // the address already belongs to a finished account.
        body: JSON.stringify({ mode: 'signup', intent: 'signup', email: cleanEmail }),
      });
      const data = (await res.json()) as {
        error?: string;
        retryAfter?: number;
        resendCooldown?: number;
        accountExists?: boolean;
      };
      if (!res.ok) {
        if (data.accountExists) {
          setStep('exists');
          return;
        }
        if (res.status === 429 && data.retryAfter) {
          // A code went out a moment ago (a reload, a double submit) and is
          // still live, so move on rather than dead-ending on a cooldown.
          setCooldown(data.retryAfter);
          setStep('code');
          return;
        }
        setError(data.error ?? 'Something went wrong — please try again');
        return;
      }
      setCooldown(data.resendCooldown ?? 0);
      setStep('code');
      void trackEvent('trial_gate_code_requested', { door: 'free_start' });
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
        body: JSON.stringify({
          email: cleanEmail,
          code: candidate,
          password,
          // Sent as typed; the server stores E.164 where it can parse one.
          ...(phone.trim() ? { phone: phone.trim() } : {}),
          ...(station ? { station } : {}),
        }),
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

      if (data.signedIn && data.redirectTo) {
        // A full navigation, not a router push: the session cookies arrived on
        // the response above and every server component past here has to be
        // rendered with them.
        window.location.assign(data.redirectTo);
        return;
      }
      // Account made, grant made, no session. Rare and recoverable — the
      // password they just chose works on the ordinary sign-in.
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

  return (
    <div className="min-h-[100dvh] font-sans" style={WASH}>
      <LandingNavbar user={user} />

      <main className="px-5 pb-20 pt-28 sm:px-8 sm:pb-28 sm:pt-32">
        <div className="mx-auto max-w-[27rem]">
          <motion.h1
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.45 }}
            className="text-[30px] font-medium leading-[1.1] tracking-tight text-heading sm:text-[36px]"
          >
            Create your free account
          </motion.h1>

          <motion.p
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.45, delay: 0.06 }}
            className="mt-3 text-base leading-relaxed text-body"
          >
            Five stations, unlimited attempts, five days. Your first verdict is minutes away.
          </motion.p>

          {stationTitle && (
            <motion.p
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.45, delay: 0.1 }}
              className="mt-5 border-l-2 border-primary/40 pl-4 text-[14px] leading-relaxed text-muted"
            >
              You&apos;ll start on{' '}
              <span className="font-semibold text-heading">{stationTitle}</span>.
            </motion.p>
          )}

          <motion.div
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.12 }}
            className="mt-7 rounded-3xl border border-heading/[0.07] bg-white/85 p-6 shadow-elevation-2 backdrop-blur sm:p-7"
          >
            {step === 'details' && (
              <>
                <form
                  className="flex flex-col gap-4"
                  onSubmit={(event) => {
                    event.preventDefault();
                    if (detailsReady) void requestCode();
                  }}
                >
                  <div>
                    <label htmlFor="start-email" className={LABEL}>
                      Email
                    </label>
                    <input
                      id="start-email"
                      type="email"
                      required
                      inputMode="email"
                      autoComplete="email"
                      placeholder="doctor@nhs.net"
                      value={email}
                      onChange={(event) => setEmail(event.target.value)}
                      className={`${FIELD} ${emailSuggestion ? '!border-[#D9A67C]' : ''}`}
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

                  {/* No asterisk and no parenthetical: the form submits without
                      it, and a field labelled with its own unimportance is a
                      field nobody fills in. */}
                  <div>
                    <label htmlFor="start-phone" className={LABEL}>
                      Mobile
                    </label>
                    <input
                      id="start-phone"
                      type="tel"
                      inputMode="tel"
                      autoComplete="tel"
                      maxLength={20}
                      placeholder="+44 7…"
                      value={phone}
                      onChange={(event) => setPhone(event.target.value)}
                      className={FIELD}
                    />
                  </div>

                  <div>
                    <label htmlFor="start-password" className={LABEL}>
                      Password
                    </label>
                    <div className="relative">
                      <input
                        id="start-password"
                        type={revealPassword ? 'text' : 'password'}
                        required
                        minLength={MIN_PASSWORD_LENGTH}
                        autoComplete="new-password"
                        value={password}
                        onChange={(event) => setPassword(event.target.value)}
                        className={`${FIELD} pr-12`}
                      />
                      <button
                        type="button"
                        onClick={() => setRevealPassword((shown) => !shown)}
                        aria-label={revealPassword ? 'Hide password' : 'Show password'}
                        aria-pressed={revealPassword}
                        className="absolute inset-y-0 right-0 flex w-12 items-center justify-center text-muted transition-colors hover:text-heading"
                      >
                        {revealPassword ? (
                          <EyeOff className="h-4 w-4" aria-hidden="true" />
                        ) : (
                          <Eye className="h-4 w-4" aria-hidden="true" />
                        )}
                      </button>
                    </div>
                    <p className="mt-1.5 text-[12.5px] text-muted">{PASSWORD_HINT}</p>
                  </div>

                  <button
                    type="submit"
                    disabled={!detailsReady || submitting}
                    className="cta-button mt-1 w-full px-6 py-4 text-base disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {submitting ? 'One moment…' : 'Create my free account'}
                    {!submitting && <ArrowRight className="h-4 w-4" aria-hidden="true" />}
                  </button>
                </form>

                {error && (
                  <div className="mt-3 rounded-lg border border-danger/20 bg-danger/10 p-3">
                    <p className="text-center text-sm text-danger">{error}</p>
                  </div>
                )}

                <p className="mt-3.5 text-[13px] leading-relaxed text-muted">
                  We&apos;ll email you a 6-digit code to confirm the address. Five stations,
                  unlimited attempts, five days, no card.
                </p>
              </>
            )}

            {step === 'code' && (
              <div className="text-center">
                <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-heading sm:text-[11px]">
                  One code and you&apos;re in
                </p>
                <p className="mx-auto mt-3 mb-5 max-w-sm text-[14px] leading-relaxed text-muted">
                  Enter the 6-digit code we&apos;ve just sent to{' '}
                  <b className="font-semibold text-heading">{cleanEmail}</b>.
                </p>

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

            {step === 'exists' && (
              <div className="text-center">
                <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-heading sm:text-[11px]">
                  We know you
                </p>
                <p className="mx-auto mt-3 mb-5 max-w-sm text-[14px] leading-relaxed text-muted">
                  You already have an account. Sign in instead.
                </p>
                <Link
                  href={`/auth/sign-in?email=${encodeURIComponent(cleanEmail)}`}
                  className="cta-button w-full px-6 py-4 text-base"
                >
                  Sign in
                  <ArrowRight className="h-4 w-4" aria-hidden="true" />
                </Link>
                <p className="mt-4 text-[13px] leading-relaxed text-muted">
                  Forgotten your password?{' '}
                  <Link
                    href={`/free/open?email=${encodeURIComponent(cleanEmail)}`}
                    className="font-semibold text-primary"
                  >
                    Open your dashboard with a code
                  </Link>
                  .
                </p>
                <button
                  type="button"
                  onClick={() => {
                    setStep('details');
                    setError(null);
                  }}
                  className="mt-4 text-[13px] text-muted underline underline-offset-2"
                >
                  Use a different address
                </button>
              </div>
            )}

            {step === 'stranded' && (
              <div className="text-center">
                <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-heading sm:text-[11px]">
                  You&apos;re in
                </p>
                <p className="mx-auto mt-3 mb-5 max-w-sm text-[14px] leading-relaxed text-muted">
                  Your account and your five stations are ready. Sign in with the password you
                  just chose.
                </p>
                <Link
                  href={`/auth/sign-in?email=${encodeURIComponent(cleanEmail)}`}
                  className="cta-button w-full px-6 py-4 text-base"
                >
                  Sign in
                  <ArrowRight className="h-4 w-4" aria-hidden="true" />
                </Link>
              </div>
            )}
          </motion.div>

          <p className="mt-6 text-[13px] text-muted">
            Already have an account?{' '}
            <Link
              href="/auth/sign-in"
              className="font-medium text-heading underline decoration-muted/40 underline-offset-4 transition-colors hover:decoration-heading"
            >
              Sign in
            </Link>
          </p>
        </div>
      </main>

      <LandingFooter />
    </div>
  );
}
