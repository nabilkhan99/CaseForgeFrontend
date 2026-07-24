'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { ArrowLeft, ArrowRight, CalendarClock, Users } from 'lucide-react';
import LandingNavbar from '@/components/landing/LandingNavbar';
import LandingFooter from '@/components/landing/LandingFooter';
import { ACCESS_OPENS_LABEL, type CoachingDayAvailability } from '@/lib/commerce/plans';

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

function stockLine(day: CoachingDayAvailability): { text: string; tone: 'calm' | 'urgent' | 'muted' } {
  if (day.status === 'sold_out') return { text: 'Sold out', tone: 'muted' };
  if (day.status === 'closed') return { text: 'Bookings closed', tone: 'muted' };
  if (day.places_left >= day.capacity) return { text: `Only ${day.capacity} places per class`, tone: 'calm' };
  if (day.places_left === 1) return { text: 'Only 1 place left', tone: 'urgent' };
  return { text: `Only ${day.places_left} places left`, tone: 'urgent' };
}

/**
 * The coaching day picker: the single place where scarcity and timing render.
 * Reached from the Complete plan's "Choose your coaching day" CTA.
 */
export default function CoachingDayPage() {
  const [days, setDays] = useState<CoachingDayAvailability[] | null>(null);
  const [loadError, setLoadError] = useState(false);
  const [selected, setSelected] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const now = useNow(30_000);

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

  const selectable = useMemo(() => (days ?? []).filter((d) => d.status === 'open'), [days]);

  async function handleContinue() {
    if (!selected || submitting) return;
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch('/api/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ plan: 'complete', coachingDay: selected }),
      });
      const data = (await res.json()) as { url?: string; error?: string };
      if (!res.ok || !data.url) {
        setError(data.error ?? 'Something went wrong — please try again.');
        setSubmitting(false);
        return;
      }
      window.location.assign(data.url);
    } catch {
      setError('Something went wrong — please try again.');
      setSubmitting(false);
    }
  }

  return (
    <div className="min-h-[100dvh] bg-[#F7F2E7] font-sans">
      <LandingNavbar user={null} />
      <main className="mx-auto max-w-2xl px-5 pb-24 pt-28 sm:px-8 sm:pt-36">
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.45, ease: 'easeOut' }}
        >
          <Link
            href="/#pricing"
            className="inline-flex items-center gap-1.5 text-sm text-muted transition-colors hover:text-heading"
          >
            <ArrowLeft className="h-4 w-4" /> Back to plans
          </Link>

          <p className="mt-6 text-[11px] font-medium uppercase tracking-[0.08em] text-[#854F0B] sm:text-xs">
            Pre-order · Complete SCA Course · £599 one-off
          </p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight text-heading sm:text-4xl">
            Choose your coaching day
          </h1>
          <p className="mt-3 max-w-lg text-sm leading-relaxed text-body sm:text-base">
            One full day of live Small-Group Coaching, 9am to 6pm, remote, with a maximum class of
            six. It runs on the date you choose below.
          </p>
          <p className="mt-3 inline-flex max-w-lg rounded-lg bg-[#FDF6EC] px-3 py-1.5 text-[12px] font-medium leading-relaxed text-[#854F0B]">
            This is a pre-order: your AI practice and on-demand lectures start{' '}
            {ACCESS_OPENS_LABEL}, and your 3 months run from that date.
          </p>

          <div role="radiogroup" aria-label="Available coaching days" className="mt-8 flex flex-col gap-2.5">
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
                  onClick={() => setSelected(day.day)}
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
                      <p className="mt-0.5 text-xs text-body">9am to 6pm · Remote · Live</p>
                      {countdown && (
                        <p className="mt-0.5 text-xs font-semibold text-[#B42318]">{countdown}</p>
                      )}
                    </div>
                  </div>
                  <span
                    className={`inline-flex shrink-0 items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] ${
                      stock.tone === 'muted'
                        ? 'bg-stone-200 font-semibold text-stone-700'
                        : stock.tone === 'urgent'
                          ? 'bg-[#FDECEC] font-bold text-[#B42318]'
                          : 'bg-[#FDF6EC] font-medium text-[#854F0B]'
                    }`}
                  >
                    {stock.tone !== 'muted' && <Users className="h-3 w-3" aria-hidden="true" />}
                    {stock.text}
                  </span>
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

          {/* Jan–Aug 2027: no fixed dates yet — limited-availability pre-order by arrangement. */}
          <div className="mt-4 rounded-xl border border-dashed border-[#D8C7A8] bg-[#FCF7EE] px-4 py-4">
            <div className="flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center gap-1.5 rounded-full bg-[#FDF6EC] px-2.5 py-1 text-[11px] font-semibold text-[#854F0B]">
                <CalendarClock className="h-3 w-3" aria-hidden="true" /> Limited availability
              </span>
              <p className="text-sm font-semibold text-heading">
                Sitting your SCA in Jan–Aug 2027?
              </p>
            </div>
            <p className="mt-2 text-xs leading-relaxed text-body sm:text-sm">
              Dates for that window aren&rsquo;t fixed yet, but you can still pre-order. Email{' '}
              <a
                href="mailto:hello@fourteenfisherman.com?subject=Coaching%20day%20%E2%80%94%20Jan%E2%80%93Aug%202027"
                className="font-medium text-primary underline"
              >
                hello@fourteenfisherman.com
              </a>{' '}
              and we&rsquo;ll arrange your coaching day and set your AI practice and on-demand
              lecture access to start on a day of your choice.
            </p>
          </div>

          {error && (
            <p role="alert" className="mt-4 text-sm font-medium text-danger">
              {error}
            </p>
          )}

          {selectable.length > 0 && (
            <>
              <button
                type="button"
                onClick={handleContinue}
                disabled={!selected || submitting}
                className="cta-button mt-7 w-full px-6 py-4 text-base"
              >
                {submitting ? 'Redirecting to secure checkout…' : 'Continue to payment'}
                {!submitting && <ArrowRight className="h-4 w-4" />}
              </button>
              <p className="mt-3 text-center text-[11px] text-muted">
                Secure payment via Stripe · Receipt emailed instantly · Bookings close at midnight
                the day before each class
              </p>
            </>
          )}
        </motion.div>
      </main>
      <LandingFooter />
    </div>
  );
}
