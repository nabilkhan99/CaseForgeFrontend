'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { ArrowRight } from 'lucide-react';
import {
  CODE_LENGTH,
  CodeStep,
  EMAIL_RE,
  EXISTING_ACCOUNT_NOTICE,
  EXISTING_ACCOUNT_NOTICE_MS,
  EmailField,
  MobileField,
  PasswordField,
} from '@/components/account/AccountFormFields';
import VerdictReveal, { useVerdictPoll } from '@/components/try/VerdictReveal';
import { passwordLongEnough } from '@/lib/auth/passwordPolicy';
import { trackEvent } from '@/lib/analytics';
import { trackTrialAccountCreated } from '@/lib/trial/trialEvents';
import {
  TRIAL_EMAIL_KEY,
  TRIAL_USED_KEY,
  TRIAL_FEEDBACK_URL_KEY,
  markTrialClaimed,
} from '@/lib/trial/storage';

/**
 * Set up your account while we mark your consultation. Contract C4.
 *
 * The consultation is over, the transcript is saved, and the mark takes about a
 * minute. That minute is the only moment in this funnel where somebody is
 * certain to be waiting for something they want, so it is where the account
 * gets made — three fields and a code, finishing at the same instant the report
 * does, inside the dashboard.
 *
 * ## What it replaces
 *
 * A nine-step questionnaire and an SMS step, which stood between a finished
 * consultation and the report it had earned and which about a quarter of
 * finishers walked away from. The exam questions are not gone; they are asked
 * on the dashboard, once, while the first mark runs
 * (components/dashboard/TrialQuestionnaireCard).
 *
 * ## When there is no mark to wait for
 *
 * The premise only holds while a mark is actually running. A consultation
 * nobody ended — a closed tab, a dead connection — leaves a row that never
 * moved past `live`, so no transcript was saved and nothing was ever sent to be
 * marked; this page used to promise that person a mark for five solid minutes
 * and then go quiet. `/api/try/gate-status` now says `unfinished` for those,
 * and both the heading and the line under it follow the poll rather than the
 * premise. The form does not change: the account is worth having either way,
 * and the case can be run again from the dashboard.
 *
 * ## Why the address is saved before the code is asked for
 *
 * `/api/try/save-lead` writes the lead the moment there is an address to write —
 * ON BLUR, not on submit. Everyone who typed one and then abandoned used to
 * leave nothing behind at all, and the button is precisely what an abandoning
 * visitor does not press; the gate this replaced saved per question, so saving
 * only at the end would have been a step backwards. Fire-and-forget: it must
 * never delay the code or show an error.
 *
 * ## The password, and when it actually takes
 *
 * `verify-code` sets it only when the signed `ff_guest` cookie proves this
 * browser ran the consultation (contract C3). A legacy report link opened in a
 * browser with no such cookie still makes the account, still claims the
 * consultation and still signs them in — the password simply does not take, and
 * the middleware sends them to /auth/set-password.
 *
 * So on those the field is not shown at all. `proven` comes from the page,
 * which can read the httpOnly cookie this component cannot: asking for a
 * password the server has already decided to discard is a field whose only
 * function is to be ignored, and the line under it promised a report "in your
 * dashboard" to somebody the middleware is about to send to a password form.
 * Unproven, the form asks for an address and a mobile, and says what will
 * actually happen — a code, then their report.
 */

interface VerifyBody {
  ok?: true;
  error?: string;
  signedIn?: boolean;
  redirectTo?: string;
  account?: {
    userId: string;
    created: boolean;
    /** The address already had an account; this call signed them into it. */
    alreadyExisted?: boolean;
    /** They typed a password and the account's existing one was kept. */
    passwordKept?: boolean;
  } | null;
}

type Step = 'details' | 'code' | 'stranded';

export interface SignUpWhileMarkingProps {
  sessionId: string;
  /**
   * The case this consultation was on, so a run too short to mark can offer to
   * run THAT one properly. Null when the row carries no station.
   */
  stationId?: string | null;
  /**
   * The signed `ff_guest` cookie says this browser ran this consultation, so a
   * password typed here will be honoured (contract C3).
   *
   * False on a legacy report link — forwarded, opened on another device, or
   * from before the cookie existed. Defaults to true so the ordinary path is
   * the one a caller gets by saying nothing; it is the page that knows, because
   * the cookie is httpOnly and this component cannot see it.
   */
  proven?: boolean;
}

export default function SignUpWhileMarking({
  sessionId,
  stationId,
  proven = true,
}: SignUpWhileMarkingProps) {
  const [step, setStep] = useState<Step>('details');

  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');

  const [code, setCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  /** Said out loud before the redirect when the typed password was not applied. */
  const [notice, setNotice] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [cooldown, setCooldown] = useState(0);
  const codeInputRef = useRef<HTMLInputElement>(null);
  /** The address+mobile last written, so a blur per focus change is not a POST each. */
  const savedLead = useRef('');

  // One poll for the whole page: the status line reads it, and VerdictReveal is
  // handed the same value rather than opening a second loop of its own.
  const marking = useVerdictPoll(sessionId);

  const cleanEmail = email.trim().toLowerCase();
  // No password asked for means none to check. The account is still made, still
  // claims the consultation and still signs them in; they choose a password on
  // /auth/set-password, which is where the middleware takes them.
  const detailsReady =
    EMAIL_RE.test(cleanEmail) && (!proven || passwordLongEnough(password));
  /** One click back into the same case, for a run that was too short to mark. */
  const retryHref = stationId
    ? `/try/talk?station=${encodeURIComponent(stationId)}`
    : '/try/talk';

  useEffect(() => {
    void trackEvent('trial_gate_shown', { session: sessionId, door: 'signup_while_marking' });
  }, [sessionId]);

  useEffect(() => {
    if (cooldown <= 0) return;
    const timer = setTimeout(() => setCooldown((seconds) => seconds - 1), 1000);
    return () => clearTimeout(timer);
  }, [cooldown]);

  /**
   * Write the lead now, without waiting for it. See the header.
   *
   * Called on blur as well as on submit, and does nothing until there is an
   * address worth writing or when nothing has changed since the last write.
   */
  function saveLead() {
    const fingerprint = `${cleanEmail}|${phone.trim()}`;
    if (!EMAIL_RE.test(cleanEmail) || savedLead.current === fingerprint) return;
    savedLead.current = fingerprint;
    void fetch('/api/try/save-lead', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sessionId, email: cleanEmail, phone: phone.trim() }),
    }).catch(() => {
      // Deliberately silent — send-code writes the row again anyway.
    });
  }

  async function requestCode() {
    if (submitting) return;
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch('/api/try/send-code', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        // `mode` opts into the guest door's relaxed validation: this form asks
        // for three things, not the nine the legacy gate asked for. The session
        // check is untouched by it.
        body: JSON.stringify({
          sessionId,
          mode: 'guest_signup',
          email: cleanEmail,
          phone: phone.trim(),
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
          // A code went out a moment ago (a reload, a double submit) and is
          // still live, so move on rather than dead-ending on a cooldown.
          setCooldown(data.retryAfter);
          setCode('');
          setStep('code');
          return;
        }
        setError(data.error ?? 'Something went wrong — please try again');
        return;
      }
      setCooldown(data.resendCooldown ?? 0);
      setCode('');
      setStep('code');
      void trackEvent('trial_gate_code_requested', { door: 'signup_while_marking' });
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
          sessionId,
          code: candidate,
          // The address as well as the session: a returning trainee's verified
          // lead stays on the consultation it was verified against, so there is
          // no lead pointing at THIS one to find. `sessionId` still wins — the
          // address is only consulted when the session finds nothing and the
          // guest cookie proves this browser ran it.
          email: cleanEmail,
          password,
          // Sent as typed; the server stores E.164 where it can parse one. Both
          // are honoured only behind the cookie proof — see the header.
          ...(phone.trim() ? { phone: phone.trim() } : {}),
        }),
      });
      const data = (await res.json()) as VerifyBody;
      if (!res.ok || !data.ok) {
        setCode('');
        codeInputRef.current?.focus();
        setError(data.error ?? "That code isn't right — check the email and try again");
        return;
      }

      rememberAddress();
      // Awaited so the capture flushes before the navigation tears the page down.
      await trackTrialAccountCreated('guest');

      if (data.signedIn && data.redirectTo) {
        // They typed a password onto an address that already had one. It was
        // kept, on purpose, and saying nothing about it is how somebody ends up
        // locked out of an account they believe they just set a password on.
        if (data.account?.alreadyExisted && data.account?.passwordKept) {
          setNotice(EXISTING_ACCOUNT_NOTICE);
          await new Promise((resolve) => setTimeout(resolve, EXISTING_ACCOUNT_NOTICE_MS));
        }
        // A full navigation, not a router push: the session cookies arrived on
        // the response above and every server component past here — the report
        // included — has to be rendered with them.
        window.location.assign(data.redirectTo);
        return;
      }
      // Account made, grant made, no session. Rare and recoverable.
      setStep('stranded');
    } catch {
      setError('Something went wrong — please try again');
    } finally {
      setSubmitting(false);
    }
  }

  /** So the navbar can offer a returning visitor their own report. Never a gate. */
  function rememberAddress() {
    try {
      window.localStorage.setItem(TRIAL_EMAIL_KEY, cleanEmail);
      window.localStorage.setItem(TRIAL_USED_KEY, '1');
      window.localStorage.setItem(TRIAL_FEEDBACK_URL_KEY, `/try/feedback/${sessionId}`);
    } catch {
      // Storage unavailable — nothing here depends on it.
    }
    // The account exists now, which is what turns the navbar's offer from
    // "finish this" into "read your report". Only reached on a verified code.
    markTrialClaimed();
  }

  function handleCodeChange(raw: string) {
    const digits = raw.replace(/\D/g, '').slice(0, CODE_LENGTH);
    setCode(digits);
    setError(null);
    if (digits.length === CODE_LENGTH) void submitCode(digits);
  }

  // Short top padding: the layout above this one carries the brand mark.
  return (
    <main className="px-5 pb-24 pt-8 sm:px-8 sm:pt-10">
      {/*
        Their own verdict, score and one-line summary, above the form — and the
        short-run notice when the run was too brief to grade. Renders nothing at
        all while the mark is still running: the status line below says that
        better, and a reveal that could get in the way of the form would be
        worse than no reveal.

        "Run it properly" points back at THIS case. A run too short to mark is
        the one state where the person has nothing yet and every reason to try
        again, and a dead end there costs the consultation AND the account.
      */}
      <VerdictReveal
        sessionId={sessionId}
        state={marking}
        showWaiting={false}
        retryHref={retryHref}
      />

      <div className="mx-auto mt-10 max-w-[27rem]">
        <motion.h1
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.45 }}
          className="text-[28px] font-medium leading-[1.12] tracking-tight text-heading sm:text-[34px]"
        >
          {headingFor(marking.kind)}
        </motion.h1>

        <MarkingStatus kind={marking.kind} />

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
                  if (!detailsReady) return;
                  saveLead();
                  void requestCode();
                }}
              >
                <EmailField
                  id="marking-email"
                  value={email}
                  onChange={setEmail}
                  onBlur={saveLead}
                />
                <MobileField id="marking-phone" value={phone} onChange={setPhone} />
                {proven && (
                  <PasswordField id="marking-password" value={password} onChange={setPassword} />
                )}

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
                {proven ? (
                  <>
                    We&apos;ll email you a 6-digit code to confirm the address. Your report
                    opens in your dashboard, with four more cases and five days on the clock —
                    no card.
                  </>
                ) : (
                  <>We&apos;ll email you a code, then open your report.</>
                )}
              </p>
            </>
          )}

          {notice && (
            <div
              role="status"
              className="mb-4 rounded-lg border border-primary/20 bg-primary/[0.06] p-3"
            >
              <p className="text-center text-sm leading-relaxed text-heading">{notice}</p>
            </div>
          )}

          {step === 'code' && (
            <CodeStep
              email={cleanEmail}
              code={code}
              onCodeChange={handleCodeChange}
              inputRef={codeInputRef}
              submitting={submitting}
              error={error}
              cooldown={cooldown}
              onResend={() => void requestCode()}
              onBack={() => {
                setStep('details');
                setCode('');
                setError(null);
              }}
            />
          )}

          {step === 'stranded' && (
            <div className="text-center">
              <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-heading sm:text-[11px]">
                You&apos;re in
              </p>
              <p className="mx-auto mt-3 mb-5 max-w-sm text-[14px] leading-relaxed text-muted">
                Your account and your five cases are ready, and this consultation is on
                them. Sign in to open your report.
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
  );
}

/**
 * The heading, driven by the same poll as the line beneath it.
 *
 * "While we mark your consultation" is the offer on this page and it is true
 * exactly while a mark is running. On a consultation nobody finished there is
 * no mark — and a headline that says otherwise, over a line saying the run was
 * never completed, reads as a page that has lost track of what happened. The
 * account is still the thing being offered, so the heading names that instead.
 */
function headingFor(kind: MarkingKind): string {
  switch (kind) {
    case 'ready':
      return 'Set up your account to open your report';
    case 'unmarkable':
    case 'unfinished':
      return 'Set up your free account';
    default:
      return 'Set up your account while we mark your consultation';
  }
}

type MarkingKind = 'waiting' | 'ready' | 'unmarkable' | 'unfinished' | 'silent';

/**
 * One line, under the heading, saying where the mark has got to.
 *
 * The whole premise of the page is that the wait is free time, so the wait has
 * to be visible and finite. "About a minute" is the truth — marking runs 80–90
 * seconds on a full station — and it stops being a promise the moment the
 * result lands, or the moment the server says no mark is coming at all.
 */
function MarkingStatus({ kind }: { kind: MarkingKind }) {
  if (kind === 'silent') return null;

  const line =
    kind === 'waiting'
      ? 'Marking your consultation. It takes about a minute.'
      : kind === 'ready'
        ? 'Your report is ready'
        : kind === 'unfinished'
          ? "This one wasn't finished. Set up your account and run it again from your dashboard."
          : 'You can still set up your free account and run it again.';

  return (
    <motion.p
      key={kind}
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: 0.06 }}
      className="mt-3 flex items-start gap-2.5 text-base leading-relaxed text-body"
    >
      {kind === 'waiting' && (
        <span
          aria-hidden="true"
          className="mt-[0.6em] inline-block h-2 w-2 shrink-0 animate-pulse rounded-full bg-primary"
        />
      )}
      {line}
    </motion.p>
  );
}
