'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { ArrowLeft, ArrowRight, Check } from 'lucide-react';
import { suggestEmailFix } from '@/lib/trial/emailTypo';
import {
  EXAM_STATUSES,
  EXPECTED_START_YEARS,
  MONTHS,
  NOT_IN_TRAINING_ROLES,
  TRAINING_STAGES,
  TRAINING_START_YEARS,
  followUpFor,
  followUpLabel,
  type LeadFieldOption,
} from '@/lib/trial/leadFields';
import {
  buildSteps,
  EMPTY_ANSWERS,
  isStepComplete,
  type QuestionnaireAnswers,
  type StepId,
} from '@/lib/trial/questionnaire';

const FIELD_CLASSES =
  'w-full rounded-xl border border-stone-200 bg-white px-4 py-3 text-[14px] text-heading outline-none transition-colors focus:border-primary';

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

  const [answers, setAnswers] = useState<QuestionnaireAnswers>(EMPTY_ANSWERS);
  const [stepIndex, setStepIndex] = useState(0);

  const [code, setCode] = useState('');
  const [cooldown, setCooldown] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const codeInputRef = useRef<HTMLInputElement>(null);

  const email = answers.email;
  const emailSuggestion = suggestEmailFix(email);

  // Steps are recomputed from the answers, so a status with no follow-up
  // simply never contributes a step and the flow closes up behind it.
  const steps = useMemo(() => buildSteps(answers), [answers]);
  const currentStep: StepId = steps[Math.min(stepIndex, steps.length - 1)];
  const isLastStep = stepIndex >= steps.length - 1;
  const stepReady = isStepComplete(currentStep, answers);

  /** Changing an earlier answer can invalidate later ones — clear them. */
  function set<K extends keyof QuestionnaireAnswers>(key: K, value: QuestionnaireAnswers[K]) {
    setError(null);
    setAnswers((prev) => {
      const next = { ...prev, [key]: value };
      if (key === 'trainingStage' && value !== prev.trainingStage) {
        return {
          ...next,
          trainingStartMonth: '',
          trainingStartYear: '',
          aktStatus: '',
          aktSitting: '',
          scaStatus: '',
          scaSitting: '',
          notInTrainingRole: '',
          expectedStartMonth: '',
          expectedStartYear: '',
        };
      }
      if (key === 'aktStatus' && value !== prev.aktStatus) return { ...next, aktSitting: '' };
      if (key === 'scaStatus' && value !== prev.scaStatus) return { ...next, scaSitting: '' };
      if (key === 'notInTrainingRole' && value !== prev.notInTrainingRole) {
        return { ...next, expectedStartMonth: '', expectedStartYear: '' };
      }
      return next;
    });
  }

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
        body: JSON.stringify({ sessionId, ...answers, email: answers.email.trim() }),
      });
      const data = (await res.json()) as {
        ok?: boolean;
        error?: string;
        resendCooldown?: number;
        retryAfter?: number;
        emailAlreadyUsed?: boolean;
      };
      if (!res.ok || !data.ok) {
        if (res.status === 429 && data.retryAfter) {
          // Already sent recently (e.g. after a reload) — go to the code step.
          setCooldown(data.retryAfter);
          setCode('');
          setStep('code');
        } else {
          setError(data.error ?? 'Something went wrong — please try again.');
          // The address is the problem, and it was answered several steps
          // back. Return to it with the answers intact so a 12-minute
          // consultation isn't lost behind a dead end.
          if (data.emailAlreadyUsed) setStepIndex(0);
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

  /** Radio list — used for every single-choice question. */
  function ChoiceList({
    name,
    options,
    value,
    onChange,
  }: {
    name: string;
    options: readonly LeadFieldOption[];
    value: string;
    onChange: (v: string) => void;
  }) {
    return (
      <div role="radiogroup" aria-label={name} className="flex flex-col gap-2">
        {options.map((option) => {
          const selected = value === option.value;
          return (
            <button
              key={option.value}
              type="button"
              role="radio"
              aria-checked={selected}
              onClick={() => onChange(option.value)}
              className={`flex items-center gap-3 rounded-xl border px-4 py-3 text-left text-[14px] transition-colors ${
                selected
                  ? 'border-primary bg-[#FDF6EC] font-medium text-heading'
                  : 'border-stone-200 bg-white text-body hover:border-stone-300'
              }`}
            >
              <span
                aria-hidden="true"
                className={`flex h-4 w-4 flex-none items-center justify-center rounded-full border-2 ${
                  selected ? 'border-primary' : 'border-stone-300'
                }`}
              >
                {selected && <span className="h-2 w-2 rounded-full bg-primary" />}
              </span>
              {option.label}
            </button>
          );
        })}
      </div>
    );
  }

  /** Month + year pair, used by both date questions. */
  function MonthYear({
    idPrefix,
    monthValue,
    yearValue,
    years,
    onMonth,
    onYear,
  }: {
    idPrefix: string;
    monthValue: string;
    yearValue: string;
    years: readonly LeadFieldOption[];
    onMonth: (v: string) => void;
    onYear: (v: string) => void;
  }) {
    return (
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label htmlFor={`${idPrefix}-month`} className="mb-1.5 block text-[13px] font-medium text-heading">
            Month
          </label>
          <select
            id={`${idPrefix}-month`}
            value={monthValue}
            onChange={(e) => onMonth(e.target.value)}
            className={`${FIELD_CLASSES} ${monthValue ? '' : 'text-stone-400'}`}
          >
            <option value="" disabled>
              Select…
            </option>
            {MONTHS.map((m) => (
              <option key={m.value} value={m.value}>
                {m.label}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor={`${idPrefix}-year`} className="mb-1.5 block text-[13px] font-medium text-heading">
            Year
          </label>
          <select
            id={`${idPrefix}-year`}
            value={yearValue}
            onChange={(e) => onYear(e.target.value)}
            className={`${FIELD_CLASSES} ${yearValue ? '' : 'text-stone-400'}`}
          >
            <option value="" disabled>
              Select…
            </option>
            {years.map((y) => (
              <option key={y.value} value={y.value}>
                {y.label}
              </option>
            ))}
          </select>
        </div>
      </div>
    );
  }

  const QUESTION_TITLES: Record<StepId, string> = {
    identity: 'Enter your details to see your feedback',
    stage: 'Where are you currently in relation to GP training?',
    trainingStart: 'When did you start GP training?',
    aktStatus: 'Where are you with the AKT?',
    aktSitting: followUpLabel('akt', answers.aktStatus),
    scaStatus: 'Where are you with the SCA?',
    scaSitting: followUpLabel('sca', answers.scaStatus),
    role: 'Which best describes you?',
    expectedStart: 'When are you due to start GP training?',
  };

  return (
    <div className="min-h-[100dvh] flex items-center justify-center px-6 py-16">
      <motion.div
        className="w-full max-w-md"
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ type: 'spring', stiffness: 60, damping: 20 }}
      >
        {step === 'details' && (
          <div className={card}>
            <div className="text-center">
              <CompletePill />
            </div>

            {/* Progress — the total moves as branches open and close, which is
                honest: a passed-exam answer genuinely shortens the flow. */}
            <div className="mb-5 flex items-center gap-2" aria-hidden="true">
              {steps.map((s, i) => (
                <span
                  key={s}
                  className={`h-1 flex-1 rounded-full transition-colors ${
                    i <= stepIndex ? 'bg-primary' : 'bg-stone-200'
                  }`}
                />
              ))}
            </div>

            <h1 className="mb-2 text-center text-[22px] font-bold leading-snug tracking-[-0.02em] text-heading sm:text-[24px]">
              {QUESTION_TITLES[currentStep]}
            </h1>
            {currentStep === 'identity' && (
              <p className="mb-6 text-center text-[14px] leading-relaxed text-muted">
                We&apos;ll send a 6-digit code to verify your email, then your report opens
                straight away.
              </p>
            )}

            <form
              onSubmit={(e) => {
                e.preventDefault();
                if (!stepReady || submitting) return;
                if (isLastStep) void requestCode();
                else setStepIndex((i) => i + 1);
              }}
              className={`${currentStep === 'identity' ? '' : 'mt-6'} space-y-4 text-left`}
            >
              {currentStep === 'identity' && (
                <>
                  <div>
                    <label htmlFor="trial-email" className="mb-1.5 block text-[13px] font-medium text-heading">
                      Email
                    </label>
                    <input
                      id="trial-email"
                      type="email"
                      required
                      autoComplete="email"
                      value={answers.email}
                      onChange={(e) => set('email', e.target.value)}
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
                          onClick={() => set('email', emailSuggestion)}
                          className="font-semibold underline underline-offset-2"
                        >
                          {emailSuggestion}
                        </button>
                        ?
                      </p>
                    )}
                  </div>
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
                      value={answers.firstName}
                      onChange={(e) => set('firstName', e.target.value)}
                      placeholder="Sarah"
                      className={`${FIELD_CLASSES} placeholder:text-stone-400`}
                    />
                  </div>
                </>
              )}

              {currentStep === 'stage' && (
                <ChoiceList
                  name="Training stage"
                  options={TRAINING_STAGES}
                  value={answers.trainingStage}
                  onChange={(v) => set('trainingStage', v)}
                />
              )}

              {currentStep === 'trainingStart' && (
                <MonthYear
                  idPrefix="trial-training-start"
                  monthValue={answers.trainingStartMonth}
                  yearValue={answers.trainingStartYear}
                  years={TRAINING_START_YEARS}
                  onMonth={(v) => set('trainingStartMonth', v)}
                  onYear={(v) => set('trainingStartYear', v)}
                />
              )}

              {currentStep === 'aktStatus' && (
                <ChoiceList
                  name="AKT status"
                  options={EXAM_STATUSES}
                  value={answers.aktStatus}
                  onChange={(v) => set('aktStatus', v)}
                />
              )}

              {currentStep === 'aktSitting' && (
                <ChoiceList
                  name="AKT sitting"
                  options={followUpFor('akt', answers.aktStatus)?.options ?? []}
                  value={answers.aktSitting}
                  onChange={(v) => set('aktSitting', v)}
                />
              )}

              {currentStep === 'scaStatus' && (
                <ChoiceList
                  name="SCA status"
                  options={EXAM_STATUSES}
                  value={answers.scaStatus}
                  onChange={(v) => set('scaStatus', v)}
                />
              )}

              {currentStep === 'scaSitting' && (
                <ChoiceList
                  name="SCA sitting"
                  options={followUpFor('sca', answers.scaStatus)?.options ?? []}
                  value={answers.scaSitting}
                  onChange={(v) => set('scaSitting', v)}
                />
              )}

              {currentStep === 'role' && (
                <ChoiceList
                  name="Which best describes you"
                  options={NOT_IN_TRAINING_ROLES}
                  value={answers.notInTrainingRole}
                  onChange={(v) => set('notInTrainingRole', v)}
                />
              )}

              {currentStep === 'expectedStart' && (
                <MonthYear
                  idPrefix="trial-expected-start"
                  monthValue={answers.expectedStartMonth}
                  yearValue={answers.expectedStartYear}
                  years={EXPECTED_START_YEARS}
                  onMonth={(v) => set('expectedStartMonth', v)}
                  onYear={(v) => set('expectedStartYear', v)}
                />
              )}

              {error && (
                <div className="rounded-lg border border-danger/20 bg-danger/10 p-3">
                  <p className="text-center text-sm text-danger">{error}</p>
                </div>
              )}

              <div className="flex items-center gap-3 pt-1">
                {stepIndex > 0 && (
                  <button
                    type="button"
                    onClick={() => {
                      setError(null);
                      setStepIndex((i) => Math.max(0, i - 1));
                    }}
                    className="flex flex-none items-center gap-1.5 rounded-xl border border-stone-200 bg-white px-4 py-4 text-[14px] font-medium text-heading"
                  >
                    <ArrowLeft className="h-4 w-4" aria-hidden="true" />
                    Back
                  </button>
                )}
                <button
                  type="submit"
                  disabled={!stepReady || submitting}
                  className="cta-button w-full px-6 py-4 text-base disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {submitting
                    ? 'Sending…'
                    : isLastStep
                      ? 'Send my verification code'
                      : 'Continue'}
                  {!submitting && <ArrowRight className="h-4 w-4" />}
                </button>
              </div>
            </form>

            {/* Consent covers what is actually sent: the verification code and
                marketing email. The report itself is never emailed. */}
            {isLastStep && (
              <p className="mt-4 text-[11px] leading-relaxed text-muted">
                By continuing you agree to receive SCA preparation emails from Fourteen
                Fisherman. Unsubscribe anytime.
              </p>
            )}
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
            {/* No copy of the report is emailed — the only message that goes
                out is the verification code — so this must not promise one. */}
            <p className="mb-6 text-[14px] leading-relaxed text-muted">
              Your report is ready. Open it below for your scores against the three
              SCA marking domains, and the moments that cost you marks.
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
