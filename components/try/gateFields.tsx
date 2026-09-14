'use client';

import { Check } from 'lucide-react';
import type { RefObject } from 'react';
import { MONTHS, type LeadFieldOption } from '@/lib/trial/leadFields';

/**
 * The pieces the report gate is built from, restored from main's
 * EmailVerificationGate where they lived inside the component body. They are
 * module-level here so React keeps one component per field across renders
 * instead of remounting a fresh one on every keystroke.
 */

export const GATE_FIELD_CLASSES =
  'w-full rounded-xl border border-stone-200 bg-white px-4 py-3 text-[14px] text-heading outline-none transition-colors focus:border-primary';

/** Six, matching `CODE_LENGTH` in the server-only lib/trial/verification. */
export const GATE_CODE_LENGTH = 6;

export const GATE_CARD =
  'rounded-[22px] border border-black/[0.06] bg-surface-raised p-7 shadow-[0_16px_42px_rgba(180,83,9,0.06)] sm:p-9';

export function CompletePill() {
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

interface ChoiceListProps {
  name: string;
  options: readonly LeadFieldOption[];
  value: string;
  onChange: (value: string) => void;
}

/** Radio list, used for every single-choice question. */
export function ChoiceList({ name, options, value, onChange }: ChoiceListProps) {
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

interface MonthYearProps {
  idPrefix: string;
  monthValue: string;
  yearValue: string;
  years: readonly LeadFieldOption[];
  onMonth: (value: string) => void;
  onYear: (value: string) => void;
}

/** Month and year pair, used by both date questions. */
export function MonthYear({ idPrefix, monthValue, yearValue, years, onMonth, onYear }: MonthYearProps) {
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
          className={`${GATE_FIELD_CLASSES} ${monthValue ? '' : 'text-stone-400'}`}
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
          className={`${GATE_FIELD_CLASSES} ${yearValue ? '' : 'text-stone-400'}`}
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

interface CodeBoxesProps {
  code: string;
  submitting: boolean;
  inputRef: RefObject<HTMLInputElement | null>;
  onChange: (raw: string) => void;
}

/**
 * One real input drives six display boxes, so paste and autofill work exactly
 * like a normal field.
 */
export function CodeBoxes({ code, submitting, inputRef, onChange }: CodeBoxesProps) {
  return (
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
        onChange={(e) => onChange(e.target.value)}
        disabled={submitting}
        className="absolute inset-0 h-full w-full cursor-text opacity-0"
      />
      {Array.from({ length: GATE_CODE_LENGTH }, (_, i) => {
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
  );
}

export function GateError({ message, className = '' }: { message: string | null; className?: string }) {
  if (!message) return null;
  return (
    <div className={`rounded-lg border border-danger/20 bg-danger/10 p-3 ${className}`}>
      <p className="text-center text-sm text-danger">{message}</p>
    </div>
  );
}
