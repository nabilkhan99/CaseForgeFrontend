'use client';

import { useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { ArrowRight, X } from 'lucide-react';
import type { IntakeAvailability, Plan } from '@/lib/commerce/plans';

interface IntakeModalProps {
  plan: Plan;
  intakes: IntakeAvailability[];
  onClose: () => void;
}

function formatDeadline(iso: string | null): string | null {
  if (!iso) return null;
  const date = new Date(`${iso}T00:00:00`);
  return date.toLocaleDateString('en-GB', { day: 'numeric', month: 'long' });
}

/** Month picker shown between clicking a plan CTA and Stripe Checkout. */
export default function IntakeModal({ plan, intakes, onClose }: IntakeModalProps) {
  const capacityLimited = plan.key === 'complete';
  const selectable = intakes.filter(
    (i) => i.status === 'open' && (!capacityLimited || i.seats_left > 0),
  );
  const [selected, setSelected] = useState<string | null>(selectable[0]?.month ?? null);
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
        body: JSON.stringify({ plan: plan.key, intakeMonth: selected }),
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
    <AnimatePresence>
      <motion.div
        className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 backdrop-blur-sm p-0 sm:p-6"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
      >
        <motion.div
          role="dialog"
          aria-modal="true"
          aria-label={`Choose your intake month for ${plan.name}`}
          className="w-full sm:max-w-md rounded-t-3xl sm:rounded-3xl bg-surface-raised p-6 sm:p-8 shadow-elevation-4"
          initial={{ y: 40, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: 40, opacity: 0 }}
          transition={{ type: 'spring', damping: 28, stiffness: 320 }}
          onClick={(e) => e.stopPropagation()}
        >
          <div className="mb-5 flex items-start justify-between gap-4">
            <div>
              <p className="text-[11px] font-medium uppercase tracking-[0.08em] text-[#854F0B]">
                {plan.name} · {plan.displayPrice} {plan.priceSuffix}
              </p>
              <h3 className="mt-1 text-xl font-semibold text-heading">Choose your intake month</h3>
              <p className="mt-1 text-sm text-body">
                Your access opens on the 1st of your intake month.
              </p>
            </div>
            <button
              type="button"
              onClick={onClose}
              aria-label="Close"
              className="rounded-full p-2 text-muted transition-colors hover:bg-surface-warm hover:text-heading"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          <div className="flex flex-col gap-2.5">
            {intakes.map((intake) => {
              const soldOut = capacityLimited && intake.seats_left <= 0;
              const closed = intake.status !== 'open';
              const disabled = soldOut || closed;
              const isSelected = selected === intake.month;
              const deadline = formatDeadline(intake.enrol_deadline);
              return (
                <button
                  key={intake.month}
                  type="button"
                  disabled={disabled}
                  onClick={() => setSelected(intake.month)}
                  className={`flex items-center justify-between rounded-xl border px-4 py-3.5 text-left transition-all ${
                    isSelected
                      ? 'border-primary bg-[#FDF6EC] shadow-elevation-1'
                      : disabled
                        ? 'border-stone-200 bg-stone-50 opacity-55'
                        : 'border-stone-200 bg-white hover:border-stone-300'
                  }`}
                >
                  <div>
                    <p className="text-sm font-semibold text-heading">{intake.label}</p>
                    <p className="mt-0.5 text-xs text-body">
                      {closed
                        ? 'Enrolment closed'
                        : soldOut
                          ? 'Class full'
                          : deadline
                            ? `Enrol by ${deadline}`
                            : 'Open for enrolment'}
                    </p>
                  </div>
                  {capacityLimited && !disabled && (
                    <span
                      className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${
                        intake.seats_left <= 2
                          ? 'bg-[#FDECEC] text-[#B42318]'
                          : 'bg-[#E1F5EE] text-[#0F6E56]'
                      }`}
                    >
                      {intake.seats_left} of {intake.capacity} places left
                    </span>
                  )}
                </button>
              );
            })}
          </div>

          {error && <p className="mt-4 text-sm font-medium text-danger">{error}</p>}

          <button
            type="button"
            onClick={handleContinue}
            disabled={!selected || submitting}
            className="mt-6 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-[#EF9F27] px-6 py-3.5 text-sm font-semibold text-[#2C2C2A] shadow-[0_3px_12px_rgba(186,117,23,0.4)] transition-all hover:brightness-105 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {submitting ? 'Redirecting to secure checkout…' : 'Continue to payment'}
            {!submitting && <ArrowRight className="h-4 w-4" />}
          </button>
          <p className="mt-3 text-center text-[11px] text-muted">
            Secure payment via Stripe · Receipt emailed instantly
          </p>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
