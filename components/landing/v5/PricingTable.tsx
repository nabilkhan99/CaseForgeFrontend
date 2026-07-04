'use client';

import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { ArrowRight, X } from 'lucide-react';
import {
  BOOK_A_CALL_URL,
  PLANS,
  type IntakeAvailability,
  type Plan,
} from '@/lib/commerce/plans';
import IntakeModal from './IntakeModal';

function formatDeadline(iso: string | null): string | null {
  if (!iso) return null;
  return new Date(`${iso}T00:00:00`).toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'long',
  });
}

function formatMonthStart(iso: string): string {
  return new Date(`${iso}T00:00:00`).toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'long',
  });
}

interface FeatureCell {
  text: string;
  sub?: string;
  cross?: boolean;
}

interface FeatureRow {
  label: string;
  labelSub?: string;
  cells: [FeatureCell, FeatureCell, FeatureCell]; // self_study, complete, intensive
}

const FEATURE_ROWS: readonly FeatureRow[] = [
  {
    label: 'AI consultations',
    labelSub: '200 cases',
    cells: [{ text: 'Unlimited' }, { text: 'Unlimited', sub: '£199 value' }, { text: 'Unlimited' }],
  },
  {
    label: 'Half-day teaching',
    cells: [{ text: '', cross: true }, { text: '3 x 4hr sessions', sub: '£599 value' }, { text: '3 x 4hr sessions' }],
  },
  {
    label: 'Small-group coaching',
    cells: [
      { text: '', cross: true },
      { text: '3 x 3hr sessions', sub: 'Max class size 6 · £599 value' },
      { text: '3 x 3hr sessions' },
    ],
  },
  {
    label: '1:1 weekly coaching',
    cells: [{ text: '', cross: true }, { text: '', cross: true }, { text: '12 x 1hr sessions' }],
  },
];

const checkoutPlans = PLANS.filter((p) => p.cta === 'checkout');

/** The three-tier pricing comparison table with live seat availability. */
export default function PricingTable() {
  const [intakes, setIntakes] = useState<IntakeAvailability[]>([]);
  const [modalPlan, setModalPlan] = useState<Plan | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch('/api/intakes')
      .then((res) => (res.ok ? res.json() : Promise.reject(new Error(`HTTP ${res.status}`))))
      .then((data: { intakes: IntakeAvailability[] }) => {
        if (!cancelled) setIntakes(data.intakes ?? []);
      })
      .catch((error: unknown) => {
        // Table still renders without live seat counts.
        console.error('[pricing] failed to load intake availability', error);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const nextIntake = intakes.find((i) => i.status === 'open') ?? null;
  const nextDeadline = nextIntake ? formatDeadline(nextIntake.enrol_deadline) : null;
  const accessDate = nextIntake ? formatMonthStart(nextIntake.month) : '1 September';

  const scarcityLine = nextIntake
    ? nextIntake.seats_left <= 0
      ? `${nextIntake.label.split(' ')[0]} class full — next month open`
      : nextIntake.seats_left < nextIntake.capacity
        ? `Only ${nextIntake.seats_left} of ${nextIntake.capacity} places left for ${nextIntake.label.split(' ')[0]}`
        : `Only ${nextIntake.capacity} places per class`
    : 'Only 6 places per class';

  return (
    <section id="pricing" className="scroll-mt-24 px-5 py-6 sm:px-8 sm:py-10">
      <div className="mx-auto max-w-5xl">
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-80px' }}
          transition={{ duration: 0.55, ease: 'easeOut' }}
        >
          <p className="mb-2 text-center text-[11px] font-medium uppercase tracking-[0.08em] text-[#0F6E56] sm:text-xs">
            Choose your prep
          </p>

          <div className="overflow-hidden rounded-2xl border border-[#E4DDC9] bg-white shadow-elevation-2">
            <div className="grid grid-cols-[minmax(84px,150px)_repeat(3,minmax(0,1fr))]">
              {/* Plan headers */}
              <div />
              <div className="px-2 py-4 text-center sm:py-5">
                <p className="text-xs font-medium text-heading sm:text-sm">Self-Study</p>
                <p className="mt-1 text-lg font-medium text-heading sm:text-2xl">
                  £199 <span className="text-[10px] font-normal text-body sm:text-xs">one-off</span>
                </p>
                <p className="mt-0.5 text-[10px] text-body sm:text-xs">3-month access</p>
              </div>
              <div className="bg-[#E1F5EE] px-2 pb-3 pt-3 text-center sm:pt-4">
                <span className="mb-1.5 inline-block rounded-full bg-[#1D9E75] px-2.5 py-0.5 text-[9px] font-medium text-white sm:text-[10px]">
                  Most popular
                </span>
                <p className="text-xs font-medium text-[#085041] sm:text-sm">Complete</p>
                <p className="mt-1 text-lg font-medium text-[#085041] sm:text-2xl">
                  £599 <span className="text-[10px] font-normal text-[#0F6E56] sm:text-xs">one-off</span>
                </p>
                <p className="mt-0.5 text-[10px] text-[#0F6E56] sm:text-xs">3-month programme</p>
                <p className="mt-0.5 text-[10px] text-muted line-through sm:text-xs">£1,397 total value</p>
              </div>
              <div className="px-2 py-4 text-center sm:py-5">
                <p className="text-xs font-medium text-heading sm:text-sm">Intensive</p>
                <p className="mt-1 text-base font-medium text-heading sm:text-xl">From £2,999</p>
                <p className="mt-0.5 text-[10px] text-body sm:text-xs">By application</p>
              </div>

              {/* Feature rows */}
              {FEATURE_ROWS.map((row) => (
                <div key={row.label} className="contents">
                  <div className="border-t border-[#E4DDC9] px-2.5 py-3 sm:px-4">
                    <p className="text-[11px] font-medium leading-tight text-heading sm:text-sm">{row.label}</p>
                    {row.labelSub && <p className="mt-0.5 text-[9px] text-muted sm:text-xs">{row.labelSub}</p>}
                  </div>
                  {row.cells.map((cell, i) => (
                    <div
                      key={i}
                      className={`flex flex-col items-center justify-center border-l border-t border-[#E4DDC9] px-1.5 py-3 text-center ${
                        i === 1 ? 'bg-[#E1F5EE]' : ''
                      }`}
                    >
                      {cell.cross ? (
                        <X className="h-4 w-4 text-stone-300" aria-label="Not included" />
                      ) : (
                        <>
                          <p className={`text-[11px] font-medium sm:text-sm ${i === 1 ? 'text-[#085041]' : 'text-heading'}`}>
                            {cell.text}
                          </p>
                          {cell.sub && <p className="mt-0.5 text-[9px] text-[#0F6E56] sm:text-xs">{cell.sub}</p>}
                        </>
                      )}
                    </div>
                  ))}
                </div>
              ))}

              {/* Guarantee row */}
              <div className="border-t border-[#E4DDC9] bg-[#EAF3DE] px-2.5 py-3.5 sm:px-4">
                <p className="text-[11px] font-medium text-[#27500A] sm:text-sm">SCA guarantee</p>
              </div>
              {[0, 1, 2].map((i) => (
                <div key={i} className="border-l border-t border-[#E4DDC9] bg-[#EAF3DE] px-1.5 py-3.5 text-center">
                  <p className="text-[10px] leading-snug text-[#27500A] sm:text-xs">
                    Don’t pass?
                    <br />
                    We pay you £500
                  </p>
                </div>
              ))}

              {/* Availability row */}
              <div className="border-t border-[#E4DDC9]" />
              <div className="border-l border-t border-[#E4DDC9] px-1.5 pt-3 text-center">
                <p className="text-[10px] text-body sm:text-xs">Access from {accessDate}</p>
              </div>
              <div className="border-l border-t border-[#E4DDC9] bg-[#E1F5EE] px-1.5 pt-3 text-center">
                <p className="text-[10px] font-medium text-[#854F0B] sm:text-xs">{scarcityLine}</p>
                {nextDeadline && <p className="mt-0.5 text-[9px] text-[#0F6E56] sm:text-xs">Enrol by {nextDeadline}</p>}
              </div>
              <div className="border-l border-t border-[#E4DDC9] px-1.5 pt-3 text-center">
                <p className="text-[10px] text-body sm:text-xs">Apply anytime</p>
              </div>

              {/* CTA row */}
              <div />
              <div className="p-1.5 text-center sm:p-2.5">
                <button
                  type="button"
                  onClick={() => setModalPlan(checkoutPlans[0])}
                  className="w-full rounded-lg border border-stone-300 px-2 py-2.5 text-[10px] font-medium text-heading transition-colors hover:bg-surface-warm sm:text-sm"
                >
                  Pre-order now
                </button>
              </div>
              <div className="bg-[#E1F5EE] p-1.5 text-center sm:p-2.5">
                <button
                  type="button"
                  onClick={() => setModalPlan(checkoutPlans[1])}
                  className="inline-flex w-full items-center justify-center gap-1.5 rounded-lg bg-[#EF9F27] px-2 py-2.5 text-[10px] font-semibold text-[#2C2C2A] shadow-[0_2px_6px_rgba(186,117,23,0.4)] transition-all hover:brightness-105 sm:text-sm"
                >
                  Join next intake <ArrowRight className="h-3.5 w-3.5" />
                </button>
              </div>
              <div className="p-1.5 text-center sm:p-2.5">
                <a
                  href={BOOK_A_CALL_URL}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="block w-full rounded-lg border border-stone-300 px-2 py-2.5 text-[10px] font-medium text-heading transition-colors hover:bg-surface-warm sm:text-sm"
                >
                  Book a call
                </a>
              </div>

              {/* Footnote row inside highlighted column */}
              <div className="pb-3" />
              <div className="pb-3" />
              <div className="bg-[#E1F5EE] px-2 pb-3 text-center">
                <p className="text-[9px] leading-relaxed text-[#0F6E56] sm:text-[11px]">
                  Access opens {accessDate} · Prefer a later start? Choose your month at checkout
                </p>
              </div>
              <div className="pb-3" />
            </div>
          </div>

          <p className="mt-4 text-center text-[10px] text-muted sm:text-xs">
            Pass all 200 cases to qualify for the SCA guarantee.
          </p>
          <p className="mt-1 text-center text-[10px] text-muted sm:text-xs">
            Each month of Complete includes one half-day teaching session and one small-group coaching
            session, alongside unlimited AI practice throughout.
          </p>
        </motion.div>
      </div>

      {modalPlan && (
        <IntakeModal plan={modalPlan} intakes={intakes} onClose={() => setModalPlan(null)} />
      )}
    </section>
  );
}
