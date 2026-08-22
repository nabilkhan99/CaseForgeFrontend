'use client';

import { useEffect, useState } from 'react';
import { Users } from 'lucide-react';
import type { CoachingDayAvailability } from '@/lib/commerce/plans';

/**
 * The coaching-day radio group, shared by the two places a coaching day is
 * chosen: the acquisition picker at `/coaching-day` and the in-app booking at
 * `/dashboard/coaching-day` (where a customer who upgraded to Complete in
 * Stripe's Portal picks their date afterwards). One copy, so scarcity,
 * cut-offs and sold-out states cannot drift between the page a stranger sees
 * and the page a customer sees.
 */

const COUNTDOWN_WINDOW_MS = 72 * 60 * 60 * 1000;

function useNow(intervalMs: number): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), intervalMs);
    return () => clearInterval(id);
  }, [intervalMs]);
  return now;
}

function countdownLabel(cutoffAt: string, now: number): string | null {
  const remaining = new Date(cutoffAt).getTime() - now;
  if (remaining <= 0 || remaining > COUNTDOWN_WINDOW_MS) return null;
  const hours = Math.floor(remaining / (60 * 60 * 1000));
  const minutes = Math.floor((remaining % (60 * 60 * 1000)) / (60 * 1000));
  return `Closes in ${hours}h ${minutes}m`;
}

/**
 * The scarcity badge, or null when there is no scarcity to report. A day with
 * every place still open shows nothing: the "maximum class of six" promise is
 * already made in the copy above, so a badge repeating it read as filler.
 * Only a genuinely filling class earns a badge, and it is always red.
 */
function stockLine(day: CoachingDayAvailability): { text: string; tone: 'urgent' | 'muted' } | null {
  if (day.status === 'sold_out') return { text: 'Sold out', tone: 'muted' };
  if (day.status === 'closed') return { text: 'Bookings closed', tone: 'muted' };
  if (day.places_left >= day.capacity) return null;
  if (day.places_left === 1) return { text: 'Only 1 place left', tone: 'urgent' };
  return { text: `Only ${day.places_left} places left`, tone: 'urgent' };
}

export interface CoachingDaysState {
  /** null while loading. */
  days: CoachingDayAvailability[] | null;
  loadError: boolean;
  /** Days a buyer can actually select — empty means "don't show a CTA". */
  selectable: CoachingDayAvailability[];
}

/** Loads live coaching-day availability. */
export function useCoachingDays(): CoachingDaysState {
  const [days, setDays] = useState<CoachingDayAvailability[] | null>(null);
  const [loadError, setLoadError] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetch('/api/coaching-days')
      .then((res) => (res.ok ? res.json() : Promise.reject(new Error(`HTTP ${res.status}`))))
      .then((data: { days: CoachingDayAvailability[] }) => {
        if (!cancelled) setDays(data.days ?? []);
      })
      .catch(() => {
        if (!cancelled) setLoadError(true);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return { days, loadError, selectable: (days ?? []).filter((d) => d.status === 'open') };
}

interface CoachingDayPickerProps {
  days: CoachingDayAvailability[] | null;
  loadError: boolean;
  selected: string | null;
  onSelect: (day: string) => void;
}

export default function CoachingDayPicker({
  days,
  loadError,
  selected,
  onSelect,
}: CoachingDayPickerProps) {
  const now = useNow(30_000);

  return (
    <div role="radiogroup" aria-label="Available coaching days" className="flex flex-col gap-2.5">
      {days === null && !loadError && (
        <div className="flex items-center justify-center rounded-xl border border-stone-200 bg-white py-10">
          <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
        </div>
      )}
      {loadError && (
        <p className="rounded-xl border border-stone-200 bg-white p-5 text-sm text-body">
          We couldn&rsquo;t load the coaching days — please refresh, or{' '}
          <a href="mailto:hello@fourteenfisherman.com" className="text-primary underline">
            email us
          </a>{' '}
          and we&rsquo;ll book you in directly.
        </p>
      )}
      {days?.map((day) => {
        const soldOut = day.status === 'sold_out';
        const closed = day.status === 'closed';
        const disabled = soldOut || closed;
        const isSelected = selected === day.day;
        const stock = stockLine(day);
        const countdown = !disabled ? countdownLabel(day.cutoff_at, now) : null;
        return (
          <button
            key={day.day}
            type="button"
            role="radio"
            aria-checked={isSelected}
            disabled={disabled}
            onClick={() => onSelect(day.day)}
            className={`flex items-center justify-between gap-3 rounded-xl border px-4 py-3.5 text-left transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/50 ${
              isSelected
                ? 'border-primary bg-[#FDF6EC] shadow-elevation-1'
                : disabled
                  ? 'border-stone-200 bg-stone-50'
                  : 'border-stone-200 bg-white hover:border-stone-300'
            }`}
          >
            <div className="flex items-center gap-3">
              <span
                aria-hidden="true"
                className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2 transition-colors ${
                  isSelected ? 'border-primary' : disabled ? 'border-stone-200' : 'border-stone-300'
                }`}
              >
                {isSelected && <span className="h-2.5 w-2.5 rounded-full bg-primary" />}
              </span>
              <div>
                <p className={`text-sm font-semibold ${disabled ? 'text-stone-500' : 'text-heading'}`}>
                  {day.label}
                </p>
                <p className="mt-0.5 text-xs text-body">9am to 5pm · Remote · Live</p>
                {countdown && (
                  <p className="mt-0.5 text-xs font-semibold text-[#B42318]">{countdown}</p>
                )}
              </div>
            </div>
            {stock && (
              <span
                className={`inline-flex shrink-0 items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] ${
                  stock.tone === 'muted'
                    ? 'bg-stone-200 font-semibold text-stone-700'
                    : 'bg-[#FDECEC] font-bold text-[#B42318]'
                }`}
              >
                {stock.tone !== 'muted' && <Users className="h-3 w-3" aria-hidden="true" />}
                {stock.text}
              </span>
            )}
          </button>
        );
      })}
      {days !== null && days.length === 0 && !loadError && (
        <p className="rounded-xl border border-stone-200 bg-white p-5 text-sm text-body">
          New coaching days are being scheduled —{' '}
          <a href="mailto:hello@fourteenfisherman.com" className="text-primary underline">
            email us
          </a>{' '}
          and we&rsquo;ll let you know as soon as dates open.
        </p>
      )}
    </div>
  );
}
