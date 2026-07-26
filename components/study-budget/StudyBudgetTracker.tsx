'use client';

import { useState } from 'react';
import { Check, Copy } from 'lucide-react';
import {
  getTrackerDeanery,
  TRACKER_DEANERIES,
  VERDICT_THEME,
} from '@/lib/study-budget/tracker';

/**
 * Study Budget Tracker (build package §4).
 *
 * Renders three blocks for the selected deanery: brief, verdict chip (verdict +
 * approvalLikelihood + cap, RAG-coloured), and the pre-drafted approval email
 * in a copy box.
 *
 * Data comes from lib/study-budget/tracker-data.json, which is the corrected
 * source — it disagrees with the older landing-page checker on several
 * deaneries, so this component deliberately does NOT share that data.
 */
export default function StudyBudgetTracker({
  defaultDeanery = null,
  emailOpen = false,
}: {
  /** Pre-selected slug on a deanery page; null on the hub (shows the prompt). */
  defaultDeanery?: string | null;
  /** Spokes open with the email pane already expanded. */
  emailOpen?: boolean;
}) {
  const [slug, setSlug] = useState<string>(defaultDeanery ?? '');
  const [showEmail, setShowEmail] = useState(emailOpen);
  const [copied, setCopied] = useState(false);

  const deanery = slug ? getTrackerDeanery(slug) : undefined;

  const handleCopy = async () => {
    if (!deanery) return;
    const text = `Subject: ${deanery.email.subject}\n\n${deanery.email.body}`;
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* clipboard blocked — the text is on screen and selectable anyway */
    }
  };

  return (
    <section className="px-5 py-12 sm:px-8">
      <div className="mx-auto max-w-[760px] rounded-2xl border border-[#E4DDC9] bg-[#FDF9F0] p-6 shadow-elevation-1 sm:p-8">
        <p className="text-xs font-medium uppercase tracking-[0.08em] text-[#854F0B] sm:text-sm">
          Study budget tracker
        </p>
        <h2 className="mt-2 [font-family:var(--font-serif)] text-[24px] font-semibold leading-snug text-heading md:text-[28px]">
          What your deanery will fund
        </h2>

        <label htmlFor="sb-tracker-deanery" className="mt-5 block text-sm font-medium text-heading">
          Your deanery
        </label>
        <select
          id="sb-tracker-deanery"
          value={slug}
          onChange={(e) => {
            setSlug(e.target.value);
            setShowEmail(Boolean(e.target.value));
            setCopied(false);
          }}
          className="mt-2 w-full rounded-xl border border-[#d9cdb3] bg-white px-4 py-3 text-[15px] text-heading focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/25"
        >
          <option value="">Select your deanery</option>
          {TRACKER_DEANERIES.map((d) => (
            <option key={d.slug} value={d.slug}>
              {d.name}
            </option>
          ))}
        </select>

        {deanery ? (
          <div className="mt-6">
            {/* 1. Brief */}
            <p className="text-[16px] leading-[1.7] text-body">{deanery.brief}</p>

            {/* 2. Verdict chip + cap */}
            {(() => {
              const theme = VERDICT_THEME[deanery.verdict];
              return (
                <div className={`mt-5 rounded-xl border ${theme.border} ${theme.bg} p-4`}>
                  <p className={`flex items-center gap-2 text-sm font-semibold ${theme.text}`}>
                    <span className={`h-2 w-2 rounded-full ${theme.dot}`} aria-hidden="true" />
                    {theme.label}
                  </p>
                  <p className="mt-2 text-[15px] leading-[1.65] text-body">
                    {deanery.approvalLikelihood}
                  </p>
                  <p className="mt-2 text-[13px] font-medium text-muted">Cap: {deanery.cap}</p>
                </div>
              );
            })()}

            {/* 3. Pre-drafted email */}
            <div className="mt-5">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <button
                  type="button"
                  onClick={() => setShowEmail((v) => !v)}
                  aria-expanded={showEmail}
                  className="text-[13px] font-semibold text-[#854F0B] underline decoration-[#d9cdb3] underline-offset-4 hover:text-heading sm:text-sm"
                >
                  {showEmail ? 'Hide the drafted email' : 'Show the drafted email'}
                </button>
                {showEmail ? (
                  <button
                    type="button"
                    onClick={handleCopy}
                    className="inline-flex items-center gap-1.5 text-[13px] font-semibold text-[#854F0B] underline decoration-[#d9cdb3] underline-offset-4 hover:text-heading sm:text-sm"
                  >
                    {copied ? (
                      <Check className="h-4 w-4" aria-hidden="true" />
                    ) : (
                      <Copy className="h-4 w-4" aria-hidden="true" />
                    )}
                    {copied ? 'Copied' : 'Copy email'}
                  </button>
                ) : null}
              </div>

              {showEmail ? (
                <div className="mt-3 rounded-xl border border-[#E4DDC9] bg-white p-4 sm:p-5">
                  <p className="text-[13px] font-semibold text-heading">
                    Subject: {deanery.email.subject}
                  </p>
                  <p className="mt-3 whitespace-pre-wrap text-[15px] leading-[1.7] text-body">
                    {deanery.email.body}
                  </p>
                </div>
              ) : null}
            </div>

            <p className="mt-4 text-[13px] leading-relaxed text-muted">
              Source:{' '}
              <a
                href={deanery.sourceUrl}
                className="underline underline-offset-2 hover:text-heading"
                {...(/^https?:\/\//.test(deanery.sourceUrl)
                  ? { target: '_blank', rel: 'noopener noreferrer' }
                  : {})}
              >
                {deanery.sourceDoc}
              </a>
            </p>
          </div>
        ) : (
          <p className="mt-5 text-[15px] leading-relaxed text-muted">
            Pick your deanery to see what it funds, how likely approval is, and a drafted
            email you can send your ES or TPD.
          </p>
        )}
      </div>
    </section>
  );
}
