'use client';

import { useEffect, useState, type RefObject } from 'react';
import { Eye, EyeOff } from 'lucide-react';
import { MIN_PASSWORD_LENGTH, PASSWORD_HINT } from '@/lib/auth/passwordPolicy';
import { suggestEmailFix } from '@/lib/trial/emailTypo';

/**
 * The three fields and the code step that make a free account, wherever the
 * account is being made.
 *
 * Lifted verbatim out of components/free/FreeStart.tsx when a SECOND surface
 * needed the same form: components/try/SignUpWhileMarking, which asks for the
 * same three things on the post-consultation page while the mark is running.
 * Two copies of a password field is two places for the reveal toggle, the
 * autocomplete hints and the minimum length to drift apart — and the one that
 * drifts is always the one nobody is looking at.
 *
 * DELIBERATELY NOT A WHOLE FORM. What differs between the two doors is
 * everything around the fields: the headings, the submit copy, which endpoint
 * the code is requested from, and what happens after it verifies. Those stay
 * with their pages, and this file stays the part that is genuinely identical.
 *
 * ## The code boxes
 *
 * One real input driving six display boxes, so paste and iOS one-time-code
 * autofill behave as people expect. components/free/FreeSignUpBox keeps its own
 * copy of this markup for the reason it gives in its own header; this module is
 * shared by the two doors that ask for a password as well.
 */

/** Six, matching `CODE_LENGTH` in the server-only lib/trial/verification. */
export const CODE_LENGTH = 6;

export const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export const FIELD =
  'w-full rounded-xl border border-defined bg-white px-4 py-3.5 text-base text-heading outline-none transition placeholder:text-muted focus:border-primary';

export const LABEL = 'mb-1.5 block text-[13px] font-medium text-heading';

interface TextFieldProps {
  /** Unique per page — two of these can be on screen at once in principle. */
  id: string;
  value: string;
  onChange: (value: string) => void;
}

interface EmailFieldProps extends TextFieldProps {
  /**
   * Fired when the field loses focus.
   *
   * The post-call sign-up saves the lead here, because the address is the one
   * thing worth keeping from a form somebody walks away from and the submit
   * button is exactly what they do not press. Optional: the account-first form
   * has no early save to make.
   */
  onBlur?: () => void;
}

/**
 * The address, with the typo catch under it.
 *
 * `suggestEmailFix` is the difference between a code that arrives and a code
 * that goes to gmial.com, which on this funnel is the difference between an
 * account and nothing at all.
 */
export function EmailField({ id, value, onChange, onBlur }: EmailFieldProps) {
  const suggestion = suggestEmailFix(value);

  return (
    <div>
      <label htmlFor={id} className={LABEL}>
        Email
      </label>
      <input
        id={id}
        type="email"
        required
        inputMode="email"
        autoComplete="email"
        placeholder="doctor@nhs.net"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        onBlur={onBlur}
        className={`${FIELD} ${suggestion ? '!border-[#D9A67C]' : ''}`}
      />
      {suggestion && (
        <p className="mt-1.5 flex items-center gap-1.5 text-[12.5px] text-[#A65B2A]">
          <span aria-hidden="true">⚠</span>
          Did you mean{' '}
          <button
            type="button"
            onClick={() => onChange(suggestion)}
            className="font-semibold underline underline-offset-2"
          >
            {suggestion}
          </button>
          ?
        </p>
      )}
    </div>
  );
}

/**
 * The mobile.
 *
 * No asterisk and no parenthetical: the form submits without it, and a field
 * labelled with its own unimportance is a field nobody fills in. Nothing is
 * ever texted to it — it is a line to a human if they get stuck.
 */
export function MobileField({ id, value, onChange }: TextFieldProps) {
  return (
    <div>
      <label htmlFor={id} className={LABEL}>
        Mobile
      </label>
      <input
        id={id}
        type="tel"
        inputMode="tel"
        autoComplete="tel"
        maxLength={20}
        placeholder="+44 7…"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className={FIELD}
      />
    </div>
  );
}

/** The password, with the reveal toggle and the length hint under it. */
export function PasswordField({ id, value, onChange }: TextFieldProps) {
  const [revealed, setRevealed] = useState(false);

  return (
    <div>
      <label htmlFor={id} className={LABEL}>
        Password
      </label>
      <div className="relative">
        <input
          id={id}
          type={revealed ? 'text' : 'password'}
          required
          minLength={MIN_PASSWORD_LENGTH}
          autoComplete="new-password"
          value={value}
          onChange={(event) => onChange(event.target.value)}
          className={`${FIELD} pr-12`}
        />
        <button
          type="button"
          onClick={() => setRevealed((shown) => !shown)}
          aria-label={revealed ? 'Hide password' : 'Show password'}
          aria-pressed={revealed}
          className="absolute inset-y-0 right-0 flex w-12 items-center justify-center text-muted transition-colors hover:text-heading"
        >
          {revealed ? (
            <EyeOff className="h-4 w-4" aria-hidden="true" />
          ) : (
            <Eye className="h-4 w-4" aria-hidden="true" />
          )}
        </button>
      </div>
      <p className="mt-1.5 text-[12.5px] text-muted">{PASSWORD_HINT}</p>
    </div>
  );
}

interface CodeStepProps {
  /** Shown back to them, so a mistyped address is obvious before they wait. */
  email: string;
  code: string;
  /** Called with the raw input; strip and auto-submit live with the caller. */
  onCodeChange: (raw: string) => void;
  /** The caller holds it so it can re-focus the boxes after a wrong code. */
  inputRef: RefObject<HTMLInputElement | null>;
  submitting: boolean;
  error: string | null;
  /** Seconds left before another code may be asked for. */
  cooldown: number;
  onResend: () => void;
  /** Back to the fields. */
  onBack: () => void;
}

/** The six boxes, the resend, and the way back to a mistyped address. */
export function CodeStep({
  email,
  code,
  onCodeChange,
  inputRef,
  submitting,
  error,
  cooldown,
  onResend,
  onBack,
}: CodeStepProps) {
  useEffect(() => {
    inputRef.current?.focus();
  }, [inputRef]);

  return (
    <div className="text-center">
      <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-heading sm:text-[11px]">
        One code and you&apos;re in
      </p>
      <p className="mx-auto mt-3 mb-5 max-w-sm text-[14px] leading-relaxed text-muted">
        Enter the 6-digit code we&apos;ve just sent to{' '}
        <b className="font-semibold text-heading">{email}</b>.
      </p>

      <div
        className="relative mx-auto mb-2 flex w-fit cursor-text justify-center gap-2"
        onClick={() => inputRef.current?.focus()}
      >
        <input
          ref={inputRef}
          inputMode="numeric"
          autoComplete="one-time-code"
          pattern="[0-9]*"
          aria-label="6-digit verification code"
          value={code}
          onChange={(event) => onCodeChange(event.target.value)}
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
            onClick={onResend}
            disabled={submitting}
            className="font-medium text-heading underline underline-offset-2"
          >
            Resend code
          </button>
        )}
      </div>

      <button
        type="button"
        onClick={onBack}
        className="mt-4 text-[13px] text-muted underline underline-offset-2"
      >
        Wrong address?
      </button>
    </div>
  );
}
