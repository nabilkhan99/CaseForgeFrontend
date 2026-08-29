'use client';

import { useEffect, useId, useRef, useState, type ReactNode } from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { ArrowRight, Info } from 'lucide-react';
import { BOOK_A_CALL_URL, type PlanKey } from '@/lib/commerce/plans';
import ManageBillingButton from '@/components/commerce/ManageBillingButton';
import { trackEvent } from '@/lib/analytics';
import { Pill } from './editorial';
import PaymentMethodsRow from './PaymentMethodsRow';

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
    cells: [{ text: '', cross: true }, { text: '10 hours', sub: '£599 value' }, { text: '10 hours' }],
  },
  {
    label: 'Small-Group Coaching',
    cells: [
      { text: '', cross: true },
      { text: 'One full day, 9am to 5pm', sub: 'Max class of 6 · £599 value' },
      { text: 'One full day, 9am to 5pm' },
    ],
  },
  {
    label: '1:1 weekly coaching',
    cells: [{ text: '', cross: true }, { text: '', cross: true }, { text: '12 x 1hr sessions' }],
  },
];

/**
 * Which Self-Study offer the toggle is showing. A presentation concern, not a
 * billing one: the course term is a one-off sale, the monthly plan a Stripe
 * subscription. The plan catalogue owns the real billing shape
 * (`Plan.billing`).
 */
type BillingChoice = 'three_month' | 'monthly';

/** The warm tint behind the highlighted (Complete) column. */
const HIGHLIGHT_BG = 'bg-[#FDF6E7]';

/** Which column, if any, the signed-in visitor already owns. */
type OwnedColumn = 'self_study' | 'complete' | 'intensive' | null;

/**
 * Both Self-Study billing shapes are the same *column*: someone on the rolling
 * plan owns Self-Study, whichever way the toggle is set, and must not be sold
 * it again.
 */
function ownedColumnFor(plan: string | null | undefined): OwnedColumn {
  if (plan === 'self_study' || plan === 'self_study_monthly') return 'self_study';
  if (plan === 'complete') return 'complete';
  if (plan === 'intensive') return 'intensive';
  return null;
}

export interface PricingTableProps {
  /**
   * The plan the signed-in visitor holds, if any. Drives the "Your plan" badge
   * and makes that column's CTA inert — a paying customer being invited to
   * "Pre-order now" the thing they already bought reads as a broken product.
   */
  ownedPlan?: string | null;
  /**
   * The account a purchase would attach to. Stated plainly, because
   * entitlements match by email and buying under another address is the one
   * mistake a buyer cannot undo themselves.
   */
  accountEmail?: string | null;
  /** Server-decided: this visitor may buy Complete at the difference. */
  canUpgrade?: boolean;
}

/** The "Your plan" marker, in the same slot the "Most popular" badge uses. */
function OwnedBadge({ className = '' }: { className?: string }) {
  return (
    <span
      className={`whitespace-nowrap rounded-full bg-heading px-2.5 py-0.5 font-mono text-[9px] uppercase tracking-[0.12em] text-white sm:text-[10px] ${className}`}
    >
      Your plan
    </span>
  );
}

/**
 * Kicks off Stripe checkout for whichever Self-Study plan the billing toggle has
 * selected (no coaching day needed either way). The plan key is passed in rather
 * than captured so one hook serves both the fixed-term and rolling variants.
 */
function useSelfStudyCheckout() {
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function start(plan: PlanKey) {
    if (submitting) return;
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch('/api/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ plan }),
      });
      const data = (await res.json()) as { url?: string; error?: string };
      if (!res.ok || !data.url) {
        setError(data.error ?? 'Something went wrong — please try again.');
        setSubmitting(false);
        return;
      }
      // Awaited so the capture flushes before we leave for Stripe.
      await trackEvent('checkout_started', { plan });
      window.location.assign(data.url);
    } catch {
      setError('Something went wrong — please try again.');
      setSubmitting(false);
    }
  }

  return { start, submitting, error };
}

/** The Self-Study plan key behind each billing choice. */
function selfStudyPlanFor(billing: BillingChoice): PlanKey {
  return billing === 'monthly' ? 'self_study_monthly' : 'self_study';
}

/** Self-Study list prices in pence — the saving below is derived from these. */
const SELF_STUDY_THREE_MONTH_PENCE = 29900;
const SELF_STUDY_MONTHLY_PENCE = 12900;

/**
 * What three months on the rolling plan would cost against the term price,
 * as a percentage. Computed, not typed: change either price above and the badge
 * follows. £299 vs 3 × £129 = £387 → 23%.
 */
const THREE_MONTH_SAVING_PERCENT = Math.round(
  (1 - SELF_STUDY_THREE_MONTH_PENCE / (SELF_STUDY_MONTHLY_PENCE * 3)) * 100,
);

/**
 * How the Self-Study column prices itself under each billing choice. The £299
 * term is shown as its monthly equivalent (the headline £299 lands heavy), with
 * the truth stated plainly underneath: one payment, and it does not renew. Both
 * charge on purchase.
 */
const SELF_STUDY_PRICING: Record<BillingChoice, { pounds: string; pence?: string; suffix: string; tagline: string }> = {
  three_month: {
    pounds: '£99',
    pence: '.66',
    suffix: '/month',
    tagline: `One payment of £299 · 3-month term, nothing renews`,
  },
  monthly: {
    pounds: '£129',
    suffix: '/month',
    tagline: 'Cancel any time',
  },
};

interface BillingToggleProps {
  billing: BillingChoice;
  onChange: (billing: BillingChoice) => void;
}

/**
 * Segmented 3-month / monthly switch. Only the Self-Study column responds:
 * Complete is sold as a fixed 3-month course term and has no rolling variant,
 * because a course with a start, an end and a printed service period is what a
 * study budget reimburses.
 */
function BillingToggle({ billing, onChange }: BillingToggleProps) {
  const options: readonly { key: BillingChoice; label: string; hint?: string }[] = [
    { key: 'three_month', label: '3 months', hint: `Save ${THREE_MONTH_SAVING_PERCENT}%` },
    { key: 'monthly', label: 'Monthly' },
  ];

  return (
    <div className="mb-6 flex justify-center">
      <div
        role="group"
        aria-label="Billing period"
        className="inline-flex items-center gap-1 rounded-full border border-heading/[0.08] bg-white/80 p-1 shadow-elevation-1 backdrop-blur"
      >
        {options.map((option) => {
          const active = billing === option.key;
          return (
            <button
              key={option.key}
              type="button"
              aria-pressed={active}
              onClick={() => {
                onChange(option.key);
                trackEvent('pricing_billing_toggled', { billing: option.key });
              }}
              className={`relative isolate inline-flex min-h-[44px] items-center rounded-full px-4 py-2 text-[13px] font-semibold transition-colors sm:text-sm ${
                active ? 'text-heading' : 'text-muted hover:text-heading'
              }`}
            >
              {active && (
                <motion.span
                  layoutId="billing-toggle-pill"
                  className={`absolute inset-0 -z-10 rounded-full ${HIGHLIGHT_BG} shadow-elevation-1`}
                  transition={{ type: 'spring', stiffness: 380, damping: 32 }}
                />
              )}
              {option.label}
              {option.hint && (
                <span
                  className={`ml-1.5 font-mono text-[9px] uppercase tracking-[0.1em] sm:text-[10px] ${
                    active ? 'text-primary' : 'text-muted/70'
                  }`}
                >
                  {option.hint}
                </span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}

/**
 * The £500 guarantee's material condition, reachable on a phone.
 *
 * This was a hover popover plus a `title` attribute on a 14x14 button with no
 * click handler — so on touch, where most of the traffic is, the one condition
 * attached to a £500 promise ("you must first pass all 200 AI stations") could
 * not be read at all.
 *
 * It is now an inline disclosure rather than a floating popover: tap or Enter
 * expands a paragraph inside the guarantee strip itself, `aria-expanded`
 * describes it, and the trigger is a 44px target. Inline matters — an absolute
 * panel opened underneath the fixed navbar whenever the strip happened to be
 * near the top of the viewport, and no z-index could lift it out of the
 * transformed card that contains it.
 *
 * It owns the strip's layout so the paragraph can take a line of its own; the
 * right-hand promise is passed as children.
 */
function GuaranteeInfo({
  children,
  align = 'between',
}: {
  children: ReactNode;
  align?: 'between' | 'center';
}) {
  const [open, setOpen] = useState(false);
  const panelId = useId();
  const panelRef = useRef<HTMLParagraphElement>(null);

  // Expanding in flow can put the paragraph just past the fold when the strip
  // sits at the bottom of the viewport. `block: 'nearest'` nudges only as far
  // as it has to, and does nothing when the paragraph is already visible.
  useEffect(() => {
    if (!open) return;
    const id = requestAnimationFrame(() =>
      panelRef.current?.scrollIntoView({ block: 'nearest', behavior: 'smooth' })
    );
    return () => cancelAnimationFrame(id);
  }, [open]);

  return (
    <div className="w-full">
      <div
        className={`flex flex-wrap items-center gap-x-3 gap-y-1 ${
          align === 'center' ? 'justify-center text-center' : 'justify-between'
        }`}
      >
        <span className="inline-flex items-center gap-1">
          <span className="text-[11px] font-medium text-[#27500A] sm:text-sm">SCA Guarantee</span>
          <button
            type="button"
            onClick={() => setOpen((o) => !o)}
            aria-expanded={open}
            aria-controls={panelId}
            aria-label="About the SCA Guarantee: conditional on passing all 200 AI stations"
            // -m-2 keeps the 44px target from changing the height of the strip.
            className="-m-2 inline-flex h-11 w-11 shrink-0 cursor-pointer items-center justify-center rounded-full p-2 text-[#27500A]/70 transition-colors hover:text-[#27500A]"
          >
            <Info className="h-3.5 w-3.5" aria-hidden="true" />
          </button>
        </span>
        {children}
      </div>
      {open && (
        <motion.p
          ref={panelRef}
          id={panelId}
          initial={{ opacity: 0, y: -4 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.15 }}
          className={`mt-2 text-[11px] leading-snug text-[#27500A]/90 ${
            align === 'center' ? 'text-center' : 'text-left'
          }`}
        >
          This is a <span className="font-medium text-[#27500A]">conditional</span> guarantee &mdash; to
          qualify you must first pass all 200 AI stations.
        </motion.p>
      )}
    </div>
  );
}

interface CtaButtonsProps {
  selfStudy: ReturnType<typeof useSelfStudyCheckout>;
  variant: 'self_study' | 'complete' | 'intensive';
  /** Which Self-Study plan the billing toggle currently has selected. */
  selfStudyPlan: PlanKey;
  owned?: OwnedColumn;
  canUpgrade?: boolean;
}

/** An owned plan's CTA: present, legible, and deliberately not clickable. */
function OwnedCta() {
  return (
    <button
      type="button"
      disabled
      className="w-full cursor-default rounded-full border border-heading/10 bg-transparent px-2 py-3 text-[13px] font-semibold text-muted sm:py-2.5 sm:text-sm"
    >
      Your current plan
    </button>
  );
}

function PlanCta({ selfStudy, variant, selfStudyPlan, owned, canUpgrade }: CtaButtonsProps) {
  if (owned === variant) return <OwnedCta />;
  if (variant === 'complete' && canUpgrade) {
    // Dead while UPGRADEABLE_FROM is empty (canSwitchPlan always refuses, so
    // `canUpgrade` never arrives true). Kept because re-populating that set is
    // the whole of turning self-serve upgrades back on.
    // A Self-Study customer would need a subscription: Stripe swaps its Price
    // and invoices only the time left on their term. Sending them through
    // /coaching-day would charge the full £599 for what they part-own.
    return (
      <ManageBillingButton
        flow="subscription_update"
        busyLabel="Opening Stripe…"
        onStart={() => trackEvent('checkout_clicked', { plan: 'complete_switch' })}
        className="cta-button w-full gap-1.5 !rounded-full px-2 py-3.5 text-[13px] disabled:opacity-60 sm:py-3 sm:text-sm"
        errorClassName="mt-2 text-center text-[12px] font-medium text-danger"
      >
        Upgrade to Complete
      </ManageBillingButton>
    );
  }
  if (variant === 'self_study') {
    const monthly = selfStudyPlan === 'self_study_monthly';
    return (
      <button
        type="button"
        onClick={() => {
          trackEvent('checkout_clicked', { plan: selfStudyPlan });
          selfStudy.start(selfStudyPlan);
        }}
        disabled={selfStudy.submitting}
        className="w-full rounded-full border border-heading/15 bg-white px-2 py-3 text-[13px] font-semibold text-heading transition-colors hover:bg-surface-warm disabled:opacity-60 sm:py-2.5 sm:text-sm"
      >
        {selfStudy.submitting ? 'Redirecting…' : monthly ? 'Start monthly' : 'Buy now'}
      </button>
    );
  }
  if (variant === 'complete') {
    return (
      <Link
        href="/coaching-day"
        onClick={() => trackEvent('checkout_clicked', { plan: 'complete' })}
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
      onClick={() => trackEvent('checkout_clicked', { plan: 'intensive' })}
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

interface MobileCardsProps {
  selfStudy: ReturnType<typeof useSelfStudyCheckout>;
  billing: BillingChoice;
  owned: OwnedColumn;
  canUpgrade: boolean;
}

/** Mobile: one full-width card per plan, same content as its desktop column. */
function MobileCards({ selfStudy, billing, owned, canUpgrade }: MobileCardsProps) {
  const selfStudyPlan = selfStudyPlanFor(billing);
  const selfStudyPrice = SELF_STUDY_PRICING[billing];
  const cards = [
    {
      key: 'self_study' as const,
      name: 'Self-Study',
      price: (
        <>
          {selfStudyPrice.pounds}
          {selfStudyPrice.pence && (
            <span className="text-sm font-normal text-muted/70">{selfStudyPrice.pence}</span>
          )}
        </>
      ),
      suffix: selfStudyPrice.suffix,
      tagline: selfStudyPrice.tagline,
      highlighted: false,
      badge: null,
      valueLine: null,
      cellIndex: 0,
    },
    {
      key: 'complete' as const,
      name: 'Complete SCA Course',
      price: '£599',
      suffix: '/ 3 months',
      tagline: 'One payment · nothing renews',
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
            {owned === card.key ? (
              <OwnedBadge className="absolute left-1/2 top-2 -translate-x-1/2" />
            ) : (
              card.badge && (
                <span className="absolute left-1/2 top-2 -translate-x-1/2 whitespace-nowrap rounded-full bg-primary px-2.5 py-0.5 font-mono text-[9px] uppercase tracking-[0.12em] text-white">
                  {card.badge}
                </span>
              )
            )}
            <PlanName>{card.name}</PlanName>
            <motion.div
              key={`${card.key}-${billing}`}
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.25, ease: 'easeOut' }}
            >
              <p className="mt-2 text-3xl font-medium tracking-tight text-heading">
                {card.price}{' '}
                {card.suffix && <span className="text-xs font-normal text-muted">{card.suffix}</span>}
              </p>
              <p className="mt-0.5 text-xs text-muted">{card.tagline}</p>
            </motion.div>
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
            <div className="bg-[#EAF3DE] px-5 py-3.5">
              <GuaranteeInfo>
                <p className="text-right text-[11px] leading-snug text-[#27500A]">
                  Don’t pass? We pay you £500
                </p>
              </GuaranteeInfo>
            </div>
          </div>

          <div className="p-3">
            <PlanCta
              selfStudy={selfStudy}
              variant={card.key}
              selfStudyPlan={selfStudyPlan}
              owned={owned}
              canUpgrade={canUpgrade}
            />
          </div>
        </div>
      ))}
    </div>
  );
}

/** The three-tier pricing table: matrix on desktop, stacked cards on mobile. */
export default function PricingTable({ ownedPlan, accountEmail, canUpgrade = false }: PricingTableProps = {}) {
  const selfStudy = useSelfStudyCheckout();
  const owned = ownedColumnFor(ownedPlan);
  // Three-month is the default: it is the better deal (£299 vs 3 × £129) and the
  // one a study budget will reimburse, so monthly is the deliberate opt-out.
  const [billing, setBilling] = useState<BillingChoice>('three_month');
  const selfStudyPlan = selfStudyPlanFor(billing);
  const selfStudyPrice = SELF_STUDY_PRICING[billing];

  return (
    <section id="pricing" className="scroll-mt-24 px-5 py-6 sm:px-8 sm:py-10">
      <div className="mx-auto max-w-5xl">
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-80px' }}
          transition={{ duration: 0.55, ease: 'easeOut' }}
          onViewportEnter={() => trackEvent('pricing_viewed', {})}
        >
          <p className="mb-3 flex justify-center">
            <Pill>Choose your prep</Pill>
          </p>

          <BillingToggle billing={billing} onChange={setBilling} />

          <MobileCards selfStudy={selfStudy} billing={billing} owned={owned} canUpgrade={canUpgrade} />

          <div className="hidden overflow-hidden rounded-3xl border border-heading/[0.06] bg-white/80 shadow-elevation-2 backdrop-blur sm:block">
            <div className="grid grid-cols-[minmax(84px,170px)_repeat(3,minmax(0,1fr))]">
              {/* Plan headers */}
              <div />
              <div className="relative px-3 pb-5 pt-9 text-center">
                {owned === 'self_study' && (
                  <OwnedBadge className="absolute left-1/2 top-3 -translate-x-1/2" />
                )}
                <PlanName>Self-Study</PlanName>
                {/* On 3 months the charge is still one £299 payment — the monthly
                    figure is framing, and the .66 is deliberately small and faint,
                    a footnote hanging off the 99. On monthly it is the real rate. */}
                <motion.div
                  key={billing}
                  initial={{ opacity: 0, y: 4 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.25, ease: 'easeOut' }}
                >
                  <p className="mt-2.5 text-lg font-medium tracking-tight text-heading sm:text-3xl">
                    {selfStudyPrice.pounds}
                    {selfStudyPrice.pence && (
                      <span className="text-[10px] font-normal text-muted/70 sm:text-sm">
                        {selfStudyPrice.pence}
                      </span>
                    )}{' '}
                    <span className="text-[10px] font-normal text-muted sm:text-xs">
                      {selfStudyPrice.suffix}
                    </span>
                  </p>
                  <p className="mt-1 text-[10px] text-muted sm:text-xs">{selfStudyPrice.tagline}</p>
                </motion.div>
              </div>
              <div className={`relative ${HIGHLIGHT_BG} px-3 pb-5 pt-9 text-center`}>
                {owned === 'complete' ? (
                  <OwnedBadge className="absolute left-1/2 top-3 -translate-x-1/2" />
                ) : (
                  <span className="absolute left-1/2 top-3 -translate-x-1/2 whitespace-nowrap rounded-full bg-primary px-2.5 py-0.5 font-mono text-[9px] uppercase tracking-[0.12em] text-white sm:text-[10px]">
                    Most popular
                  </span>
                )}
                <PlanName>Complete SCA Course</PlanName>
                <p className="mt-2.5 text-lg font-medium tracking-tight text-heading sm:text-3xl">
                  £599{' '}
                  <span className="text-[10px] font-normal text-muted sm:text-xs">/ 3 months</span>
                </p>
                <p className="mt-1 text-[10px] text-muted sm:text-xs">
                  One payment, nothing renews ·{' '}
                  <span className="line-through">£1,497 value</span>
                </p>
              </div>
              <div className="relative px-3 pb-5 pt-9 text-center">
                {owned === 'intensive' && (
                  <OwnedBadge className="absolute left-1/2 top-3 -translate-x-1/2" />
                )}
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
                <PlanCta selfStudy={selfStudy} variant="self_study" selfStudyPlan={selfStudyPlan} owned={owned} canUpgrade={canUpgrade} />
              </div>
              <div className={`border-t border-heading/[0.06] ${HIGHLIGHT_BG} px-4 py-4`}>
                <PlanCta selfStudy={selfStudy} variant="complete" selfStudyPlan={selfStudyPlan} owned={owned} canUpgrade={canUpgrade} />
              </div>
              <div className="border-t border-heading/[0.06] px-4 py-4">
                <PlanCta selfStudy={selfStudy} variant="intensive" selfStudyPlan={selfStudyPlan} owned={owned} canUpgrade={canUpgrade} />
              </div>

              {/* One guarantee strip for the whole table */}
              <div className="col-span-4 bg-[#EAF3DE] px-6 py-3.5">
                <GuaranteeInfo align="center">
                  <p className="text-[11px] text-[#27500A] sm:text-xs">
                    Every plan — don&rsquo;t pass, and we pay you £500.
                  </p>
                </GuaranteeInfo>
              </div>
            </div>
          </div>

          {selfStudy.error && (
            <p className="mt-3 text-center text-sm font-medium text-danger">{selfStudy.error}</p>
          )}

          {accountEmail && (
            <p className="mt-4 text-center text-[12px] text-muted sm:text-[13px]">
              This purchase will be linked to{' '}
              <span className="font-medium text-heading">{accountEmail}</span>.
            </p>
          )}

          <PaymentMethodsRow />
        </motion.div>
      </div>
    </section>
  );
}
