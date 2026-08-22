'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import { ArrowRight } from 'lucide-react';
import CoachingDayPicker, { useCoachingDays } from '@/components/commerce/CoachingDayPicker';
import { COMPLETE_UPGRADE_PRICE_LABEL } from '@/lib/commerce/plans';
import { COMPLETE_UPGRADE_PLAN } from '@/lib/commerce/upgrade';
import { trackEvent } from '@/lib/analytics';

interface UpgradeFlowProps {
  /** The account the purchase will be filed under — stated, never guessed at. */
  accountEmail: string;
}

/**
 * Buy the difference between Self-Study and Complete.
 *
 * The coaching day is chosen here rather than on the acquisition picker because
 * the upgrade buys one: it is the same product decision (a place in a class of
 * six), so it goes through the same component and the same soft hold.
 */
export default function UpgradeFlow({ accountEmail }: UpgradeFlowProps) {
  const { days, loadError, selectable } = useCoachingDays();
  const [selected, setSelected] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleUpgrade() {
    if (!selected || submitting) return;
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch('/api/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ plan: COMPLETE_UPGRADE_PLAN, coachingDay: selected }),
      });
      const data = (await res.json()) as { url?: string; error?: string };
      if (!res.ok || !data.url) {
        setError(data.error ?? 'Something went wrong — please try again.');
        setSubmitting(false);
        return;
      }
      // Awaited so the capture flushes before we leave for Stripe.
      await trackEvent('checkout_started', {
        plan: COMPLETE_UPGRADE_PLAN,
        coaching_day: selected,
      });
      window.location.assign(data.url);
    } catch {
      setError('Something went wrong — please try again.');
      setSubmitting(false);
    }
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
            onClick={handleUpgrade}
            disabled={!selected || submitting}
            className="cta-button mt-7 w-full px-6 py-4 text-base sm:w-auto"
          >
            {submitting
              ? 'Redirecting to secure checkout…'
              : `Upgrade — ${COMPLETE_UPGRADE_PRICE_LABEL}`}
            {!submitting && <ArrowRight className="h-4 w-4" />}
          </button>
          <p className="mt-3 text-[12px] text-muted">
            This purchase will be linked to <span className="font-medium text-heading">{accountEmail}</span>.
          </p>
          <p className="mt-1 text-[12px] text-muted">
            Secure payment via Stripe · Your Self-Study access and history carry over unchanged.
          </p>
        </>
      )}
    </motion.div>
  );
}
