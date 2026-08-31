'use client';

import { useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { Copy, Check, ChevronDown, FileText } from 'lucide-react';
import {
  DEANERIES,
  VERDICT_THEMES,
  buildEmailBody,
  getDeanery,
  outOfPocketFor,
  type DeaneryPolicy,
} from '@/lib/landing/studyBudget';
import { trackEvent } from '@/lib/analytics';
import { Accent, CROSSHATCH_DARK, Pill } from '@/components/landing/v5/editorial';

const GROUPS = ['England', 'Devolved nations'] as const;

/** The "not sure yet" entry doubles as the placeholder / not-chosen state. */
const PLACEHOLDER_ID = 'unsure';

/**
 * What to do once you have your position. Deliberately says nothing about
 * whether a claim will be paid: approval sits with the ES and TPD, and the
 * amount with the region's own policy.
 */
const STEPS: readonly { title: string; body: string }[] = [
  {
    title: 'Get pre-approval',
    body: 'The drafted email names the course, code and fee.',
  },
  {
    title: 'Enrol, get the invoice',
    body: 'Itemised, with dates and taught hours.',
  },
  {
    title: 'Get reimbursed',
    body: 'Send it in with your approval in writing.',
  },
];

/** Show the placeholder prompt in place of the "Not sure yet" label. */
function deaneryLabel(d: Pick<DeaneryPolicy, 'id' | 'label'>): string {
  return d.id === PLACEHOLDER_ID ? 'Select your deanery' : d.label;
}

/**
 * The drafted email body is generated in lib/landing/studyBudget.ts. Apply the
 * approved copy edits here at render-time (product name, opening line, and the
 * trainee/sign-off wording) so both the on-screen letter and the copied text
 * stay in sync.
 */
function transformEmailText(text: string): string {
  return text
    .replace(
      'I am an ST3 on the [scheme name] programme preparing for the SCA',
      'I am preparing for the SCA'
    )
    .replace(', GPST3, [Scheme]', '')
    .replace('Dear [name],\n\n', 'Dear [name],\n\nI hope you are well.\n\n');
}


/**
 * The deanery checker, as the page's one dark band.
 *
 * Nothing here asserts that a deanery will fund the course. It reports each
 * region's published position, quotes the document it came from, and drafts
 * the email that asks. With nothing selected it shows the national default
 * rather than an empty placeholder, so the section says something useful on
 * first paint.
 */
export default function StudyBudgetChecker({
  surface = 'landing',
}: {
  /** Where the checker is embedded — 'landing' on /, 'study-budget' on the hub/spoke pages. */
  surface?: string;
}) {
  const [deaneryId, setDeaneryId] = useState(PLACEHOLDER_ID);
  const [hasResat, setHasResat] = useState(false);

  // Tailwind breakpoints read the viewport, not the container. On the
  // /study-budget articles this sits inside a ~760px column on a desktop
  // viewport, so the side-by-side split would be squeezed into half of that.
  // Only the full-width homepage band gets two columns.
  const isLanding = surface === 'landing';

  const deanery = getDeanery(deaneryId);
  const isPlaceholder = deaneryId === PLACEHOLDER_ID;

  const handleSelect = (id: string) => {
    setDeaneryId(id);
    setHasResat(false);
    const selected = getDeanery(id);
    trackEvent('study_budget_deanery_selected', {
      deanery: id,
      verdict: selected?.verdict ?? 'unknown',
      surface,
    });
  };

  return (
    <section className="overflow-x-clip px-5 py-12 sm:px-8 sm:py-16">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        transition={{ duration: 0.5 }}
        className="relative mx-auto max-w-6xl overflow-hidden rounded-3xl bg-[#1C1917] px-6 py-10 sm:px-12 sm:py-14"
        style={CROSSHATCH_DARK}
      >
        {/* Warm glow along the top edge of the band */}
        <div
          className="pointer-events-none absolute left-1/2 top-0 h-[360px] w-[720px] -translate-x-1/2 rounded-full"
          style={{
            background:
              'radial-gradient(ellipse, rgba(217,119,6,0.16) 0%, transparent 65%)',
          }}
          aria-hidden="true"
        />

        <div className="relative">
          <div
            className={
              isLanding
                ? 'grid gap-9 lg:grid-cols-[0.95fr_1.05fr] lg:items-center lg:gap-14'
                : 'grid gap-9'
            }
          >
            <div>
              <Pill dark>NHS study budget</Pill>

              <h2 className="mt-5 text-balance font-[family-name:var(--font-display)] text-3xl font-bold leading-[1.12] tracking-[-0.025em] text-white sm:text-[2.5rem]">
                Check your deanery in <Accent dark>10 seconds.</Accent>
              </h2>

              <p className="mt-4 max-w-[34em] text-sm leading-relaxed text-[#D6D3D1] sm:text-base">
                Quoted from each region&rsquo;s published study leave policy.
                We&rsquo;ll draft the pre-approval email for you.
              </p>

              {/* Canvas 1c: a plain dark select. The mad-lib reads nicely but
                  hides the control; on the section that has to be used rather
                  than admired, the obvious affordance wins. */}
              <div className="mt-8 max-w-[26rem]">
                <label
                  htmlFor="deanery-select"
                  className="mb-2 block text-[13.5px] text-[#A8A29E]"
                >
                  Select your deanery
                </label>
                <div className="relative">
                  <select
                    id="deanery-select"
                    aria-label="Select your deanery"
                    value={deaneryId}
                    onChange={(e) => handleSelect(e.target.value)}
                    className="w-full cursor-pointer appearance-none rounded-lg border border-[#44403C] bg-[#262019] px-3.5 py-3.5 pr-11 text-base text-white transition-colors hover:border-[#FAC775]/60 focus:border-[#FAC775] focus:outline-none focus:ring-2 focus:ring-[#FAC775]/30"
                  >
                    {DEANERIES.filter((d) => d.group === 'Other').map((d) => (
                      <option key={d.id} value={d.id}>
                        {deaneryLabel(d)}
                      </option>
                    ))}
                    {GROUPS.map((group) => (
                      <optgroup key={group} label={group}>
                        {DEANERIES.filter((d) => d.group === group).map((d) => (
                          <option key={d.id} value={d.id}>
                            {d.label}
                          </option>
                        ))}
                      </optgroup>
                    ))}
                  </select>
                  <ChevronDown
                    className="pointer-events-none absolute right-3.5 top-1/2 h-5 w-5 -translate-y-1/2 text-[#A8A29E]"
                    strokeWidth={2}
                    aria-hidden="true"
                  />
                </div>
              </div>
            </div>

            {deanery && (
              <motion.div
                key={`${deanery.id}-${hasResat}`}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3 }}
              >
                <Verdict
                  deanery={deanery}
                  hasResat={hasResat}
                  surface={surface}
                  onResitChange={(value) => {
                    setHasResat(value);
                    trackEvent('study_budget_resit_toggled', {
                      deanery: deanery.id,
                      has_resat: value,
                      surface,
                    });
                  }}
                />
              </motion.div>
            )}
          </div>

          {/* Hide the drafted email until a real deanery is chosen. */}
          {deanery && !isPlaceholder && (
            <>
              <p className="mt-8 text-[11px] leading-relaxed text-[#A8A29E] sm:text-xs">
                Policy checked July 2026 against the most current document at the
                time. Approval always sits with your ES and TPD.
              </p>
              <EmailLetter
                deanery={deanery}
                hasResat={hasResat}
                surface={surface}
              />
            </>
          )}

          {/* What to do with it, once you have it */}
          <div className="mt-10 grid gap-7 border-t border-white/10 pt-8 sm:mt-12 sm:grid-cols-3 sm:gap-8">
            {STEPS.map((step, i) => (
              <motion.div
                key={step.title}
                initial={{ opacity: 0, y: 12 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.4, delay: i * 0.08 }}
                className="flex gap-3.5"
              >
                <span
                  className="flex-shrink-0 font-mono text-[13px] text-[#FAC775]"
                  aria-hidden="true"
                >
                  {String(i + 1).padStart(2, '0')}
                </span>
                <div>
                  <p className="text-[15px] font-semibold text-white">
                    {step.title}
                  </p>
                  <p className="mt-1.5 text-sm leading-relaxed text-[#D6D3D1]">
                    {step.body}
                  </p>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </motion.div>
    </section>
  );
}

interface VerdictProps {
  deanery: DeaneryPolicy;
  hasResat: boolean;
  surface: string;
  onResitChange: (value: boolean) => void;
}

function Verdict({ deanery, hasResat, surface, onResitChange }: VerdictProps) {
  const showResit = Boolean(deanery.resit) && hasResat;
  const verdict = showResit ? deanery.resit!.verdict : deanery.verdict;
  const theme = VERDICT_THEMES[verdict];
  const body = showResit ? deanery.resit!.body : deanery.body;

  // Deliberately not shown on the placeholder: until someone picks a region we
  // do not know their cap, and "£0" against "not sure yet" would be a funding
  // claim we cannot stand behind.
  const youPay = outOfPocketFor(deanery, hasResat);

  return (
    <div className="rounded-2xl bg-[#FAFAF9] p-6 shadow-elevation-3 sm:p-7">
      {/* Canvas 1c leads the card with the money, its cap, and how the money
          arrives. The verdict pill moves below: it answers "how strong is my
          case", which is a different question from "what will I pay". */}
      <div className="flex flex-wrap items-baseline gap-x-3.5 gap-y-2">
        <span
          className="font-[family-name:var(--font-display)] text-[40px] font-semibold leading-none tracking-[-0.03em] text-[#B45309] sm:text-[44px]"
          aria-label={`£${youPay} out of pocket`}
        >
          £{youPay}
        </span>
        <span className="text-[15px] text-body">out of pocket</span>
        {deanery.chip && (
          <span
            className={`ml-auto rounded-md px-2.5 py-1.5 text-xs font-medium ${
              deanery.chip === 'Very likely approved'
                ? 'bg-[#DCFCE7] text-[#166534]'
                : 'bg-[#FEF3C7] text-[#92400E]'
            }`}
          >
            {deanery.chip}
          </span>
        )}
      </div>

      {deanery.cap && (
        <p className="mt-3 font-mono text-[13px] text-muted">{deanery.cap}</p>
      )}

      {deanery.resit && (
        <p className="mt-3 text-sm text-body">
          Have you sat the SCA before?{' '}
          {([false, true] as const).map((value, i) => (
            <span key={String(value)}>
              {i > 0 && <span className="text-muted/60"> / </span>}
              <button
                type="button"
                onClick={() => onResitChange(value)}
                aria-pressed={hasResat === value}
                className={
                  hasResat === value
                    ? 'border-b-2 border-[#B45309] font-semibold text-heading'
                    : 'border-b border-transparent text-muted underline decoration-[#d9cdb3] underline-offset-4 transition-colors hover:text-heading'
                }
              >
                {value ? 'Yes' : 'No'}
              </button>
            </span>
          ))}
        </p>
      )}

      <p className="mt-3.5 text-[15px] leading-relaxed text-body">
        {deanery.detail ?? body}
      </p>

      {/* The canvas card stops here. The quoted policy and its source are the
          long form and live on the /study-budget pages; the card keeps one
          link out to them so the evidence is a click away, not a paragraph. */}
      <p className="mt-4 border-t border-heading/[0.07] pt-3.5 text-[12.5px] text-muted">
        {deanery.doc}
        <span className="mx-1.5 text-muted/50">&middot;</span>
        <a
          href={deanery.policyUrl}
          target="_blank"
          rel="noopener noreferrer"
          onClick={() =>
            trackEvent('study_budget_policy_link_clicked', {
              deanery: deanery.id,
              verdict,
              surface,
            })
          }
          className="underline decoration-[#d9cdb3] underline-offset-2 transition-colors hover:text-heading"
          style={{ color: theme.accent }}
        >
          Read the full policy
        </a>
      </p>
    </div>
  );
}

interface EmailLetterProps {
  deanery: DeaneryPolicy;
  hasResat: boolean;
  surface: string;
}

function EmailLetter({ deanery, hasResat, surface }: EmailLetterProps) {
  const [copied, setCopied] = useState(false);

  const emailBody = useMemo(
    () => transformEmailText(buildEmailBody(deanery, hasResat)),
    [deanery, hasResat]
  );
  const [subjectLine, ...restLines] = emailBody.split('\n');
  const letterBody = restLines.join('\n').trimStart();

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(emailBody);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
      trackEvent('study_budget_email_copied', {
        deanery: deanery.id,
        surface,
      });
    } catch {
      // Clipboard unavailable (permissions / non-secure context) — the
      // letter text below stays selectable for manual copying.
    }
  };

  return (
    <div className="mt-6 border-t border-white/10 pt-6 sm:pt-7">
      <div className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-2">
        <h3 className="text-sm font-semibold text-white sm:text-base">
          Your pre-approval email, ready to send
        </h3>
        <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
          <button
            type="button"
            onClick={handleCopy}
            className="inline-flex items-center gap-1.5 text-[13px] font-semibold text-[#FAC775] underline decoration-[#FAC775]/40 underline-offset-4 transition-colors hover:text-white sm:text-sm"
          >
            {copied ? (
              <Check className="h-4 w-4" aria-hidden="true" />
            ) : (
              <Copy className="h-4 w-4" aria-hidden="true" />
            )}
            {copied ? 'Copied' : 'Copy email'}
          </button>
          {/* The drafted email cites this URL, so approvers need it reachable. */}
          <a
            href="/course-spec"
            target="_blank"
            rel="noopener noreferrer"
            onClick={() =>
              trackEvent('study_budget_course_spec_clicked', {
                deanery: deanery.id,
                surface,
              })
            }
            className="inline-flex items-center gap-1.5 text-[13px] font-semibold text-[#FAC775] underline decoration-[#FAC775]/40 underline-offset-4 transition-colors hover:text-white sm:text-sm"
          >
            <FileText className="h-4 w-4" aria-hidden="true" />
            Course specification
          </a>
        </div>
      </div>

      <motion.div
        initial={{ opacity: 0, y: 14, rotate: -1.2 }}
        animate={{ opacity: 1, y: 0, rotate: -0.4 }}
        transition={{ duration: 0.5, delay: 0.1 }}
        className="mt-5 rounded-2xl bg-[#FFFDF8] p-6 shadow-elevation-3 ring-1 ring-[#E4DDC9]/70 sm:p-9"
      >
        <p className="border-b border-[#E4DDC9]/70 pb-3 text-[13px] font-semibold text-heading sm:text-sm">
          {subjectLine}
        </p>
        <pre className="mt-4 whitespace-pre-wrap font-sans text-[13px] leading-[1.7] text-body sm:text-sm">
          {letterBody}
        </pre>
      </motion.div>
    </div>
  );
}
