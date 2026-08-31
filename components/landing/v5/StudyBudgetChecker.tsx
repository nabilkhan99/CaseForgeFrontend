'use client';

import { useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { Copy, Check, ChevronDown, FileText } from 'lucide-react';
import {
  DEANERIES,
  VERDICT_THEMES,
  buildEmailBody,
  getDeanery,
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
    body: 'Send the drafted email to your TPD before you book anything. Approval always sits with your ES and TPD.',
  },
  {
    title: 'Enrol and get your invoice',
    body: 'An itemised invoice with dates, taught hours and curriculum mapping, issued the moment you enrol.',
  },
  {
    title: 'Submit your claim',
    body: 'Send the invoice in with your approval in writing, and your deanery takes it from there.',
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
 * Verdict titles repeat the pill wording ("Strong case: …") — strip the
 * prefix so the headline doesn't say it twice, and re-capitalise.
 */
function displayTitle(title: string): string {
  const match = title.match(/^(?:Strong case|Reasonable chance): (.*)$/);
  if (!match) return title;
  return match[1].charAt(0).toUpperCase() + match[1].slice(1);
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
                Most trainees can claim our Complete SCA Course on the NHS study
                budget. Pick your region to see its published policy, quoted,
                with a pre-approval email drafted for your TPD.
              </p>

              {/* Mad-lib deanery selector */}
              <p className="mt-8 font-[family-name:var(--font-display)] text-xl font-medium leading-relaxed text-white sm:text-[27px]">
                I&apos;m training in{' '}
                <span className="relative inline-block rounded-sm align-baseline focus-within:ring-2 focus-within:ring-[#FAC775]/40">
                  <span
                    aria-hidden="true"
                    className="inline-flex items-baseline gap-1.5 border-b-2 border-[#FAC775] text-[#FAC775]"
                  >
                    {deanery ? deaneryLabel(deanery) : 'Select your deanery'}
                    <ChevronDown
                      className="h-4 w-4 self-center sm:h-5 sm:w-5"
                      strokeWidth={2.5}
                    />
                  </span>
                  <select
                    id="deanery-select"
                    aria-label="Select your deanery"
                    value={deaneryId}
                    onChange={(e) => handleSelect(e.target.value)}
                    className="absolute inset-0 h-full w-full cursor-pointer appearance-none opacity-0"
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
                </span>
                <span className="text-[#A8A29E]">.</span>
              </p>
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
  const title = showResit ? deanery.resit!.title : deanery.title;
  const body = showResit ? deanery.resit!.body : deanery.body;
  const isPlaceholder = deanery.id === PLACEHOLDER_ID;

  return (
    <div className="rounded-2xl bg-[#FAFAF9] p-6 shadow-elevation-3 sm:p-7">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
        {deanery.verdict !== 'local' && (
          <p
            className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.14em] sm:text-xs"
            style={{ color: theme.accent }}
          >
            <span
              className="inline-block h-2 w-2 rounded-full"
              style={{ background: theme.accent }}
            />
            {theme.pill}
          </p>
        )}
        {!isPlaceholder && (
          <p className="ml-auto font-mono text-[11px] uppercase tracking-[0.1em] text-muted">
            {deanery.label}
          </p>
        )}
      </div>

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

      <h3
        className="mt-3 font-[family-name:var(--font-serif)] text-2xl leading-snug sm:text-[30px] sm:leading-[1.25]"
        style={{ color: theme.title }}
      >
        {displayTitle(title)}
      </h3>

      <p className="mt-4 max-w-prose text-sm leading-relaxed text-body sm:text-[15px] sm:leading-[1.7]">
        {body}
      </p>

      <blockquote
        className="mt-6 border-l-2 pl-4 sm:pl-5"
        style={{ borderColor: theme.border }}
      >
        <p
          className="font-[family-name:var(--font-serif)] text-base italic leading-relaxed sm:text-lg"
          style={{ color: theme.title }}
        >
          &ldquo;{deanery.quote}&rdquo;
        </p>
        {deanery.quote2 && (
          <p
            className="mt-2 font-[family-name:var(--font-serif)] text-base italic leading-relaxed sm:text-lg"
            style={{ color: theme.title }}
          >
            &ldquo;{deanery.quote2}&rdquo;
          </p>
        )}
        <footer className="mt-2 text-xs text-muted sm:text-[13px]">
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
        </footer>
      </blockquote>
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
