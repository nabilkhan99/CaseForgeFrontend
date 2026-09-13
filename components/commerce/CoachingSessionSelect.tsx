'use client';

import { useCallback, useEffect, useState } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { ArrowRight } from 'lucide-react';
import CoachingSessionPicker, {
  useCoachingSessions,
  type CoachingSlotSelection,
} from '@/components/commerce/CoachingSessionPicker';
import { isSelectionOpen } from '@/lib/commerce/coachingPicker';
import { trackEvent } from '@/lib/analytics';

const GENERIC_ERROR = 'Something went wrong, please try again.';
const SLOT_GONE_ERROR = 'That session is no longer available. Please choose another date or time.';

interface CoachingSessionSelectProps {
  /** The account the booking attaches to: stated, never guessed at. */
  accountEmail: string;
}

/**
 * Book the coaching session after the fact.
 *
 * A Complete bought at checkout picks its date and time before paying. A
 * Complete upgraded to through the Stripe Customer Portal cannot, because
 * Stripe's page knows nothing about coaching slots, so the session is chosen
 * here instead, through the same picker, against the same availability, so
 * month counts and cut-offs cannot drift between the two routes in.
 */
export default function CoachingSessionSelect({ accountEmail }: CoachingSessionSelectProps) {
  const reduceMotion = useReducedMotion() ?? false;
  const { slots, loadError, reload, hasSelectable } = useCoachingSessions();
  const [selected, setSelected] = useState<CoachingSlotSelection | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [bookedLabel, setBookedLabel] = useState<string | null>(null);

  // A refetch can take the chosen slot away; never book something that has gone.
  useEffect(() => {
    if (selected && slots && !isSelectionOpen(slots, selected)) setSelected(null);
  }, [slots, selected]);

  const handleSelect = useCallback((selection: CoachingSlotSelection) => {
    setSelected(selection);
    setError(null);
  }, []);

  async function handleBook() {
    if (!selected || submitting) return;
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch('/api/coaching-session/select', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ coachingDate: selected.day, coachingSlot: selected.slot }),
      });
      const data = (await res.json().catch(() => ({}))) as {
        label?: unknown;
        error?: unknown;
        code?: unknown;
      };
      const message = typeof data.error === 'string' && data.error ? data.error : null;

      if (res.status === 409 && (data.code === 'slot_taken' || data.code === 'slot_closed')) {
        setError(message ?? SLOT_GONE_ERROR);
        setSelected(null);
        setSubmitting(false);
        void reload();
        return;
      }
      if (!res.ok || typeof data.label !== 'string') {
        // 401/403 and already_booked carry their own explanation.
        setError(message ?? GENERIC_ERROR);
        setSubmitting(false);
        return;
      }
      await trackEvent('coaching_session_booked', {
        coaching_date: selected.day,
        coaching_slot: selected.slot,
      });
      setBookedLabel(data.label);
      setSubmitting(false);
    } catch {
      setError(GENERIC_ERROR);
      setSubmitting(false);
    }
  }

  const enter = reduceMotion ? false : { opacity: 0, y: 8 };
  const instant = { duration: 0 };

  return (
    <AnimatePresence mode="wait" initial={false}>
      {bookedLabel ? (
        <motion.div
          key="booked"
          initial={enter}
          animate={{ opacity: 1, y: 0 }}
          transition={reduceMotion ? instant : { type: 'spring', stiffness: 120, damping: 20 }}
          role="status"
        >
          <p className="text-[15px] font-semibold text-heading">Your coaching session is booked.</p>
          <p className="mt-1 text-[13px] leading-[1.65] text-muted">
            {bookedLabel}. We&rsquo;ll email your joining details nearer the time.
          </p>
        </motion.div>
      ) : (
        <motion.div
          key="choose"
          initial={enter}
          animate={{ opacity: 1, y: 0 }}
          exit={reduceMotion ? { opacity: 0, transition: instant } : { opacity: 0, y: -8 }}
          transition={reduceMotion ? instant : { type: 'spring', stiffness: 80, damping: 20, delay: 0.12 }}
        >
          <div className="mb-4 text-[10px] font-semibold uppercase tracking-[0.1em] text-muted">
            Choose your coaching date
          </div>
          <p className="mb-5 max-w-xl text-[13px] leading-[1.65] text-muted">
            Remote, just you and your coach. 6 timed stations back to back, then feedback on each
            one and a review of your AI dashboard. All sessions run at weekends. Weekday sessions
            can be arranged on request, with 3 weeks notice.
          </p>

          <CoachingSessionPicker
            slots={slots}
            loadError={loadError}
            selected={selected}
            onSelect={handleSelect}
            disabled={submitting}
          />

          {error && (
            <p role="alert" className="mt-4 text-[13px] font-medium text-danger">
              {error}
            </p>
          )}

          {hasSelectable && (
            <>
              <button
                type="button"
                onClick={handleBook}
                disabled={!selected || submitting}
                className="cta-button mt-7 w-full px-6 py-4 text-base sm:w-auto"
              >
                {submitting ? 'Booking your session…' : 'Book this session'}
                {!submitting && <ArrowRight className="h-4 w-4" />}
              </button>
              <p className="mt-3 text-[12px] text-muted">
                This booking will be linked to{' '}
                <span className="font-medium text-heading">{accountEmail}</span>.
              </p>
              <p className="mt-1 text-[12px] text-muted">
                Nothing more to pay, the coaching session is part of Complete.
              </p>
            </>
          )}
        </motion.div>
      )}
    </AnimatePresence>
  );
}
