'use client';

import { useState } from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { ArrowRight, Info } from 'lucide-react';
import { ACCESS_OPENS_LABEL, BOOK_A_CALL_URL } from '@/lib/commerce/plans';
import { Pill } from './editorial';

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
    labelSub: '200 stations',
    cells: [{ text: 'Unlimited' }, { text: 'Unlimited', sub: '£299 value' }, { text: 'Unlimited' }],
  },
  {
    label: 'On-demand Lectures',
    cells: [{ text: '', cross: true }, { text: '12 hours', sub: '£599 value' }, { text: '12 hours' }],
  },
  {
    label: 'Small-Group Coaching',
    cells: [
      { text: '', cross: true },
      { text: 'One full day, 9am to 6pm', sub: 'Max class of 6 · £599 value' },
      { text: 'One full day, 9am to 6pm' },
    ],
  },
  {
    label: '1:1 weekly coaching',
    cells: [{ text: '', cross: true }, { text: '', cross: true }, { text: '12 x 1hr sessions' }],
  },
];

/** The warm tint behind the highlighted (Complete) column. */
const HIGHLIGHT_BG = 'bg-[#FDF6E7]';

/** Kicks off Stripe checkout for the Self-Study plan (no coaching day needed). */
function useSelfStudyCheckout() {
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function start() {
    if (submitting) return;
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch('/api/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ plan: 'self_study' }),
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

  return { start, submitting, error };
}

function GuaranteeInfo({ align = 'left' }: { align?: 'left' | 'right' }) {
  return (
    <div className="group relative inline-flex items-center gap-1">
      <p className="text-[11px] font-medium text-[#27500A] sm:text-sm">SCA Guarantee</p>
      <button
        type="button"
        aria-label="About the SCA Guarantee: conditional on passing all 200 AI stations"
        title="Conditional guarantee: to qualify you must first pass all 200 AI stations."
        className="inline-flex shrink-0 items-center justify-center rounded-full text-[#27500A]/70 transition-colors hover:text-[#27500A] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#27500A]/40"
      >
        <Info className="h-3.5 w-3.5" aria-hidden="true" />
      </button>
      <div
        role="tooltip"
        className={`pointer-events-none absolute top-full z-20 mt-1 w-52 rounded-lg border border-heading/10 bg-white p-2.5 text-left text-[10px] leading-snug text-body opacity-0 shadow-elevation-3 transition-opacity duration-150 group-hover:opacity-100 group-focus-within:opacity-100 sm:text-[11px] ${
          align === 'right' ? 'right-0' : 'left-0'
        }`}
      >
        This is a <span className="font-medium text-[#27500A]">conditional</span> guarantee — to qualify
        you must first pass all 200 AI stations.
      </div>
    </div>
  );
}

interface CtaButtonsProps {
  selfStudy: ReturnType<typeof useSelfStudyCheckout>;
  variant: 'self_study' | 'complete' | 'intensive';
}

function PlanCta({ selfStudy, variant }: CtaButtonsProps) {
  if (variant === 'self_study') {
    return (
      <button
        type="button"
        onClick={selfStudy.start}
        disabled={selfStudy.submitting}
        className="w-full rounded-full border border-heading/15 bg-white px-2 py-3 text-[13px] font-semibold text-heading transition-colors hover:bg-surface-warm disabled:opacity-60 sm:py-2.5 sm:text-sm"
      >
        {selfStudy.submitting ? 'Redirecting…' : 'Pre-order now'}
      </button>
    );
  }
  if (variant === 'complete') {
    return (
      <Link
        href="/coaching-day"
        className="cta-button w-full gap-1.5 !rounded-full px-2 py-3.5 text-[13px] sm:py-3 sm:text-sm"
      >
        Choose your coaching day <ArrowRight className="h-3.5 w-3.5" />
      </Link>
    );
  }
  return (
    <a
      href={BOOK_A_CALL_URL}
      target="_blank"
      rel="noopener noreferrer"
      className="block w-full rounded-full border border-heading/15 bg-white px-2 py-3 text-center text-[13px] font-semibold text-heading transition-colors hover:bg-surface-warm sm:py-2.5 sm:text-sm"
    >
      Book a call
    </a>
  );
}

/** Mono uppercase plan name, per the editorial system. */
function PlanName({ children }: { children: React.ReactNode }) {
  return (
    <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-heading sm:text-[11px]">
      {children}
    </p>
  );
}

/** Mobile: one full-width card per plan, same content as its desktop column. */
function MobileCards({ selfStudy }: { selfStudy: ReturnType<typeof useSelfStudyCheckout> }) {
  const cards = [
    {
      key: 'self_study' as const,
      name: 'Self-Study',
      price: '£299',
      suffix: 'one-off',
      tagline: "3 months' access",
      highlighted: false,
      badge: null,
      valueLine: null,
      cellIndex: 0,
    },
    {
      key: 'complete' as const,
      name: 'Complete SCA Course',
      price: '£599',
      suffix: 'one-off',
      tagline: "3 months' access",
      highlighted: true,
      badge: 'Most popular',
      valueLine: '£1,497 total value',
      cellIndex: 1,
    },
    {
      key: 'intensive' as const,
      name: 'Intensive',
      price: 'From £2,999',
      suffix: '',
      tagline: 'By application',
      highlighted: false,
      badge: null,
      valueLine: null,
      cellIndex: 2,
    },
  ];

  return (
    <div className="flex flex-col gap-4 sm:hidden">
      {cards.map((card) => (
        <div
          key={card.key}
          className={`overflow-hidden rounded-3xl border shadow-elevation-2 backdrop-blur ${
            card.highlighted
              ? `border-primary/25 ${HIGHLIGHT_BG}`
              : 'border-heading/[0.06] bg-white/80'
          }`}
        >
          <div className="relative px-5 pb-4 pt-7 text-center">
            {card.badge && (
              <span className="absolute left-1/2 top-2 -translate-x-1/2 whitespace-nowrap rounded-full bg-primary px-2.5 py-0.5 font-mono text-[9px] uppercase tracking-[0.12em] text-white">
                {card.badge}
              </span>
            )}
            <PlanName>{card.name}</PlanName>
            <p className="mt-2 text-3xl font-medium tracking-tight text-heading">
              {card.price}{' '}
              {card.suffix && <span className="text-xs font-normal text-muted">{card.suffix}</span>}
            </p>
            <p className="mt-0.5 text-xs text-muted">{card.tagline}</p>
            {card.valueLine && (
              <p className="mt-0.5 text-xs text-muted line-through">{card.valueLine}</p>
            )}
          </div>

          <div className="border-t border-heading/[0.08]">
            {FEATURE_ROWS.map((row) => {
              const cell = row.cells[card.cellIndex];
              return (
                <div
                  key={row.label}
                  className="flex items-center justify-between gap-3 border-b border-heading/[0.06] px-5 py-3"
                >
                  <div>
                    <p className="text-[13px] font-medium text-heading">{row.label}</p>
                    {row.labelSub && <p className="text-[11px] text-muted">{row.labelSub}</p>}
                  </div>
                  <div className="text-right">
                    {cell.cross ? (
                      <span className="text-sm text-stone-300" aria-label="Not included">
                        —
                      </span>
                    ) : (
                      <>
                        <p className="text-[13px] font-medium text-heading">{cell.text}</p>
                        {cell.sub && <p className="text-[11px] text-muted">{cell.sub}</p>}
                      </>
                    )}
                  </div>
                </div>
              );
            })}

            {/* Guarantee row */}
            <div className="flex items-center justify-between gap-3 bg-[#EAF3DE] px-5 py-3.5">
              <GuaranteeInfo />
              <p className="text-right text-[11px] leading-snug text-[#27500A]">
                Don’t pass? We pay you £500
              </p>
            </div>
          </div>

          <div className="p-3">
            <PlanCta selfStudy={selfStudy} variant={card.key} />
          </div>
        </div>
      ))}
    </div>
  );
}

/** The three-tier pricing table: matrix on desktop, stacked cards on mobile. */
export default function PricingTable() {
  const selfStudy = useSelfStudyCheckout();

  return (
    <section id="pricing" className="scroll-mt-24 px-5 py-6 sm:px-8 sm:py-10">
      <div className="mx-auto max-w-5xl">
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-80px' }}
          transition={{ duration: 0.55, ease: 'easeOut' }}
        >
          <p className="mb-3 flex justify-center">
            <Pill>Choose your prep</Pill>
          </p>

          <p className="mb-6 flex justify-center">
            <span className="inline-flex items-center gap-2 rounded-full bg-[#FAEEDA] px-4 py-1.5 text-center text-xs font-semibold text-[#854F0B] sm:text-[13px]">
              <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-[#B45309]" aria-hidden="true" />
              Pre-order — AI practice &amp; lectures start {ACCESS_OPENS_LABEL}
            </span>
          </p>

          <MobileCards selfStudy={selfStudy} />

          <div className="hidden overflow-hidden rounded-3xl border border-heading/[0.06] bg-white/80 shadow-elevation-2 backdrop-blur sm:block">
            <div className="grid grid-cols-[minmax(84px,170px)_repeat(3,minmax(0,1fr))]">
              {/* Plan headers */}
              <div />
              <div className="px-3 pb-5 pt-9 text-center">
                <PlanName>Self-Study</PlanName>
                <p className="mt-2.5 text-lg font-medium tracking-tight text-heading sm:text-3xl">
                  £299 <span className="text-[10px] font-normal text-muted sm:text-xs">one-off</span>
                </p>
                <p className="mt-1 text-[10px] text-muted sm:text-xs">3 months&rsquo; access</p>
              </div>
              <div className={`relative ${HIGHLIGHT_BG} px-3 pb-5 pt-9 text-center`}>
                <span className="absolute left-1/2 top-3 -translate-x-1/2 whitespace-nowrap rounded-full bg-primary px-2.5 py-0.5 font-mono text-[9px] uppercase tracking-[0.12em] text-white sm:text-[10px]">
                  Most popular
                </span>
                <PlanName>Complete SCA Course</PlanName>
                <p className="mt-2.5 text-lg font-medium tracking-tight text-heading sm:text-3xl">
                  £599 <span className="text-[10px] font-normal text-muted sm:text-xs">one-off</span>
                </p>
                <p className="mt-1 text-[10px] text-muted sm:text-xs">
                  3 months&rsquo; access ·{' '}
                  <span className="line-through">£1,497 value</span>
                </p>
              </div>
              <div className="px-3 pb-5 pt-9 text-center">
                <PlanName>Intensive</PlanName>
                <p className="mt-2.5 text-base font-medium tracking-tight text-heading sm:text-2xl">
                  From £2,999
                </p>
                <p className="mt-1 text-[10px] text-muted sm:text-xs">By application</p>
              </div>

              {/* Feature rows — horizontal hairlines only, no column grid */}
              {FEATURE_ROWS.map((row) => (
                <div key={row.label} className="contents">
                  <div className="border-t border-heading/[0.06] py-4 pl-6 pr-3 sm:pl-8">
                    <p className="text-[11px] font-medium leading-tight text-heading sm:text-sm">
                      {row.label}
                    </p>
                    {row.labelSub && (
                      <p className="mt-0.5 text-[9px] text-muted sm:text-xs">{row.labelSub}</p>
                    )}
                  </div>
                  {row.cells.map((cell, i) => (
                    <div
                      key={i}
                      className={`flex flex-col items-center justify-center border-t border-heading/[0.06] px-2 py-4 text-center ${
                        i === 1 ? HIGHLIGHT_BG : ''
                      }`}
                    >
                      {cell.cross ? (
                        <span className="text-sm text-stone-300" aria-label="Not included">
                          —
                        </span>
                      ) : (
                        <>
                          <p className="text-[11px] font-medium text-heading sm:text-sm">
                            {cell.text}
                          </p>
                          {cell.sub && (
                            <p className="mt-0.5 text-[9px] text-muted sm:text-xs">{cell.sub}</p>
                          )}
                        </>
                      )}
                    </div>
                  ))}
                </div>
              ))}

              {/* CTA row */}
              <div className="border-t border-heading/[0.06]" />
              <div className="border-t border-heading/[0.06] px-4 py-4">
                <PlanCta selfStudy={selfStudy} variant="self_study" />
              </div>
              <div className={`border-t border-heading/[0.06] ${HIGHLIGHT_BG} px-4 py-4`}>
                <PlanCta selfStudy={selfStudy} variant="complete" />
              </div>
              <div className="border-t border-heading/[0.06] px-4 py-4">
                <PlanCta selfStudy={selfStudy} variant="intensive" />
              </div>

              {/* One guarantee strip for the whole table */}
              <div className="col-span-4 flex flex-wrap items-center justify-center gap-x-3 gap-y-1 bg-[#EAF3DE] px-6 py-3.5 text-center">
                <GuaranteeInfo />
                <p className="text-[11px] text-[#27500A] sm:text-xs">
                  Every plan — don&rsquo;t pass, and we pay you £500.
                </p>
              </div>
            </div>
          </div>

          {selfStudy.error && (
            <p className="mt-3 text-center text-sm font-medium text-danger">{selfStudy.error}</p>
          )}
        </motion.div>
      </div>
    </section>
  );
}
