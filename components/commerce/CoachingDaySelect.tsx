'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import { ArrowRight } from 'lucide-react';
import CoachingDayPicker, { useCoachingDays } from '@/components/commerce/CoachingDayPicker';
import { trackEvent } from '@/lib/analytics';

interface CoachingDaySelectProps {
  /** The account the booking attaches to — stated, never guessed at. */
  accountEmail: string;
}

/**
 * Book the coaching day after the fact.
 *
 * A Complete bought at checkout picks its day before paying. A Complete
 * *upgraded* to through the Stripe Customer Portal cannot — Stripe's page knows
 * nothing about the class — so the day is chosen here instead, through the same
 * picker, against the same availability, so scarcity and cut-offs cannot drift
 * between the two routes in.
 */
export default function CoachingDaySelect({ accountEmail }: CoachingDaySelectProps) {
  const { days, loadError, selectable } = useCoachingDays();
  const [selected, setSelected] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [booked, setBooked] = useState<string | null>(null);

  async function handleBook() {
    if (!selected || submitting) return;
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch('/api/coaching-day/select', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ coachingDay: selected }),
      });
      const data = (await res.json()) as { label?: string; error?: string };
      if (!res.ok || !data.label) {
        setError(data.error ?? 'Something went wrong — please try again.');
        setSubmitting(false);
        return;
      }
      await trackEvent('coaching_day_booked', { coaching_day: selected });
      setBooked(data.label);
      setSubmitting(false);
    } catch {
      setError('Something went wrong — please try again.');
      setSubmitting(false);
    }
  }

  if (booked) {
    return (
      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
        <p className="text-[15px] font-semibold text-heading">Your coaching day is booked.</p>
        <p className="mt-1 text-[13px] leading-[1.65] text-muted">
          {booked} &mdash; 9am to 5pm, remote, maximum class of six. We&rsquo;ll email the joining
          details nearer the time.
        </p>
      </motion.div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ type: 'spring', stiffness: 80, damping: 20, delay: 0.12 }}
    >
      <div className="text-[10px] font-semibold text-muted uppercase tracking-[0.1em] mb-4">
        Choose your coaching day
      </div>
      <p className="text-[13px] leading-[1.65] text-muted mb-5 max-w-xl">
        One full day of live Small-Group Coaching, 9am to 5pm, remote, with a maximum class of six.
        It runs on the date you choose.
      </p>

      <CoachingDayPicker
        days={days}
        loadError={loadError}
        selected={selected}
        onSelect={setSelected}
      />

      {error && (
        <p role="alert" className="mt-4 text-[13px] font-medium text-danger">
          {error}
        </p>
      )}

      {selectable.length > 0 && (
        <>
          <button
            type="button"
            onClick={handleBook}
            disabled={!selected || submitting}
            className="cta-button mt-7 w-full px-6 py-4 text-base sm:w-auto"
          >
            {submitting ? 'Booking your place…' : 'Book this coaching day'}
            {!submitting && <ArrowRight className="h-4 w-4" />}
          </button>
          <p className="mt-3 text-[12px] text-muted">
            This booking will be linked to{' '}
            <span className="font-medium text-heading">{accountEmail}</span>.
          </p>
          <p className="mt-1 text-[12px] text-muted">
            Nothing more to pay &mdash; the coaching day is part of Complete.
          </p>
        </>
      )}
    </motion.div>
  );
}
