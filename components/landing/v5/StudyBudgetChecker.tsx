'use client';

import { useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { Copy, Check, Mail } from 'lucide-react';
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
    <section className="px-5 py-6 sm:px-8 sm:py-10">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        transition={{ duration: 0.5 }}
        className="mx-auto max-w-5xl rounded-2xl border border-[#E4DDC9] bg-white p-6 shadow-elevation-1 sm:p-12"
      >
        <div className="mx-auto max-w-2xl">
          <p className="mb-3 text-xs font-medium uppercase tracking-[0.08em] text-[#854F0B] sm:mb-4 sm:text-sm">
            NHS study budget
          </p>
          <h2 className="text-lg font-semibold leading-snug text-heading sm:text-2xl">
            Most trainees can claim Complete on the NHS study budget
          </h2>
          <p className="mt-2 text-sm leading-relaxed text-body sm:text-base">
            Check your deanery in 10 seconds (we&apos;ve drafted up a study
            budget pre-approval request email for you).
          </p>

          <label htmlFor="deanery-select" className="sr-only">
            Select your deanery
          </label>
          <select
            id="deanery-select"
            value={deaneryId}
            onChange={(e) => handleSelect(e.target.value)}
            className="mt-4 h-10 w-full max-w-sm rounded-lg border border-[#E4DDC9] bg-white px-3 text-sm text-heading focus:outline-none focus:ring-2 focus:ring-[#B45309]/30"
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

          {deanery && (
            <motion.div
              key={`${deanery.id}-${hasResat}`}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.25 }}
            >
              <VerdictCard
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
              <EmailDrawer deanery={deanery} hasResat={hasResat} />
            </motion.div>
          )}

          <p className="mt-4 text-[11px] leading-relaxed text-muted sm:text-xs">
            Policy checked July 2026 against the most current document at the
            time. Approval always sits with your ES and TPD.
          </p>
        </div>
      </motion.div>
    </section>
  );
}

interface VerdictCardProps {
  deanery: DeaneryPolicy;
  hasResat: boolean;
  onResitChange: (value: boolean) => void;
}

function VerdictCard({ deanery, hasResat, onResitChange }: VerdictCardProps) {
  const showResit = Boolean(deanery.resit) && hasResat;
  const verdict = showResit ? deanery.resit!.verdict : deanery.verdict;
  const theme = VERDICT_THEMES[verdict];
  const title = showResit ? deanery.resit!.title : deanery.title;
  const body = showResit ? deanery.resit!.body : deanery.body;

  return (
    <div
      className="mt-4 rounded-xl border p-5 sm:p-6"
      style={{ background: theme.bg, borderColor: theme.border }}
    >
      <div
        className="mb-2 flex items-center gap-2 text-xs font-semibold tracking-wide"
        style={{ color: theme.accent }}
      >
        <span
          className="inline-block h-2.5 w-2.5 rounded-full"
          style={{ background: theme.accent }}
        />
        {theme.pill}
      </div>

      {deanery.resit && (
        <div
          className="mb-3 flex flex-wrap items-center gap-2 text-[13px]"
          style={{ color: theme.title }}
        >
          <span>Have you sat the SCA before?</span>
          {([false, true] as const).map((value) => (
            <button
              key={String(value)}
              type="button"
              onClick={() => onResitChange(value)}
              className="rounded-lg border px-3 py-1 text-[13px] transition-colors"
              style={{
                borderColor: theme.border,
                color: theme.title,
                background:
                  hasResat === value ? 'rgba(255,255,255,0.75)' : 'transparent',
                fontWeight: hasResat === value ? 600 : 400,
              }}
            >
              {value ? 'Yes' : 'No'}
            </button>
          ))}
        </div>
      )}

      <h3
        className="mb-2 text-base font-semibold leading-snug sm:text-[17px]"
        style={{ color: theme.title }}
      >
        {title}
      </h3>
      <p
        className="mb-4 text-sm leading-relaxed"
        style={{ color: theme.title }}
      >
        {body}
      </p>

      <div className="rounded-lg bg-white/65 px-4 py-3">
        <p
          className="font-serif text-[13.5px] leading-relaxed"
          style={{ color: theme.title }}
        >
          &ldquo;{deanery.quote}&rdquo;
        </p>
        {deanery.quote2 && (
          <p
            className="mt-1.5 font-serif text-[13.5px] leading-relaxed"
            style={{ color: theme.title }}
          >
            &ldquo;{deanery.quote2}&rdquo;
          </p>
        )}
        <p className="mt-1.5 text-xs" style={{ color: theme.accent }}>
          {deanery.doc} &nbsp;&middot;&nbsp;{' '}
          <a
            href={deanery.policyUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="underline"
            style={{ color: theme.accent }}
          >
            Read the full policy
          </a>
        </p>
      </div>
    </div>
  );
}

interface EmailDrawerProps {
  deanery: DeaneryPolicy;
  hasResat: boolean;
}

function EmailDrawer({ deanery, hasResat }: EmailDrawerProps) {
  const [copied, setCopied] = useState(false);

  const emailBody = useMemo(
    () => buildEmailBody(deanery, hasResat),
    [deanery, hasResat]
  );
  const mailtoUrl = buildMailtoUrl(deanery, hasResat);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(emailBody);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
      trackEvent('study_budget_email_copied', { deanery: deanery.id });
    } catch {
      // Clipboard unavailable (permissions / non-secure context) — leave the
      // text selectable below so the user can still copy manually.
    }
  };

  return (
    <div className="mt-3 rounded-xl border border-[#E4DDC9] bg-white p-5 sm:p-6">
      <h3 className="mb-3 text-sm font-semibold text-heading">
        Your pre-approval request email, ready to send
      </h3>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
        <p className="text-[13px] text-muted">
          {deanery.contact ? (
            <>
              To:{' '}
              <span className="text-[#854F0B]">{deanery.contact}</span>
            </>
          ) : (
            <>
              Submit via the{' '}
              <a
                href={deanery.portalUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-[#854F0B] underline"
              >
                {deanery.portalLabel ?? 'support portal'}
              </a>
            </>
          )}
        </p>
        <div className="flex gap-2">
          {mailtoUrl && (
            <a
              href={mailtoUrl}
              onClick={() =>
                trackEvent('study_budget_email_opened', {
                  deanery: deanery.id,
                })
              }
              className="inline-flex items-center gap-1.5 rounded-lg bg-[#EF9F27] px-3.5 py-2 text-[13px] font-semibold text-[#2C2C2A] shadow-[0_2px_6px_rgba(186,117,23,0.4)] transition-all hover:brightness-105"
            >
              <Mail className="h-3.5 w-3.5" aria-hidden="true" />
              Open in your email app
            </a>
          )}
          <button
            type="button"
            onClick={handleCopy}
            className="inline-flex items-center gap-1.5 rounded-lg border border-[#854F0B] bg-white px-3.5 py-2 text-[13px] font-semibold text-[#854F0B] transition-colors hover:bg-[#FAEEDA]"
          >
            {copied ? (
              <Check className="h-3.5 w-3.5" aria-hidden="true" />
            ) : (
              <Copy className="h-3.5 w-3.5" aria-hidden="true" />
            )}
            {copied ? 'Copied' : 'Copy email'}
          </button>
        </div>
      </div>
      <pre className="whitespace-pre-wrap rounded-lg bg-[#F7F2E7] p-4 font-sans text-[13px] leading-relaxed text-heading">
        {emailBody}
      </pre>
      <p className="mt-2.5 text-[11.5px] leading-relaxed text-muted">
        Fill the [brackets] with your details, and feel free to put it in your
        own words. The course specification link gives your TPD everything they
        need to approve it.
      </p>
    </div>
  );
}
