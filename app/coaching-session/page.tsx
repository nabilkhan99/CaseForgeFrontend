'use client';

import { Suspense, useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { motion, useReducedMotion } from 'framer-motion';
import { ArrowLeft, ArrowRight, CalendarClock } from 'lucide-react';
import LandingNavbar from '@/components/landing/LandingNavbar';
import LandingFooter from '@/components/landing/LandingFooter';
import CoachingSessionPicker, {
  useCoachingSessions,
  type CoachingSlotSelection,
} from '@/components/commerce/CoachingSessionPicker';
import { isSelectionOpen } from '@/lib/commerce/coachingPicker';
import { trackEvent } from '@/lib/analytics';

const GENERIC_ERROR = 'Something went wrong, please try again.';
const SLOT_GONE_ERROR = 'That session is no longer available. Please choose another date or time.';

/** Hold ids are opaque to this page; this only keeps junk out of the request body. */
const HOLD_ID_PATTERN = /^[A-Za-z0-9_-]{1,128}$/;

/**
 * The coaching session picker: the single place where scarcity and timing
 * render. Reached from the Complete plan's CTA, and again from Stripe's
 * cancel_url when a buyer backs out of payment.
 */
export default function CoachingSessionPage() {
  const reduceMotion = useReducedMotion() ?? false;
  const { slots, loadError, reload, hasSelectable } = useCoachingSessions();
  const [selected, setSelected] = useState<CoachingSlotSelection | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // A refetch can take the chosen slot away (someone else paid for it, or its
  // cut-off passed), so a selection that can no longer be booked is dropped
  // rather than carried into checkout.
  useEffect(() => {
    if (selected && slots && !isSelectionOpen(slots, selected)) setSelected(null);
  }, [slots, selected]);

  const handleSelect = useCallback((selection: CoachingSlotSelection) => {
    setSelected(selection);
    setError(null);
  }, []);

  async function handleContinue() {
    if (!selected || submitting) return;
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch('/api/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          plan: 'complete',
          coachingDate: selected.day,
          coachingSlot: selected.slot,
        }),
      });
      const data = (await res.json().catch(() => ({}))) as { url?: unknown; error?: unknown };
      const message = typeof data.error === 'string' && data.error ? data.error : null;

      if (res.status === 409) {
        // slot_taken or slot_closed: someone got there first, or the cut-off
        // passed while the page was open. Show why, then the live picture.
        setError(message ?? SLOT_GONE_ERROR);
        setSelected(null);
        setSubmitting(false);
        void reload();
        return;
      }
      if (!res.ok || typeof data.url !== 'string') {
        setError(message ?? GENERIC_ERROR);
        setSubmitting(false);
        return;
      }
      // Awaited so the capture flushes before we leave for Stripe.
      await trackEvent('checkout_started', {
        plan: 'complete',
        coaching_date: selected.day,
        coaching_slot: selected.slot,
      });
      window.location.assign(data.url);
    } catch {
      setError(GENERIC_ERROR);
      setSubmitting(false);
    }
  }

  return (
    <div className="min-h-[100dvh] bg-[#F7F2E7] font-sans">
      <LandingNavbar user={null} />
      <Suspense fallback={null}>
        <ReleaseReturnedHold onReleased={reload} />
      </Suspense>
      <main className="mx-auto max-w-2xl px-5 pb-24 pt-28 sm:px-8 sm:pt-36">
        <motion.div
          initial={reduceMotion ? false : { opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={reduceMotion ? { duration: 0 } : { duration: 0.45, ease: 'easeOut' }}
        >
          <Link
            href="/#pricing"
            className="inline-flex min-h-[44px] items-center gap-1.5 text-sm text-muted transition-colors hover:text-heading"
          >
            <ArrowLeft className="h-4 w-4" /> Back to plans
          </Link>

          <p className="mt-4 text-[11px] font-medium uppercase tracking-[0.08em] text-[#854F0B] sm:text-xs">
            Complete SCA Course · £599 one-off
          </p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight text-heading sm:text-4xl">
            Choose your coaching date
          </h1>
          <p className="mt-3 max-w-lg text-sm leading-relaxed text-body sm:text-base">
            A 3 hour one to one coaching session, remote, just you and your coach. 6 timed stations
            back to back, then feedback on each one and a review of your AI dashboard. Choose your
            date and time below.
          </p>
          <p className="mt-3 inline-flex max-w-lg rounded-lg bg-[#FDF6EC] px-3 py-1.5 text-[12px] font-medium leading-relaxed text-[#854F0B]">
            Your AI practice and on-demand lectures start the moment you buy, and your 3 months
            run from today.
          </p>

          <p className="mt-8 text-sm leading-relaxed text-body">
            All sessions run at weekends. Weekday sessions can be arranged on request, with 3 weeks
            notice.
          </p>
          <div className="mt-5">
            <CoachingSessionPicker
              slots={slots}
              loadError={loadError}
              selected={selected}
              onSelect={handleSelect}
              disabled={submitting}
            />
          </div>

          {/* Jan to Aug 2027: no fixed coaching dates yet, so buying still opens
              access immediately and a later start is arranged by email. */}
          <div className="mt-8 rounded-xl border border-dashed border-[#D8C7A8] bg-[#FCF7EE] px-4 py-4">
            <p className="flex items-center gap-2 text-sm font-semibold text-heading">
              <CalendarClock className="h-4 w-4 shrink-0 text-[#854F0B]" aria-hidden="true" />
              Sitting your SCA in Jan to Aug 2027?
            </p>
            <p className="mt-2 text-xs leading-relaxed text-body sm:text-sm">
              Dates for that window aren&rsquo;t fixed yet, but you can buy now and start straight
              away. Your AI practice and on-demand lectures open the moment you pay, and your 3
              months run from that date.
            </p>
            <p className="mt-2 text-xs leading-relaxed text-body sm:text-sm">
              If your exam is further out and you&rsquo;d rather your 3 months started nearer to it,
              email{' '}
              <a
                href="mailto:hello@fourteenfisherman.com?subject=Coaching%20session%2C%20Jan%20to%20Aug%202027"
                className="font-medium text-primary underline"
              >
                hello@fourteenfisherman.com
              </a>{' '}
              and we&rsquo;ll set a start date that suits you and arrange your coaching session at
              the same time.
            </p>
          </div>

          {error && (
            <motion.p
              role="alert"
              initial={reduceMotion ? false : { opacity: 0, y: -4 }}
              animate={{ opacity: 1, y: 0 }}
              className="mt-4 text-sm font-medium text-danger"
            >
              {error}
            </motion.p>
          )}

          {hasSelectable && (
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
                the day before each date
              </p>
            </>
          )}
        </motion.div>
      </main>
      <LandingFooter />
    </div>
  );
}

/**
 * Stripe's cancel_url brings a buyer back as `/coaching-session?release=<holdId>`.
 * Their checkout was holding a slot; releasing it straight away puts the slot
 * back on sale (for them too) instead of leaving it held until the Stripe
 * session expires. Then the picker refetches, and the param comes off the URL
 * so a refresh cannot release anything twice.
 *
 * Its own component under a Suspense boundary because `useSearchParams` would
 * otherwise opt the whole page out of static rendering.
 */
function ReleaseReturnedHold({ onReleased }: { onReleased: () => Promise<void> }) {
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const holdId = searchParams?.get('release') ?? null;
  // Strict Mode runs effects twice; one hold is released once.
  const handled = useRef<string | null>(null);

  useEffect(() => {
    if (holdId === null || handled.current === holdId) return;
    handled.current = holdId;

    const remaining = new URLSearchParams(searchParams?.toString() ?? '');
    remaining.delete('release');
    const query = remaining.toString();
    const cleanUrl = query ? `${pathname}?${query}` : pathname;

    void (async () => {
      if (HOLD_ID_PATTERN.test(holdId)) {
        // Silent to the buyer either way: an unreleased hold still lapses with
        // its Stripe session, so there is nothing for them to do about it.
        try {
          const res = await fetch('/api/checkout/release', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ holdId }),
          });
          if (!res.ok) console.warn('[coaching-session] hold release refused', res.status);
        } catch (error) {
          console.warn('[coaching-session] hold release failed', error);
        }
      }
      await onReleased();
      router.replace(cleanUrl, { scroll: false });
    })();
  }, [holdId, onReleased, pathname, router, searchParams]);

  return null;
}
