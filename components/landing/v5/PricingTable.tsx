'use client';

import { useState } from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { ArrowRight, Check, Info, X } from 'lucide-react';
import { ACCESS_OPENS_LABEL, BOOK_A_CALL_URL } from '@/lib/commerce/plans';
import { Pill } from './editorial';

/**
 * v5 pricing content as Confetto-style plan cards — every feature cell,
 * value line, CTA and the guarantee row preserved; checkout logic intact.
 */

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

interface Include {
  label: string;
  value?: string;
  sub?: string;
  excluded?: boolean;
}

interface Plan {
  key: 'self_study' | 'complete' | 'intensive';
  name: string;
  price: string;
  note?: string;
  tagline: string;
  valueLine?: string;
  badge?: string;
  highlighted?: boolean;
  includes: Include[];
}

const PLANS: Plan[] = [
  {
    key: 'self_study',
    name: 'Self-Study',
    price: '£299',
    note: 'one-off',
    tagline: "3 months' access",
    includes: [
      { label: 'AI consultations', value: 'Unlimited', sub: '200 stations' },
      { label: 'On-demand Lectures', excluded: true },
      { label: 'Small-Group Coaching', excluded: true },
      { label: '1:1 weekly coaching', excluded: true },
    ],
  },
  {
    key: 'complete',
    name: 'Complete SCA Course',
    price: '£599',
    note: 'one-off',
    tagline: "3 months' access",
    valueLine: '£1,497 total value',
    badge: 'Most popular',
    highlighted: true,
    includes: [
      { label: 'AI consultations', value: 'Unlimited', sub: '£299 value' },
      { label: 'On-demand Lectures', value: '12 hours', sub: '£599 value' },
      { label: 'Small-Group Coaching', value: 'One full day, 9am to 6pm', sub: 'Max class of 6 · £599 value' },
      { label: '1:1 weekly coaching', excluded: true },
    ],
  },
  {
    key: 'intensive',
    name: 'Intensive',
    price: 'From £2,999',
    tagline: 'By application',
    includes: [
      { label: 'AI consultations', value: 'Unlimited', sub: '200 stations' },
      { label: 'On-demand Lectures', value: '12 hours' },
      { label: 'Small-Group Coaching', value: 'One full day, 9am to 6pm' },
      { label: '1:1 weekly coaching', value: '12 x 1hr sessions' },
    ],
  },
];

function GuaranteeLine() {
  return (
    <div className="flex items-center justify-between gap-3 rounded-xl bg-[#EAF3DE] px-4 py-3">
      <div className="group relative inline-flex items-center gap-1">
        <p className="text-[11px] font-medium text-[#27500A] sm:text-xs">SCA Guarantee</p>
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
          className="pointer-events-none absolute bottom-full left-0 z-20 mb-1.5 w-52 rounded-lg border border-heading/10 bg-white p-2.5 text-left text-[10px] leading-snug text-body opacity-0 shadow-elevation-3 transition-opacity duration-150 group-hover:opacity-100 group-focus-within:opacity-100 sm:text-[11px]"
        >
          This is a <span className="font-medium text-[#27500A]">conditional</span> guarantee — to
          qualify you must first pass all 200 AI stations.
        </div>
      </div>
      <p className="text-right text-[11px] leading-snug text-[#27500A]">
        Don’t pass?
        <br />
        We pay you £500
      </p>
    </div>
  );
}

function PlanCta({
  plan,
  selfStudy,
}: {
  plan: Plan;
  selfStudy: ReturnType<typeof useSelfStudyCheckout>;
}) {
  if (plan.key === 'complete') {
    return (
      <Link href="/coaching-day" className="primary-button w-full justify-center !rounded-full text-sm">
        Choose your coaching day <ArrowRight className="h-4 w-4" aria-hidden="true" />
      </Link>
    );
  }
  if (plan.key === 'self_study') {
    return (
      <button
        type="button"
        onClick={selfStudy.start}
        disabled={selfStudy.submitting}
        className="w-full rounded-full border border-heading/15 bg-white px-6 py-3 text-sm font-medium text-heading transition-colors hover:bg-surface-warm disabled:opacity-60"
      >
        {selfStudy.submitting ? 'Redirecting…' : 'Pre-order now'}
      </button>
    );
  }
  return (
    <a
      href={BOOK_A_CALL_URL}
      target="_blank"
      rel="noopener noreferrer"
      className="block w-full rounded-full border border-heading/15 bg-white px-6 py-3 text-center text-sm font-medium text-heading transition-colors hover:bg-surface-warm"
    >
      Book a call
    </a>
  );
}

/** The three-tier pricing table as Confetto-style plan cards. */
export default function PricingTable() {
  const selfStudy = useSelfStudyCheckout();

  return (
    <section id="pricing" className="scroll-mt-24 px-5 py-10 sm:px-8 sm:py-16">
      <div className="mx-auto max-w-6xl">
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-80px' }}
          transition={{ duration: 0.55, ease: 'easeOut' }}
        >
          <div className="text-center">
            <Pill>Choose your prep</Pill>
          </div>

          <p className="mt-5 flex justify-center">
            <span className="inline-flex items-center gap-2 rounded-full bg-[#FAEEDA] px-4 py-1.5 text-center text-xs font-semibold text-[#854F0B] sm:text-[13px]">
              <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-[#B45309]" aria-hidden="true" />
              Pre-order — everything starts {ACCESS_OPENS_LABEL}
            </span>
          </p>

          <div className="mt-10 grid grid-cols-1 gap-5 sm:mt-12 sm:gap-6 lg:grid-cols-3">
            {PLANS.map((plan) => (
              <div
                key={plan.key}
                className={`relative flex flex-col rounded-3xl border p-7 shadow-elevation-2 backdrop-blur sm:p-8 ${
                  plan.highlighted
                    ? 'border-primary/25 bg-[#FDF6E7]'
                    : 'border-heading/[0.06] bg-white/80'
                }`}
              >
                {plan.badge && (
                  <span className="absolute -top-3 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-full bg-primary px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-white">
                    {plan.badge}
                  </span>
                )}

                <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-heading">
                  {plan.name}
                </p>
                <p className="mt-4 text-4xl font-medium tracking-tight text-heading">
                  {plan.price}{' '}
                  {plan.note && <span className="text-sm font-normal text-muted">{plan.note}</span>}
                </p>
                <p className="mt-1 text-sm text-muted">{plan.tagline}</p>
                {plan.valueLine && (
                  <p className="mt-0.5 text-sm text-muted line-through">{plan.valueLine}</p>
                )}

                <div className="mt-7 flex flex-1 flex-col gap-3.5 border-t border-heading/[0.08] pt-6">
                  {plan.includes.map((inc) => (
                    <div key={inc.label} className="flex items-start gap-3">
                      {inc.excluded ? (
                        <X className="mt-0.5 h-4 w-4 flex-shrink-0 text-stone-300" aria-label="Not included" />
                      ) : (
                        <Check className="mt-0.5 h-4 w-4 flex-shrink-0 text-primary" aria-hidden="true" />
                      )}
                      <div className="min-w-0">
                        <p className={`text-sm leading-snug ${inc.excluded ? 'text-muted' : 'font-medium text-heading'}`}>
                          {inc.label}
                          {inc.value && <span className="font-normal text-body"> — {inc.value}</span>}
                        </p>
                        {inc.sub && <p className="mt-0.5 text-xs text-muted">{inc.sub}</p>}
                      </div>
                    </div>
                  ))}
                </div>

                <div className="mt-7">
                  <GuaranteeLine />
                </div>

                <div className="mt-5">
                  <PlanCta plan={plan} selfStudy={selfStudy} />
                </div>
              </div>
            ))}
          </div>

          {selfStudy.error && (
            <p className="mt-4 text-center text-sm font-medium text-danger">{selfStudy.error}</p>
          )}
        </motion.div>
      </div>
    </section>
  );
}
