'use client';

import { useState } from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { ArrowLeft, ArrowRight, CalendarClock } from 'lucide-react';
import LandingNavbar from '@/components/landing/LandingNavbar';
import LandingFooter from '@/components/landing/LandingFooter';
import CoachingDayPicker, { useCoachingDays } from '@/components/commerce/CoachingDayPicker';
import { ACCESS_OPENS_LABEL } from '@/lib/commerce/plans';
import { trackEvent } from '@/lib/analytics';

/**
 * The coaching day picker: the single place where scarcity and timing render.
 * Reached from the Complete plan's "Choose your coaching day" CTA.
 */
export default function CoachingDayPage() {
  const { days, loadError, selectable } = useCoachingDays();
  const [selected, setSelected] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

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
      // Awaited so the capture flushes before we leave for Stripe.
      await trackEvent('checkout_started', { plan: 'complete', coaching_day: selected });
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
            Pre-order · Complete SCA Course · £599 for 3 months
          </p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight text-heading sm:text-4xl">
            Choose your coaching day
          </h1>
          <p className="mt-3 max-w-lg text-sm leading-relaxed text-body sm:text-base">
            One full day of live Small-Group Coaching, 9am to 5pm, remote, with a maximum class of
            six. It runs on the date you choose below.
          </p>
          <p className="mt-3 inline-flex max-w-lg rounded-lg bg-[#FDF6EC] px-3 py-1.5 text-[12px] font-medium leading-relaxed text-[#854F0B]">
            This is a pre-order: your AI practice and on-demand lectures start{' '}
            {ACCESS_OPENS_LABEL}, and your 3 months run from that date.
          </p>

          <div className="mt-8">
            <CoachingDayPicker
              days={days}
              loadError={loadError}
              selected={selected}
              onSelect={setSelected}
            />
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
