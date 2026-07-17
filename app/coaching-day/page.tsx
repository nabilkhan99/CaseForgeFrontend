'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { ArrowLeft, ArrowRight, Users } from 'lucide-react';
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

function stockLine(day: CoachingDayAvailability): { text: string; tone: 'calm' | 'urgent' | 'soldout' } {
  if (day.status === 'sold_out') return { text: 'Sold out', tone: 'soldout' };
  if (day.places_left >= 6) return { text: 'Only 6 places per class', tone: 'calm' };
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
            Complete SCA Course · £299 one-off
          </p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight text-heading sm:text-4xl">
            Choose your coaching day
          </h1>
          <p className="mt-3 max-w-lg text-sm leading-relaxed text-body sm:text-base">
            One full day of live Small-Group Coaching, 9am to 6pm, remote, with a maximum class of
            six. Your AI practice and on-demand lectures are separate — they unlock the moment you
            buy, for 3 months.
          </p>
          <p className="mt-3 inline-flex rounded-lg bg-[#FDF6EC] px-3 py-1.5 text-[12px] font-medium text-[#854F0B]">
            Access opens {ACCESS_OPENS_LABEL} — buy before then and your 3 months start on launch day.
          </p>

          <div className="mt-8 flex flex-col gap-2.5">
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
                  disabled={disabled}
                  onClick={() => setSelected(day.day)}
                  className={`flex items-center justify-between gap-3 rounded-xl border px-4 py-3.5 text-left transition-all ${
                    isSelected
                      ? 'border-primary bg-[#FDF6EC] shadow-elevation-1'
                      : disabled
                        ? 'border-stone-200 bg-stone-50'
                        : 'border-stone-200 bg-white hover:border-stone-300'
                  }`}
                >
                  <div>
                    <p className={`text-sm font-semibold ${soldOut ? 'text-stone-500' : 'text-heading'}`}>
                      {day.label}
                    </p>
                    <p className="mt-0.5 text-xs text-body">9am to 6pm · Remote · Live</p>
                    {countdown && (
                      <p className="mt-0.5 text-xs font-semibold text-[#B42318]">{countdown}</p>
                    )}
                  </div>
                  <span
                    className={`inline-flex shrink-0 items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] ${
                      stock.tone === 'soldout'
                        ? 'bg-stone-200 font-semibold text-stone-700'
                        : stock.tone === 'urgent'
                          ? 'bg-[#FDECEC] font-bold text-[#B42318]'
                          : 'bg-[#FDF6EC] font-medium text-[#854F0B]'
                    }`}
                  >
                    {stock.tone !== 'soldout' && <Users className="h-3 w-3" aria-hidden="true" />}
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

          {error && <p className="mt-4 text-sm font-medium text-danger">{error}</p>}

          <button
            type="button"
            onClick={handleContinue}
            disabled={!selected || submitting || selectable.length === 0}
            className="mt-7 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-[#EF9F27] px-6 py-3.5 text-sm font-semibold text-[#2C2C2A] shadow-[0_3px_12px_rgba(186,117,23,0.4)] transition-all hover:brightness-105 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {submitting ? 'Redirecting to secure checkout…' : 'Continue to payment'}
            {!submitting && <ArrowRight className="h-4 w-4" />}
          </button>
          <p className="mt-3 text-center text-[11px] text-muted">
            Secure payment via Stripe · Receipt emailed instantly · Bookings close at midnight the
            day before each class
          </p>
        </motion.div>
      </main>
      <LandingFooter />
    </div>
  );
}
