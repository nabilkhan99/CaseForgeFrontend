'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { ArrowLeft, ArrowRight, Check } from 'lucide-react';
import { trackEvent } from '@/lib/analytics';
import { suggestEmailFix } from '@/lib/trial/emailTypo';
import {
  EXAM_STATUSES,
  EXPECTED_START_YEARS,
  NOT_IN_TRAINING_ROLES,
  TRAINING_STAGES,
  TRAINING_START_YEARS,
  followUpFor,
  followUpLabel,
} from '@/lib/trial/leadFields';
import {
  buildSteps,
  EMPTY_ANSWERS,
  isStepComplete,
  type QuestionnaireAnswers,
  type StepId,
} from '@/lib/trial/questionnaire';
import {
  ChoiceList,
  CodeBoxes,
  CompletePill,
  GATE_CARD,
  GATE_CODE_LENGTH,
  GATE_FIELD_CLASSES,
  GateError,
  MonthYear,
} from './gateFields';

/**
 * The email gate in front of a report opened from a link this browser did not
 * run: main's gate, restored for old report links (owner decision, Sept 2026).
 *
 * details, then a 6-digit email code, then "You're verified" and the report.
 * The report only opens once the address has proven it can receive email.
 *
 * What is different from main, on purpose:
 *
 * - **No SMS step.** Nothing in this product texts anybody any more. The phone
 *   number is still asked for and stored on the lead; the gate ends when the
 *   email is verified.
 * - **No account.** Exactly as on main. `verify-code` only makes an account
 *   and claims a consultation for the browser holding the signed guest cookie;
 *   a link on its own unlocks the report and nothing else.
 * - **No dashes in the copy.**
 *
 * The browser that ran the consultation never sees this: /try/feedback gives
 * it the sign-up while marking page instead.
 */

type GateStep = 'details' | 'code' | 'verified';

const GENERIC_ERROR = 'Something went wrong. Please try again.';

interface EmailVerificationGateProps {
  sessionId: string;
  /** Called when the verified visitor clicks through to their report. */
  onUnlock: (email: string) => void;
}

/** Changing an earlier answer can invalidate later ones, so they are cleared. */
function withAnswer<K extends keyof QuestionnaireAnswers>(
  prev: QuestionnaireAnswers,
  key: K,
  value: QuestionnaireAnswers[K],
): QuestionnaireAnswers {
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
}

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
  const cleanEmail = email.trim().toLowerCase();
  const emailSuggestion = suggestEmailFix(email);

  // Steps are recomputed from the answers, so a status with no follow-up
  // simply never contributes a step and the flow closes up behind it.
  const steps = useMemo(() => buildSteps(answers), [answers]);
  const currentStep: StepId = steps[Math.min(stepIndex, steps.length - 1)];
  const stepReady = isStepComplete(currentStep, answers);
  // Being at the end of the list is not the same as being finished: a branch
  // question sits at the end only because the step it will reveal does not
  // exist yet. Requiring the step to be answered too stops the button promising
  // the code while more questions are still coming.
  const isLastStep = stepIndex >= steps.length - 1 && stepReady;

  function set<K extends keyof QuestionnaireAnswers>(key: K, value: QuestionnaireAnswers[K]) {
    setError(null);
    setAnswers((prev) => withAnswer(prev, key, value));
  }

  /**
   * Record what they have told us so far, without waiting for it. Fire and
   * forget: if it fails, send-code still writes the whole row at the end.
   */
  function saveProgress(current: QuestionnaireAnswers) {
    if (!current.email) return;
    void fetch('/api/try/save-lead', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sessionId, ...current }),
    }).catch(() => {
      // Deliberately silent, see above.
    });
  }

  // Every stage is tracked so the abandon step is visible.
  useEffect(() => {
    void trackEvent('trial_gate_shown', { session: sessionId, door: 'report_link' });
  }, [sessionId]);

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
        body: JSON.stringify({ sessionId, ...answers, email: email.trim() }),
      });
      const data = (await res.json()) as {
        ok?: boolean;
        error?: string;
        resendCooldown?: number;
        retryAfter?: number;
      };
      if (!res.ok || !data.ok) {
        if (res.status === 429 && data.retryAfter) {
          // Already sent recently (a reload, say), so go to the code step.
          setCooldown(data.retryAfter);
          setCode('');
          setStep('code');
        } else {
          setError(data.error ?? GENERIC_ERROR);
        }
        return;
      }
      setCooldown(data.resendCooldown ?? 60);
      setCode('');
      setStep('code');
      void trackEvent('trial_gate_code_requested', { session: sessionId, door: 'report_link' });
    } catch {
      setError(GENERIC_ERROR);
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
        setError(data.error ?? GENERIC_ERROR);
        setCode('');
        codeInputRef.current?.focus();
        void trackEvent('trial_gate_code_failed', { session: sessionId, door: 'report_link' });
        return;
      }
      void trackEvent('trial_gate_code_verified', { session: sessionId, door: 'report_link' });
      setStep('verified');
    } catch {
      setError(GENERIC_ERROR);
    } finally {
      setSubmitting(false);
    }
  }

  function handleCodeChange(raw: string) {
    const digits = raw.replace(/\D/g, '').slice(0, GATE_CODE_LENGTH);
    setCode(digits);
    setError(null);
    if (digits.length === GATE_CODE_LENGTH) void verifyCode(digits);
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
          <div className={GATE_CARD}>
            <div className="text-center">
              <CompletePill />
            </div>

            {/* Progress. The total moves as branches open and close, which is
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
                void trackEvent('trial_gate_step_completed', { session: sessionId, step: currentStep });
                // The last step goes straight to send-code, which writes the
                // whole row itself; saving again first would be a wasted write.
                if (isLastStep) {
                  void requestCode();
                } else {
                  saveProgress(answers);
                  setStepIndex((i) => i + 1);
                }
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
                      className={`${GATE_FIELD_CLASSES} placeholder:text-stone-400 ${
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
                      className={`${GATE_FIELD_CLASSES} placeholder:text-stone-400`}
                    />
                  </div>
                  <div>
                    <label htmlFor="trial-phone" className="mb-1.5 block text-[13px] font-medium text-heading">
                      Phone number
                    </label>
                    <input
                      id="trial-phone"
                      type="tel"
                      required
                      autoComplete="tel"
                      maxLength={20}
                      value={answers.phone}
                      onChange={(e) => set('phone', e.target.value)}
                      placeholder="07123 456789"
                      className={`${GATE_FIELD_CLASSES} placeholder:text-stone-400`}
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

              <GateError message={error} />

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
                  {submitting ? 'Sending…' : isLastStep ? 'Send my verification code' : 'Continue'}
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
          <div className={`${GATE_CARD} text-center`}>
            <CompletePill />
            <h1 className="mb-2 text-[26px] font-bold tracking-[-0.02em] text-heading">
              Check your inbox
            </h1>
            <p className="mb-6 text-[14px] leading-relaxed text-muted">
              Enter the 6-digit code we&apos;ve just sent to{' '}
              <b className="font-semibold text-heading">{cleanEmail}</b>.
            </p>

            <CodeBoxes
              code={code}
              submitting={submitting}
              inputRef={codeInputRef}
              onChange={handleCodeChange}
            />

            <GateError message={error} className="mt-3" />

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

            <div className="mt-4 flex items-center justify-between gap-3 rounded-xl border border-stone-200 bg-surface-warm px-3.5 py-3 text-left text-[13px]">
              <span className="text-muted">
                Wrong address?{' '}
                <span className="break-all font-semibold text-heading">{cleanEmail}</span>
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
          <div className={`${GATE_CARD} text-center`}>
            <div
              className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full"
              style={{ background: 'rgba(22,163,74,0.08)', border: '1px solid rgba(22,163,74,0.2)' }}
            >
              <Check className="h-6 w-6 text-[#16A34A]" strokeWidth={3} aria-hidden="true" />
            </div>
            <h1 className="mb-2 text-[26px] font-bold tracking-[-0.02em] text-heading">
              You&apos;re verified
            </h1>
            {/* No copy of the report is emailed (the only message that goes
                out is the verification code), so this must not promise one. */}
            <p className="mb-6 text-[14px] leading-relaxed text-muted">
              Your report is ready. Open it below for your scores against the three
              SCA marking domains, and the moments that cost you marks.
            </p>
            <button
              type="button"
              onClick={() => {
                void trackEvent('trial_gate_unlocked', { session: sessionId, door: 'report_link' });
                onUnlock(cleanEmail);
              }}
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
