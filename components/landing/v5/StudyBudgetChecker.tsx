'use client';

import { useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { Copy, Check, Mail, ChevronDown } from 'lucide-react';
import {
  DEANERIES,
  VERDICT_THEMES,
  buildEmailBody,
  buildMailtoUrl,
  getDeanery,
  type DeaneryPolicy,
} from '@/lib/landing/studyBudget';
import { trackEvent } from '@/lib/analytics';

const GROUPS = ['England', 'Devolved nations'] as const;

/**
 * Verdict titles repeat the pill wording ("Strong case: …") — strip the
 * prefix so the headline doesn't say it twice, and re-capitalise.
 */
function displayTitle(title: string): string {
  const match = title.match(/^(?:Strong case|Reasonable chance): (.*)$/);
  if (!match) return title;
  return match[1].charAt(0).toUpperCase() + match[1].slice(1);
}

export default function StudyBudgetChecker() {
  const [deaneryId, setDeaneryId] = useState('london');
  const [hasResat, setHasResat] = useState(false);

  const deanery = getDeanery(deaneryId);

  const handleSelect = (id: string) => {
    setDeaneryId(id);
    setHasResat(false);
    const selected = getDeanery(id);
    trackEvent('study_budget_deanery_selected', {
      deanery: id,
      verdict: selected?.verdict ?? 'unknown',
    });
  };

  return (
    <section className="overflow-x-clip px-5 py-12 sm:px-8 sm:py-20">
      <div className="mx-auto max-w-2xl">
        <motion.p
          initial={{ opacity: 0, y: 12 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5 }}
          className="mb-2 text-xs font-medium uppercase tracking-[0.08em] text-[#854F0B] sm:text-sm"
        >
          NHS study budget
        </motion.p>

        <motion.h2
          initial={{ opacity: 0, y: 12 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5, delay: 0.06 }}
          className="font-[family-name:var(--font-display)] text-2xl font-medium leading-snug text-heading sm:text-4xl"
        >
          Most trainees can claim Complete on the NHS study budget.
        </motion.h2>

        <motion.p
          initial={{ opacity: 0, y: 12 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5, delay: 0.12 }}
          className="mt-3 text-sm leading-relaxed text-muted sm:text-base"
        >
          Check your deanery in 10 seconds — we&apos;ve drafted the
          pre-approval email for you.
        </motion.p>

        {/* Mad-lib deanery selector */}
        <motion.p
          initial={{ opacity: 0, y: 12 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5, delay: 0.18 }}
          className="mt-8 font-[family-name:var(--font-display)] text-xl font-medium leading-relaxed text-heading sm:mt-10 sm:text-[27px]"
        >
          I&apos;m training in{' '}
          <span className="relative inline-block rounded-sm align-baseline focus-within:ring-2 focus-within:ring-[#B45309]/30">
            <span
              aria-hidden="true"
              className="inline-flex items-baseline gap-1.5 border-b-2 border-[#B45309] text-[#B45309]"
            >
              {deanery?.label ?? 'your deanery'}
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
              {GROUPS.map((group) => (
                <optgroup key={group} label={group}>
                  {DEANERIES.filter((d) => d.group === group).map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.label}
                    </option>
                  ))}
                </optgroup>
              ))}
              {DEANERIES.filter((d) => d.group === 'Other').map((d) => (
                <option key={d.id} value={d.id}>
                  {d.label}
                </option>
              ))}
            </select>
          </span>
          <span className="text-muted">.</span>
        </motion.p>

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
              onResitChange={(value) => {
                setHasResat(value);
                trackEvent('study_budget_resit_toggled', {
                  deanery: deanery.id,
                  has_resat: value,
                });
              }}
            />
            <EmailLetter deanery={deanery} hasResat={hasResat} />
          </motion.div>
        )}

        <p className="mt-8 text-[11px] leading-relaxed text-muted/80 sm:text-xs">
          Policy checked July 2026 against the most current document at the
          time. Approval always sits with your ES and TPD.
        </p>
      </div>
    </section>
  );
}

interface VerdictProps {
  deanery: DeaneryPolicy;
  hasResat: boolean;
  onResitChange: (value: boolean) => void;
}

function Verdict({ deanery, hasResat, onResitChange }: VerdictProps) {
  const showResit = Boolean(deanery.resit) && hasResat;
  const verdict = showResit ? deanery.resit!.verdict : deanery.verdict;
  const theme = VERDICT_THEMES[verdict];
  const title = showResit ? deanery.resit!.title : deanery.title;
  const body = showResit ? deanery.resit!.body : deanery.body;

  return (
    <div className="relative mt-8 sm:mt-10">
      {/* Soft atmospheric tint instead of a coloured box */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -inset-x-16 -inset-y-8 -z-10 rounded-[50%] blur-3xl"
        style={{ background: theme.bg, opacity: 0.8 }}
      />

      <div className="border-t border-[#d9cdb3]/60 pt-6 sm:pt-7">
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
          className="mt-3 font-[family-name:var(--font-serif)] text-2xl leading-snug sm:text-[34px] sm:leading-[1.25]"
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
              className="underline decoration-[#d9cdb3] underline-offset-2 transition-colors hover:text-heading"
              style={{ color: theme.accent }}
            >
              Read the full policy
            </a>
          </footer>
        </blockquote>
      </div>
    </div>
  );
}

interface EmailLetterProps {
  deanery: DeaneryPolicy;
  hasResat: boolean;
}

function EmailLetter({ deanery, hasResat }: EmailLetterProps) {
  const [copied, setCopied] = useState(false);

  const emailBody = useMemo(
    () => buildEmailBody(deanery, hasResat),
    [deanery, hasResat]
  );
  const mailtoUrl = buildMailtoUrl(deanery, hasResat);
  const [subjectLine, ...restLines] = emailBody.split('\n');
  const letterBody = restLines.join('\n').trimStart();

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(emailBody);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
      trackEvent('study_budget_email_copied', { deanery: deanery.id });
    } catch {
      // Clipboard unavailable (permissions / non-secure context) — the
      // letter text below stays selectable for manual copying.
    }
  };

  return (
    <div className="mt-10 border-t border-[#d9cdb3]/60 pt-6 sm:mt-12 sm:pt-7">
      <div className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-2">
        <h3 className="text-sm font-semibold text-heading sm:text-base">
          Your pre-approval email, ready to send
        </h3>
        <p className="text-[13px] text-muted">
          {deanery.contact ? (
            <>
              To: <span className="text-[#854F0B]">{deanery.contact}</span>
            </>
          ) : (
            <>
              Submit via the{' '}
              <a
                href={deanery.portalUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-[#854F0B] underline underline-offset-2"
              >
                {deanery.portalLabel ?? 'support portal'}
              </a>
            </>
          )}
        </p>
      </div>

      <motion.div
        initial={{ opacity: 0, y: 14, rotate: -1.6 }}
        animate={{ opacity: 1, y: 0, rotate: -0.4 }}
        transition={{ duration: 0.5, delay: 0.1 }}
        className="mt-5 rounded-lg bg-[#FFFDF8] p-6 shadow-elevation-3 ring-1 ring-[#E4DDC9]/70 sm:p-9"
      >
        <p className="border-b border-[#E4DDC9]/70 pb-3 text-[13px] font-semibold text-heading sm:text-sm">
          {subjectLine}
        </p>
        <pre className="mt-4 whitespace-pre-wrap font-sans text-[13px] leading-[1.7] text-body sm:text-sm">
          {letterBody}
        </pre>
      </motion.div>

      <div className="mt-5 flex flex-wrap items-center gap-x-5 gap-y-3">
        {mailtoUrl && (
          <a
            href={mailtoUrl}
            onClick={() =>
              trackEvent('study_budget_email_opened', { deanery: deanery.id })
            }
            className="inline-flex items-center gap-2 rounded-full bg-[#EF9F27] px-5 py-2.5 text-[13px] font-semibold text-[#2C2C2A] shadow-[0_2px_6px_rgba(186,117,23,0.4)] transition-all hover:brightness-105 sm:text-sm"
          >
            <Mail className="h-4 w-4" aria-hidden="true" />
            Open in your email app
          </a>
        )}
        <button
          type="button"
          onClick={handleCopy}
          className="inline-flex items-center gap-1.5 text-[13px] font-semibold text-[#854F0B] underline decoration-[#d9cdb3] underline-offset-4 transition-colors hover:text-heading sm:text-sm"
        >
          {copied ? (
            <Check className="h-4 w-4" aria-hidden="true" />
          ) : (
            <Copy className="h-4 w-4" aria-hidden="true" />
          )}
          {copied ? 'Copied' : 'Copy email'}
        </button>
      </div>

      <p className="mt-4 text-[11.5px] leading-relaxed text-muted/80 sm:text-xs">
        Fill the [brackets] with your details, and feel free to put it in your
        own words. The course specification link gives your TPD everything
        they need to approve it.
      </p>
    </div>
  );
}
