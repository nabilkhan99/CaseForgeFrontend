'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import Link from 'next/link';
import PrimaryButton from '@/components/ui/PrimaryButton';
import {
  ConsultationFeedback,
  DomainFeedback,
  DomainKey,
  Evidence,
  GRADE_LABELS,
  PASSING_VERDICTS,
  Verdict,
} from '@/lib/clinical-master/types';
import {
  TONE_BAR_CLASS,
  fmtMark,
  gradeTone,
  passMarkCaption,
  passMarkFor,
  passMarkPercent,
  passMarkSentence,
  verdictTone,
} from '@/lib/clinical-master/scoring';
import {
  formatTimestamp,
  normaliseTranscript,
  type TranscriptLine,
} from '@/lib/clinical-master/transcript';

/** Poll interval, ms. */
const POLL_INTERVAL_MS = 3000;
/**
 * Give-up threshold. Marking normally lands well inside a minute or two, but
 * the old budget (30 × 3s = 90s) expired BEFORE the "a minute or two" we tell
 * the user, so an ordinary slow run fell through to the "still processing"
 * screen and sent people into a refresh loop. 100 × 3s = 5 minutes leaves
 * generous headroom; past that the run is genuinely stuck, not just slow.
 */
const MAX_RETRIES = 100;
const DOMAIN_NAV: DomainKey[] = ['data_gathering', 'clinical_management', 'relating_to_others'];
type ReportTab = 'overview' | DomainKey;

/**
 * Per-domain identity only. Bars and pills are coloured from the GRADE
 * (see TONE_BAR_CLASS + gradeTone): a domain-coloured bar meant an amber bar
 * next to "PASS" for data gathering and a red one next to "CLEAR PASS" for
 * clinical management, i.e. colour that contradicted the words beside it.
 * Domain identity lives in the neutral header tint instead.
 */
const DOMAIN_META: Record<DomainKey, {
  label: string;
  shortLabel: string;
  maxPoints: number;
  weightLabel?: string;
  headerClass: string;
  softClass: string;
}> = {
  data_gathering: {
    label: 'Data gathering',
    shortLabel: 'Data',
    maxPoints: 3,
    headerClass: 'bg-stone-50',
    softClass: 'bg-primary/[0.06] text-primary border-primary/15',
  },
  clinical_management: {
    label: 'Clinical management',
    shortLabel: 'Management',
    maxPoints: 4.5,
    weightLabel: 'weighted 1.5x',
    headerClass: 'bg-stone-100/70',
    softClass: 'bg-stone-100 text-stone-600 border-stone-200',
  },
  relating_to_others: {
    label: 'Relating to others',
    shortLabel: 'Relating',
    maxPoints: 3,
    headerClass: 'bg-stone-50',
    softClass: 'bg-stone-50 text-stone-600 border-stone-200',
  },
};

function fmtTs(ms?: number | null): string {
  if (ms == null) return '';
  const t = Math.max(0, Math.floor(ms / 1000));
  return `${String(Math.floor(t / 60)).padStart(2, '0')}:${String(t % 60).padStart(2, '0')}`;
}

function fmtDuration(ms?: number | null): string | null {
  if (ms == null) return null;
  const totalSeconds = Math.max(0, Math.round(ms / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  if (minutes === 0) return `${seconds}s`;
  return `${minutes}m ${String(seconds).padStart(2, '0')}s`;
}

function fmtScore(score: number): string {
  return Number.isInteger(score) ? String(score) : score.toFixed(1);
}

function domainMaxPoints(domain: DomainFeedback): number {
  return domain.max_points ?? DOMAIN_META[domain.domain].maxPoints;
}

function domainScore(domain: DomainFeedback): number {
  return domain.weighted_points ?? (
    domain.domain === 'clinical_management' ? domain.grade_points * 1.5 : domain.grade_points
  );
}

function gradeColours(grade: DomainFeedback['grade']): {
  badge: string;
  text: string;
  border: string;
} {
  if (grade === 'CP') {
    return {
      badge: 'bg-green-50 text-green-700 border-green-200',
      text: 'text-green-700',
      border: 'border-green-200',
    };
  }
  if (grade === 'P') {
    return {
      badge: 'bg-lime-50 text-lime-700 border-lime-200',
      text: 'text-lime-700',
      border: 'border-lime-200',
    };
  }
  if (grade === 'F') {
    return {
      badge: 'bg-amber-50 text-amber-700 border-amber-200',
      text: 'text-amber-700',
      border: 'border-amber-200',
    };
  }
  return {
    badge: 'bg-red-50 text-red-700 border-red-200',
    text: 'text-red-700',
    border: 'border-red-200',
  };
}

function verdictColours(verdict: Verdict): {
  text: string;
  badge: string;
  bar: string;
} {
  const passing = PASSING_VERDICTS.includes(verdict);
  // Bars use the shared three-tone palette (green pass / amber borderline /
  // red fail) so the fill means the same thing here as on every domain bar.
  const bar = TONE_BAR_CLASS[verdictTone(verdict)];
  if (verdict === 'Pass') {
    return {
      text: 'text-green-700',
      badge: 'bg-green-50 text-green-700 border-green-200',
      bar,
    };
  }
  if (verdict === 'Bare Pass') {
    return {
      text: 'text-lime-700',
      badge: 'bg-lime-50 text-lime-700 border-lime-200',
      bar,
    };
  }
  if (verdict === 'Bare Fail') {
    return {
      text: 'text-primary',
      badge: 'bg-amber-50 text-amber-700 border-amber-200',
      bar,
    };
  }
  return passing
    ? {
      text: 'text-green-700',
      badge: 'bg-green-50 text-green-700 border-green-200',
      bar,
    }
    : {
      text: 'text-red-700',
      badge: 'bg-red-50 text-red-700 border-red-200',
      bar,
    };
}

function severityLabel(tier: number): {
  label: string;
  className: string;
} {
  if (tier >= 3) return { label: 'critical', className: 'bg-red-50 text-red-700 border-red-200' };
  if (tier === 2) return { label: 'significant', className: 'bg-amber-50 text-amber-700 border-amber-200' };
  return { label: 'minor', className: 'bg-stone-100 text-stone-600 border-stone-200' };
}

function looksLikeNonEvidenceQuote(quote: string): boolean {
  const q = quote.trim().toLowerCase();
  return q.length < 44 || (
    q.includes("tell me what's wrong") ||
    q.includes('tell me what is wrong') ||
    q.includes('what can i do for you') ||
    q.includes('what seems to be the problem')
  );
}

function EvidenceBlock({
  evidence,
  fallback,
  mode = 'supporting',
}: {
  evidence?: Evidence | null;
  fallback?: string;
  mode?: 'supporting' | 'missed';
}) {
  if (!evidence?.quote) {
    const absenceCopy = evidence?.evidence_kind === 'not_asked'
      ? 'Not asked, so there is no direct transcript quote for this item.'
      : evidence?.evidence_kind === 'no_direct_quote'
        ? 'No direct quote. This is inferred from the consultation flow.'
        : fallback;
    if (!absenceCopy) return null;
    return (
      <div className="mt-3 rounded-lg border border-stone-200/80 bg-stone-50/80 px-3 py-2 text-[12px] leading-[1.55] text-stone-500">
        {absenceCopy}
      </div>
    );
  }

  if (mode === 'missed' && looksLikeNonEvidenceQuote(evidence.quote)) {
    return (
      <div className="mt-3 rounded-lg border border-stone-200/80 bg-stone-50/80 px-3 py-2 text-[12px] leading-[1.55] text-stone-500">
        No useful direct quote for this missed item. This is marked from what was not explored.
      </div>
    );
  }

  return (
    <blockquote className="mt-3 rounded-lg border border-stone-200 bg-white/80 px-3 py-2 text-[12px] leading-[1.65] text-stone-600 shadow-[0_1px_2px_rgba(31,26,20,0.04)]">
      <div className="mb-1 flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.08em] text-stone-400">
        {evidence.timestamp_ms != null && (
          <span className="font-mono tracking-normal">[{fmtTs(evidence.timestamp_ms)}]</span>
        )}
        {evidence.speaker && <span>{evidence.speaker}</span>}
      </div>
      <span className="italic">&ldquo;{evidence.quote}&rdquo;</span>
    </blockquote>
  );
}

/**
 * Determinate-feel progress bar for the marking wait. We can't know the exact
 * finish time (marking runs server-side), so the bar eases asymptotically
 * toward ~92% and never stalls or loops — it completes when the real report
 * replaces this component. Gives the user continuous "it's working" feedback
 * instead of a static skeleton, and there is no refresh instruction here.
 */
function MarkingProgress({ compact = false }: { compact?: boolean }) {
  const [progress, setProgress] = useState(8);
  useEffect(() => {
    const id = setInterval(() => {
      setProgress((p) => (p >= 92 ? p : p + Math.max(0.5, (92 - p) * 0.035)));
    }, 700);
    return () => clearInterval(id);
  }, []);

  return (
    <div className="mt-6" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(progress)} aria-label="Marking your consultation">
      <div className="mb-2 flex items-center justify-between text-sm text-muted">
        <span>Marking your consultation…</span>
        <span className="tabular-nums text-stone-400">{Math.round(progress)}%</span>
      </div>
      <div className="h-2 w-full overflow-hidden rounded-full bg-stone-200/70">
        <div
          className="h-full rounded-full bg-primary transition-[width] duration-700 ease-out"
          style={{ width: `${progress}%` }}
        />
      </div>
      <p className="mt-2 text-xs text-stone-400">
        {compact
          ? 'This usually takes a minute or two — your plan options are below. No need to refresh; it updates on its own.'
          : 'This usually takes a minute or two. No need to refresh — it updates on its own.'}
      </p>
    </div>
  );
}

function LoadingState({ compact = false }: { compact?: boolean }) {
  // Compact (trial funnel): the pricing table renders directly below this
  // component, so the skeleton must not fill the viewport and hide it.
  if (compact) {
    return (
      <div className="bg-surface px-5 py-10">
        <div className="mx-auto max-w-[1120px]">
          <div className="animate-pulse">
            <div className="mb-6 h-5 w-48 rounded-full bg-stone-200/70" />
            <div className="mb-4 h-12 w-full max-w-[560px] rounded-xl bg-stone-200/70" />
            <div className="h-40 rounded-[22px] bg-white/70" />
          </div>
          <MarkingProgress compact />
        </div>
      </div>
    );
  }
  return (
    <div className="min-h-[100dvh] bg-surface px-5 py-10">
      <div className="mx-auto max-w-[1120px]">
        <div className="animate-pulse">
          <div className="mb-8 h-5 w-48 rounded-full bg-stone-200/70" />
          <div className="mb-4 h-12 w-full max-w-[560px] rounded-xl bg-stone-200/70" />
          <div className="grid gap-5 lg:grid-cols-[1.1fr_0.9fr]">
            <div className="h-72 rounded-[22px] bg-white/70" />
            <div className="h-72 rounded-[22px] bg-white/70" />
          </div>
          <div className="mt-8 grid gap-4 md:grid-cols-3">
            <div className="h-28 rounded-2xl bg-white/70" />
            <div className="h-28 rounded-2xl bg-white/70" />
            <div className="h-28 rounded-2xl bg-white/70" />
          </div>
        </div>
        <MarkingProgress />
      </div>
    </div>
  );
}

function DomainMiniRow({ domain }: { domain: DomainFeedback }) {
  const meta = DOMAIN_META[domain.domain];
  const score = domainScore(domain);
  const maxPoints = domainMaxPoints(domain);
  const pct = Math.max(0, Math.min(100, (score / maxPoints) * 100));

  return (
    <div
      className="group grid grid-cols-[minmax(0,1fr)_auto] gap-3 rounded-xl border border-black/[0.06] bg-white/70 px-4 py-3 transition hover:border-black/[0.12] hover:bg-white"
    >
      <div className="min-w-0">
        <div className="mb-2 flex items-center gap-2">
          <span className="truncate text-[13px] font-semibold text-heading">{meta.label}</span>
          {meta.weightLabel && (
            <span className="rounded-full bg-stone-100 px-2 py-0.5 text-[9px] font-semibold uppercase tracking-[0.08em] text-stone-500">
              weighted
            </span>
          )}
        </div>
        <div className="h-1.5 overflow-hidden rounded-full bg-stone-200/80">
          <div
            className={`h-full rounded-full ${TONE_BAR_CLASS[gradeTone(domain.grade)]}`}
            style={{ width: `${pct}%` }}
          />
        </div>
      </div>
      {/* S3: a score is information; a per-domain verdict badge alongside the
          overall verdict was the same judgement said four times. The bar is
          already grade-toned, and the grade stays available to screen readers. */}
      <div className="text-right">
        <div className="font-mono text-[15px] font-semibold tabular-nums text-heading">
          {fmtScore(score)}<span className="text-[12px] text-stone-400">/{fmtScore(maxPoints)}</span>
        </div>
        <span className="sr-only">{GRADE_LABELS[domain.grade]}</span>
      </div>
    </div>
  );
}

function ScoreBreakdown({ domains }: { domains: DomainFeedback[] }) {
  const ordered = DOMAIN_NAV
    .map((key) => domains.find((domain) => domain.domain === key))
    .filter(Boolean) as DomainFeedback[];

  return (
    <section className="grid gap-3 md:grid-cols-3">
      {ordered.map((domain) => (
        <DomainMiniRow key={domain.domain} domain={domain} />
      ))}
    </section>
  );
}

function FocusNext({ feedback }: { feedback: ConsultationFeedback }) {
  const focusAreas = feedback.focus_areas.slice().sort((a, b) => a.priority - b.priority).slice(0, 3);
  if (focusAreas.length === 0) return null;

  return (
    <section className="rounded-[18px] border border-black/[0.06] bg-surface-raised p-5">
      <div className="mb-4 text-[11px] font-semibold uppercase tracking-[0.1em] text-muted">Focus next</div>
      <div className="grid gap-4">
        {focusAreas.map((focus) => (
          <div key={`${focus.priority}-${focus.label}`} className="grid grid-cols-[32px_1fr] gap-3">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/[0.08] font-mono text-[12px] font-semibold text-primary">
              {focus.priority}
            </div>
            <div>
              <h3 className="text-[14px] font-semibold text-heading">{focus.label}</h3>
              <p className="mt-1 text-[13px] leading-[1.6] text-stone-600">{focus.narrative}</p>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

function VerdictPanel({ feedback }: { feedback: ConsultationFeedback }) {
  const { overall } = feedback;
  const vc = verdictColours(overall.verdict);
  const maxScore = overall.max_score || 10.5;
  const pct = Math.max(0, Math.min(100, (overall.weighted_score / maxScore) * 100));
  const duration = fmtDuration(feedback.timing?.total_duration_ms);
  // The pass mark, marked on the bar and stated in words. "Bare Fail" and
  // "0.5 short of 6.0" are different facts, and only the second one is useful.
  const passMark = passMarkFor(maxScore);
  const passPct = passMarkPercent(maxScore);

  return (
    <section className="grid gap-5 rounded-[24px] border border-black/[0.06] bg-white/80 p-5 shadow-[0_20px_60px_rgba(180,83,9,0.07),0_2px_4px_rgba(0,0,0,0.04)] md:p-6 lg:grid-cols-[250px_minmax(0,1fr)_240px]">
      <div className="rounded-[18px] bg-surface px-5 py-4">
        <div className="mb-3 text-[11px] font-semibold uppercase tracking-[0.1em] text-muted">Final verdict</div>
        <div className={`font-serif text-[40px] leading-none ${vc.text}`}>{overall.verdict}</div>
        <div className="mt-3 flex items-end gap-2 font-mono text-heading">
          <span className="text-[24px] font-semibold">{overall.weighted_score.toFixed(1)}</span>
          <span className="pb-1 text-[13px] text-stone-400">/ {overall.max_score.toFixed(1)}</span>
        </div>
        <div className="relative mt-4 h-2 rounded-full bg-stone-200">
          <div className="absolute inset-0 overflow-hidden rounded-full">
            <motion.div
              className={`h-full rounded-full ${vc.bar}`}
              initial={{ width: 0 }}
              animate={{ width: `${pct}%` }}
              transition={{ duration: 0.8, ease: 'easeOut' }}
            />
          </div>
          <div
            aria-hidden
            className="absolute -top-1 -bottom-1 w-[2px] rounded-full bg-heading/40"
            style={{ left: `${passPct}%` }}
          />
        </div>
        <p className="mt-3 text-[12px] leading-[1.55] text-stone-600">
          {passMarkSentence(overall.weighted_score, maxScore)}
        </p>
      </div>

      <div className="flex min-w-0 flex-col justify-center">
        <div>
          {/* S3: the verdict is already stated at full size to the left. Repeating
              it here as a badge added no information and doubled the volume. */}
          <div className="mb-3 flex flex-wrap items-center gap-2">
            {duration && (
              <span className="inline-flex rounded-full border border-black/[0.06] bg-stone-50 px-3 py-1 text-[11px] font-medium text-stone-500">
                {duration} total
              </span>
            )}
          </div>

          <p className="max-w-[62ch] text-[15px] leading-[1.75] text-stone-700">
            {overall.one_line_summary || 'Your consultation has been marked. Use the domain breakdown below to see where marks were gained and lost.'}
          </p>
        </div>

        {overall.tier3_override_applied && (
          <div className="mt-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-[13px] leading-[1.6] text-red-700">
            A safety critical issue capped the result at Fail, regardless of the arithmetic score.
          </div>
        )}
      </div>

      <div className="rounded-[18px] border border-black/[0.06] bg-stone-50/70 px-4 py-4">
        <div className="mb-3 text-[11px] font-semibold uppercase tracking-[0.1em] text-muted">Score key</div>
        <div className="space-y-2.5 text-[12px] text-stone-600">
          <div className="flex items-center justify-between gap-3">
            <span>Data gathering</span>
            <span className="font-mono font-semibold text-heading">/3</span>
          </div>
          <div className="flex items-center justify-between gap-3">
            <span>Clinical management</span>
            <span className="font-mono font-semibold text-heading">/4.5</span>
          </div>
          <div className="flex items-center justify-between gap-3">
            <span>Relating</span>
            <span className="font-mono font-semibold text-heading">/3</span>
          </div>
          <div className="flex items-center justify-between gap-3 border-t border-black/[0.06] pt-2.5">
            <span className="font-semibold text-heading">Pass mark</span>
            <span className="font-mono font-semibold text-heading">
              {fmtMark(passMark)} / {fmtMark(maxScore)}
            </span>
          </div>
          <p className="text-[11px] leading-[1.6] text-stone-500">
            Clinical management counts 1.5x, so it moves the total more than the other
            two domains and can decide the verdict on its own. That is why the domain
            grades and the overall verdict can disagree.
          </p>
        </div>
      </div>
    </section>
  );
}

function ReportTabs({
  activeTab,
  onChange,
  domains,
}: {
  activeTab: ReportTab;
  onChange: (tab: ReportTab) => void;
  domains: DomainFeedback[];
}) {
  const tabs: { key: ReportTab; label: string; grade?: DomainFeedback['grade'] }[] = [
    { key: 'overview', label: 'Overview' },
    ...domains.map((domain) => ({
      key: domain.domain,
      label: DOMAIN_META[domain.domain].label,
      grade: domain.grade,
    })),
  ];

  return (
    <div className="flex flex-wrap gap-2 rounded-[18px] border border-black/[0.06] bg-white/70 p-2">
      {tabs.map((tab) => {
        const active = activeTab === tab.key;
        return (
          <button
            key={tab.key}
            type="button"
            onClick={() => onChange(tab.key)}
            className={`min-h-[44px] rounded-xl px-4 py-2 text-[13px] font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/35 ${
              active
                ? 'bg-heading text-white shadow-[0_6px_18px_rgba(31,26,20,0.12)]'
                : 'text-stone-600 hover:bg-primary/[0.06] hover:text-primary'
            }`}
          >
            {/* S3: tabs are navigation. Stamping the grade on each one put the
                verdict on screen three more times before you had read anything. */}
            <span>{tab.label}</span>
            {tab.grade && <span className="sr-only"> — {GRADE_LABELS[tab.grade]}</span>}
          </button>
        );
      })}
    </div>
  );
}

function OverviewPanel({
  feedback,
  domains,
}: {
  feedback: ConsultationFeedback;
  domains: DomainFeedback[];
}) {
  const lowestDomain = domains
    .slice()
    .sort((a, b) => (domainScore(a) / domainMaxPoints(a)) - (domainScore(b) / domainMaxPoints(b)))[0];
  const passedDomains = domains.filter((domain) => domain.grade === 'CP' || domain.grade === 'P').length;
  const topMisses = domains
    .flatMap((domain) => domain.what_you_missed.map((missed) => ({ ...missed, domain: domain.domain })))
    .sort((a, b) => b.consequence_tier - a.consequence_tier)
    .slice(0, 3);

  return (
    <motion.section
      key="overview-panel"
      className="rounded-[22px] border border-black/[0.06] bg-white/85 p-5 shadow-[0_18px_48px_rgba(180,83,9,0.055),0_1px_3px_rgba(31,26,20,0.04)]"
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -6 }}
      transition={{ duration: 0.18 }}
    >
      <div className="grid gap-5 lg:grid-cols-[1fr_360px]">
        <div className="rounded-[18px] bg-surface px-5 py-5">
          <div className="mb-3 text-[11px] font-semibold uppercase tracking-[0.1em] text-muted">Consultation overview</div>
          <p className="text-[15px] leading-[1.75] text-stone-700">
            {feedback.overall.one_line_summary || 'This report summarises the consultation across data gathering, clinical management, and relating to others.'}
          </p>
          <div className="mt-5 grid gap-3 sm:grid-cols-3">
            <div className="rounded-xl border border-black/[0.06] bg-white/70 px-3 py-3">
              <div className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted">Result</div>
              <div className="mt-1 text-[16px] font-semibold text-heading">{feedback.overall.verdict}</div>
            </div>
            <div className="rounded-xl border border-black/[0.06] bg-white/70 px-3 py-3">
              <div className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted">Score</div>
              <div className="mt-1 font-mono text-[16px] font-semibold text-heading">
                {feedback.overall.weighted_score.toFixed(1)} / {feedback.overall.max_score.toFixed(1)}
              </div>
            </div>
            <div className="rounded-xl border border-black/[0.06] bg-white/70 px-3 py-3">
              <div className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted">Domains</div>
              <div className="mt-1 text-[16px] font-semibold text-heading">{passedDomains} / {domains.length} passing</div>
            </div>
          </div>

          {lowestDomain && (
            <div className="mt-5 rounded-xl border border-amber-200/70 bg-amber-50/60 px-4 py-3 text-[13px] leading-[1.65] text-amber-900">
              <span className="font-semibold">Most useful area to open first: </span>
              {DOMAIN_META[lowestDomain.domain].label}, because it contributed {fmtScore(domainScore(lowestDomain))} / {fmtScore(domainMaxPoints(lowestDomain))} points.
            </div>
          )}

          {topMisses.length > 0 && (
            <div className="mt-5">
              <div className="mb-3 text-[11px] font-semibold uppercase tracking-[0.1em] text-muted">Highest impact misses</div>
              <div className="grid gap-3">
                {topMisses.map((missed, index) => {
                  const severity = severityLabel(missed.consequence_tier);
                  return (
                    <div key={`${missed.domain}-${missed.label}-${index}`} className="rounded-xl border border-black/[0.06] bg-white/70 px-3 py-3">
                      <div className="mb-1 flex flex-wrap items-center gap-2">
                        <span className={`rounded border px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-[0.04em] ${severity.className}`}>
                          {severity.label}
                        </span>
                        <span className="text-[12px] font-semibold text-stone-500">{DOMAIN_META[missed.domain].label}</span>
                      </div>
                      <p className="text-[13px] font-semibold leading-[1.55] text-heading">{missed.label}</p>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        <FocusNext feedback={feedback} />
      </div>
    </motion.section>
  );
}

function FeedbackColumn({
  title,
  tone,
  children,
}: {
  title: string;
  tone: 'good' | 'missed' | 'practice';
  children: React.ReactNode;
}) {
  const toneClass = {
    good: 'text-green-700',
    missed: 'text-amber-700',
    practice: 'text-stone-600',
  }[tone];

  return (
    <div className="min-w-0">
      <h4 className={`mb-3 text-[11px] font-semibold uppercase tracking-[0.09em] ${toneClass}`}>{title}</h4>
      <div className="space-y-3">{children}</div>
    </div>
  );
}

function DidWellItem({ item }: { item: DomainFeedback['what_you_did_well'][number] }) {
  return (
    <article className="border-l-2 border-green-500/30 pl-3">
      <p className="text-[13px] font-medium leading-[1.6] text-heading">{item.label}</p>
      <p className="mt-1 text-[13px] leading-[1.65] text-stone-600">{item.narrative}</p>
      <EvidenceBlock evidence={item.evidence} />
    </article>
  );
}

function MissedItem({ item }: { item: DomainFeedback['what_you_missed'][number] }) {
  const severity = severityLabel(item.consequence_tier);
  return (
    <article className="border-l-2 border-amber-500/30 pl-3">
      <div className="mb-1 flex flex-wrap items-center gap-2">
        <span className={`inline-flex rounded border px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-[0.04em] ${severity.className}`}>
          {severity.label}
        </span>
        <span className="text-[13px] font-semibold leading-[1.55] text-heading">{item.label}</span>
      </div>
      <p className="text-[13px] leading-[1.65] text-stone-600">{item.narrative}</p>
      <EvidenceBlock
        evidence={item.evidence}
        mode="missed"
        fallback="No direct transcript quote. This is marked from an area that was not covered."
      />
    </article>
  );
}

function PracticeItem({ children }: { children: React.ReactNode }) {
  return (
    <article className="rounded-xl border border-black/[0.06] bg-stone-50/70 px-3 py-3 text-[13px] leading-[1.65] text-stone-600">
      {children}
    </article>
  );
}

function DomainCard({ domain, index }: { domain: DomainFeedback; index: number }) {
  const [expanded, setExpanded] = useState(false);
  const meta = DOMAIN_META[domain.domain];
  const gc = gradeColours(domain.grade);
  const score = domainScore(domain);
  const maxPoints = domainMaxPoints(domain);
  const pct = Math.max(0, Math.min(100, (score / maxPoints) * 100));

  const didWell = expanded ? domain.what_you_did_well : domain.what_you_did_well.slice(0, 2);
  const missed = expanded ? domain.what_you_missed : domain.what_you_missed.slice(0, 4);
  const cues = expanded ? domain.cue_handling : domain.cue_handling.slice(0, 2);
  const improve = expanded ? domain.how_to_improve : domain.how_to_improve.slice(0, 3);
  const hiddenCount =
    domain.what_you_did_well.length +
    domain.what_you_missed.length +
    domain.cue_handling.length +
    domain.how_to_improve.length -
    didWell.length -
    missed.length -
    cues.length -
    improve.length;

  return (
    <motion.section
      id={domain.domain}
      className="scroll-mt-24 rounded-[22px] border border-black/[0.06] bg-white/85 shadow-[0_18px_48px_rgba(180,83,9,0.055),0_1px_3px_rgba(31,26,20,0.04)]"
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.15 + index * 0.08 }}
    >
      <header className={`rounded-t-[22px] border-b border-black/[0.06] px-5 py-4 ${meta.headerClass}`}>
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <div className="mb-2 flex flex-wrap items-center gap-2">
              <h3 className="text-[20px] font-semibold text-heading">{meta.label}</h3>
              {meta.weightLabel && (
                <span className="rounded-full border border-black/[0.06] bg-white/70 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.08em] text-stone-500">
                  {meta.weightLabel}
                </span>
              )}
              <span className={`rounded-full border px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.08em] ${gc.badge}`}>
                {GRADE_LABELS[domain.grade]}
              </span>
            </div>
            <div className="font-mono text-[13px] text-stone-500">
              {fmtScore(score)} / {fmtScore(maxPoints)} points
            </div>
          </div>
          <div className="w-full md:w-[280px]">
            <div className="mb-2 flex justify-between font-mono text-[11px] text-stone-500">
              <span>{meta.shortLabel}</span>
              <span>{Math.round(pct)}%</span>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-white/80">
              <motion.div
                className={`h-full rounded-full ${TONE_BAR_CLASS[gradeTone(domain.grade)]}`}
                initial={{ width: 0 }}
                whileInView={{ width: `${pct}%` }}
                viewport={{ once: true }}
                transition={{ duration: 0.7, ease: 'easeOut' }}
              />
            </div>
          </div>
        </div>
      </header>

      <div className="px-5 py-5">
        {domain.anchored_statements.length > 0 && (
          <div className="mb-5 flex flex-wrap gap-2">
            {domain.anchored_statements.map((statement) => (
              <span
                key={statement.title}
                className="rounded-full border border-black/[0.06] bg-stone-50 px-3 py-1 text-[11px] font-medium text-stone-500"
              >
                Assessed against: {statement.title}
              </span>
            ))}
          </div>
        )}

        <div className="grid gap-6 lg:grid-cols-[0.95fr_1.1fr_0.95fr]">
          <FeedbackColumn title="What you did well" tone="good">
            {didWell.length > 0 ? (
              didWell.map((item, i) => <DidWellItem key={`${item.label}-${i}`} item={item} />)
            ) : (
              <p className="text-[13px] leading-[1.65] text-stone-500">No clear credited items were recorded for this domain.</p>
            )}
          </FeedbackColumn>

          <FeedbackColumn title="What cost marks" tone="missed">
            {missed.length > 0 ? (
              missed.map((item, i) => <MissedItem key={`${item.label}-${i}`} item={item} />)
            ) : (
              <p className="text-[13px] leading-[1.65] text-stone-500">No major missed items were recorded for this domain.</p>
            )}

            {cues.length > 0 && (
              <div className="rounded-xl border border-amber-200/70 bg-amber-50/50 px-3 py-3">
                <h5 className="mb-2 text-[11px] font-semibold uppercase tracking-[0.08em] text-amber-700">Cue handling</h5>
                <div className="space-y-3">
                  {cues.map((cue, i) => (
                    <article key={`${cue.cue}-${i}`} className="text-[13px] leading-[1.65] text-stone-600">
                      <span className="font-semibold text-heading">{cue.status === 'explored' ? 'Explored' : 'Missed'}: </span>
                      {cue.narrative}
                      <EvidenceBlock evidence={cue.evidence} mode={cue.status === 'missed' ? 'missed' : 'supporting'} />
                    </article>
                  ))}
                </div>
              </div>
            )}
          </FeedbackColumn>

          <FeedbackColumn title="How to improve" tone="practice">
            {domain.grade_mover && (
              <PracticeItem>
                <span className="mb-1 block text-[11px] font-semibold uppercase tracking-[0.08em] text-primary">
                  Biggest grade mover
                </span>
                {domain.grade_mover.narrative}
              </PracticeItem>
            )}

            {domain.model_moment && (
              <PracticeItem>
                <span className="mb-1 block text-[11px] font-semibold uppercase tracking-[0.08em] text-stone-500">
                  Model moment
                </span>
                <span className="italic">{domain.model_moment.narrative}</span>
              </PracticeItem>
            )}

            {improve.map((item, i) => (
              <PracticeItem key={`${item.narrative}-${i}`}>{item.narrative}</PracticeItem>
            ))}

            {!domain.grade_mover && !domain.model_moment && improve.length === 0 && (
              <p className="text-[13px] leading-[1.65] text-stone-500">No extra improvement advice was recorded for this domain.</p>
            )}
          </FeedbackColumn>
        </div>

        {hiddenCount > 0 && (
          <button
            type="button"
            onClick={() => setExpanded((value) => !value)}
            className="mt-5 min-h-[44px] rounded-xl border border-black/[0.06] bg-white px-4 text-[13px] font-semibold text-primary transition hover:border-primary/25 hover:bg-primary/[0.04] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
          >
            {expanded ? 'Show less detail' : `Show ${hiddenCount} more feedback item${hiddenCount === 1 ? '' : 's'}`}
          </button>
        )}
      </div>
    </motion.section>
  );
}

/**
 * Why a report can't be shown. Each one is a different fact with a different
 * way out; they all used to render "Please try again later" with no button,
 * which was wrong for every one of them (none of the first three ever resolve
 * on their own, and the last two need a retry, not patience).
 */
type ReportProblem = 'forbidden' | 'no_transcript' | 'stalled' | 'server' | 'timeout';

function ProblemScreen({
  title,
  body,
  isTrial,
  children,
}: {
  title: string;
  body: React.ReactNode;
  isTrial: boolean;
  children?: React.ReactNode;
}) {
  return (
    <div className={`bg-surface px-6 ${isTrial ? 'py-12' : 'min-h-[100dvh] py-16'}`}>
      <div className="mx-auto max-w-md rounded-[22px] border border-black/[0.06] bg-surface-raised p-6 text-center shadow-[0_16px_42px_rgba(180,83,9,0.06)]">
        <p className="mb-2 text-[16px] font-semibold text-heading">{title}</p>
        <p className="mb-6 text-sm leading-[1.65] text-muted">{body}</p>
        <div className="flex flex-col items-center gap-3">{children}</div>
      </div>
    </div>
  );
}

function TranscriptPanel({ lines }: { lines: TranscriptLine[] }) {
  const [open, setOpen] = useState(false);

  return (
    <section className="mt-10 border-t border-black/[0.06] pt-6">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
        aria-controls="consultation-transcript"
        className="flex min-h-[44px] w-full items-center justify-between gap-4 rounded-xl px-2 text-left transition hover:bg-black/[0.02] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/35"
      >
        <span>
          <span className="block text-[16px] font-semibold text-heading">Transcript</span>
          <span className="mt-0.5 block text-[13px] text-muted">
            {lines.length} turn{lines.length === 1 ? '' : 's'} — read what you actually said against the marking above
          </span>
        </span>
        <motion.span
          aria-hidden
          animate={{ rotate: open ? 90 : 0 }}
          transition={{ duration: 0.15 }}
          className="text-[13px] font-semibold text-primary"
        >
          &rsaquo;
        </motion.span>
      </button>

      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            id="consultation-transcript"
            key="transcript-body"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="mt-4 rounded-[18px] border border-black/[0.06] bg-white/70 px-4 py-4 sm:px-5">
              <p className="mb-4 text-[12px] leading-[1.6] text-stone-500">
                Automatic speech-to-text, so wording can be slightly off. Timestamps are
                minutes and seconds from the start of the consultation.
              </p>
              <ol className="space-y-3">
                {lines.map((line) => (
                  <li
                    key={line.key}
                    className="grid grid-cols-[54px_minmax(0,1fr)] gap-3 border-l-2 pl-3"
                    style={{
                      borderColor:
                        line.speaker === 'candidate' ? 'rgba(180,83,9,0.35)' : 'rgba(0,0,0,0.10)',
                    }}
                  >
                    <span className="font-mono text-[11px] leading-[1.7] text-stone-400">
                      {formatTimestamp(line.timestampMs)}
                    </span>
                    <span className="min-w-0">
                      <span
                        className={`mr-2 text-[12px] font-semibold uppercase tracking-[0.06em] ${
                          line.speaker === 'candidate' ? 'text-primary' : 'text-stone-500'
                        }`}
                      >
                        {line.label}
                      </span>
                      <span className="text-[13px] leading-[1.7] text-stone-700">{line.text}</span>
                    </span>
                  </li>
                ))}
              </ol>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </section>
  );
}

export interface FeedbackReportProps {
  sessionId: string;
  /** 'app' renders dashboard chrome; 'trial' strips it for the free-station funnel. */
  variant?: 'app' | 'trial';
  /** Library slug the app arrived from (app variant only). */
  from?: string | null;
}

export default function FeedbackReport({ sessionId, variant = 'app', from = null }: FeedbackReportProps) {
  const isTrial = variant === 'trial';

  const [feedback, setFeedback] = useState<ConsultationFeedback | null>(null);
  const [transcript, setTranscript] = useState<TranscriptLine[]>([]);
  const [loading, setLoading] = useState(true);
  const [problem, setProblem] = useState<ReportProblem | null>(null);
  /** Station behind a session we never got a report for, so retries have a target. */
  const [failedStationId, setFailedStationId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<ReportTab>('overview');
  const retryCount = useRef(0);
  /**
   * After an explicit retry the session is still older than the stall
   * threshold, so re-reporting "stalled" on the first poll would bounce the
   * user straight back to the same screen while their retry was running.
   * Ignore the flag for the rest of that polling run and wait it out instead.
   */
  const ignoreStalled = useRef(false);
  /** Bumped by "Check again" to restart polling in place — no page refresh. */
  const [pollAttempt, setPollAttempt] = useState(0);

  const checkAgain = () => {
    retryCount.current = 0;
    ignoreStalled.current = true;
    setProblem(null);
    setLoading(true);
    setPollAttempt((n) => n + 1);
  };

  useEffect(() => {
    let cancelled = false;

    const poll = async () => {
      try {
        const shouldTrigger = retryCount.current === 0 || retryCount.current % 10 === 0;
        const res = await fetch('/api/generate-feedback', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ sessionId, trigger: shouldTrigger }),
        });
        if (cancelled) return;
        const data = await res.json().catch(() => ({} as Record<string, unknown>));

        if (typeof data.stationId === 'string') setFailedStationId(data.stationId);

        // 403: this session belongs to someone else. Polling can never fix it.
        if (res.status === 403) {
          setProblem('forbidden');
          setLoading(false);
          return;
        }

        if (data.status === 'ready' && data.feedback) {
          setFeedback(data.feedback);
          setTranscript(normaliseTranscript(data.transcript));
          setLoading(false);
          return;
        }

        // The consultation captured nothing, so there is nothing to mark — the
        // route computes this precisely so the page can stop polling and say so.
        if (data.status === 'no_transcript') {
          setProblem('no_transcript');
          setLoading(false);
          return;
        }

        if (data.status === 'generating' || res.status === 404) {
          // Terminal session, transcript present, over an hour old: the marking
          // run died. Offer a retry rather than another five minutes of spinner.
          if (data.stalled && !ignoreStalled.current) {
            setProblem('stalled');
            setLoading(false);
            return;
          }
          retryCount.current += 1;
          if (retryCount.current >= MAX_RETRIES) {
            setProblem('timeout');
            setLoading(false);
            return;
          }
          setTimeout(poll, POLL_INTERVAL_MS);
          return;
        }
        setProblem('server');
        setLoading(false);
      } catch {
        if (cancelled) return;
        retryCount.current += 1;
        if (retryCount.current >= MAX_RETRIES) {
          setProblem('timeout');
          setLoading(false);
          return;
        }
        setTimeout(poll, POLL_INTERVAL_MS);
      }
    };

    const timer = setTimeout(poll, 1200);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [sessionId, pollAttempt]);

  const orderedDomains = useMemo(() => {
    if (!feedback) return [];
    return DOMAIN_NAV
      .map((key) => feedback.domains.find((domain) => domain.domain === key))
      .filter(Boolean) as DomainFeedback[];
  }, [feedback]);

  if (loading) return <LoadingState compact={isTrial} />;

  if (problem || !feedback) {
    const retryHref = failedStationId
      ? `/clinical-master/station/${failedStationId}${from ? `?from=${from}` : ''}`
      : null;
    const retryButton = (
      <button
        type="button"
        onClick={checkAgain}
        className="inline-flex min-h-[44px] items-center justify-center rounded-full bg-primary px-6 py-3 text-sm font-semibold text-white transition hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
      >
        {problem === 'timeout' ? 'Check again' : 'Try again'}
      </button>
    );
    const historyLink = !isTrial && (
      <Link href="/dashboard/history" className="text-sm font-semibold text-primary hover:underline">
        Go to my history
      </Link>
    );
    const dashboardLink = !isTrial && (
      <Link href="/dashboard" className="text-sm font-semibold text-muted hover:text-heading hover:underline">
        Back to dashboard
      </Link>
    );

    if (problem === 'forbidden') {
      return (
        <ProblemScreen
          isTrial={isTrial}
          title="This feedback isn't on this account"
          body="The consultation was run on a different account, so we can't show its report here. Everything you have practised is listed in your own history."
        >
          {historyLink}
          {dashboardLink}
        </ProblemScreen>
      );
    }

    if (problem === 'no_transcript') {
      return (
        <ProblemScreen
          isTrial={isTrial}
          title="This consultation wasn't recorded"
          body="Nothing was captured from your microphone, so there is nothing to mark. That usually means mic access was blocked, or the connection dropped before the consultation got going. Marking this one isn't possible, but the case is still there to practise."
        >
          {retryHref && (
            <Link
              href={retryHref}
              className="inline-flex min-h-[44px] items-center justify-center rounded-full bg-primary px-6 py-3 text-sm font-semibold text-white transition hover:opacity-90"
            >
              Practise this case again
            </Link>
          )}
          {historyLink}
        </ProblemScreen>
      );
    }

    if (problem === 'stalled') {
      return (
        <ProblemScreen
          isTrial={isTrial}
          title="Marking didn't finish"
          body="Marking normally takes a minute or two, and this consultation has been waiting far longer — so the run failed rather than being slow. Your transcript is safe; starting marking again is usually all it takes."
        >
          <button
            type="button"
            onClick={checkAgain}
            className="inline-flex min-h-[44px] items-center justify-center rounded-full bg-primary px-6 py-3 text-sm font-semibold text-white transition hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
          >
            Start marking again
          </button>
          {historyLink}
        </ProblemScreen>
      );
    }

    if (problem === 'timeout') {
      return (
        <ProblemScreen
          isTrial={isTrial}
          title="Feedback is taking longer than usual"
          body="It may still be finishing in the background. No need to reload the page — just check again."
        >
          {retryButton}
          {dashboardLink}
        </ProblemScreen>
      );
    }

    return (
      <ProblemScreen
        isTrial={isTrial}
        title="Something went wrong loading this feedback"
        body={
          <>
            This one is on us, and nothing about your consultation has been lost. Try again,
            and if it keeps happening email{' '}
            <a href="mailto:hello@fourteenfisherman.com" className="font-semibold text-primary hover:underline">
              hello@fourteenfisherman.com
            </a>{' '}
            and we&apos;ll mark it by hand.
          </>
        }
      >
        {retryButton}
        {historyLink}
      </ProblemScreen>
    );
  }

  return (
    <main className="min-h-[100dvh] bg-surface font-sans">
      <div className="mx-auto max-w-[1180px] px-5 py-8 sm:px-7 lg:px-10 lg:py-10">
        <motion.header
          className="mb-8"
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ type: 'spring', stiffness: 70, damping: 20 }}
        >
          {!isTrial && (
            <nav className="mb-5 flex flex-wrap items-center gap-2 text-[12px] font-medium text-muted">
              <Link href="/dashboard/library" className="hover:text-primary">Cases</Link>
              <span>/</span>
              <span>Feedback</span>
            </nav>
          )}
          <div className="flex flex-col gap-5 md:flex-row md:items-end md:justify-between">
            <div>
              <div className="mb-3 text-[11px] font-semibold uppercase tracking-[0.12em] text-primary">
                Session complete
              </div>
              <h1 className="max-w-[780px] text-[34px] font-semibold leading-[1.08] text-heading sm:text-[44px]">
                {feedback.station_title || 'Consultation feedback'}
              </h1>
            </div>
            <div className="flex flex-wrap gap-2 text-[12px] text-stone-500">
              <span className="rounded-full border border-black/[0.06] bg-white/70 px-3 py-1.5">Audio consultation</span>
              <span className="rounded-full border border-black/[0.06] bg-white/70 px-3 py-1.5">
                {passMarkCaption(feedback.overall.max_score)}
              </span>
            </div>
          </div>
        </motion.header>

        <VerdictPanel feedback={feedback} />

        {feedback.confidence && feedback.confidence.transcript_quality !== 'high' && (
          <div className="mt-5 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-[13px] leading-[1.6] text-amber-800">
            Transcript confidence was {feedback.confidence.transcript_quality}. Some feedback is given with caution.
            {feedback.confidence.notes ? ` ${feedback.confidence.notes}` : ''}
          </div>
        )}

        <div className="mt-8">
          <div className="mb-3 flex items-center justify-between gap-4">
            <h2 className="text-[18px] font-semibold text-heading">Domain score summary</h2>
            <p className="hidden text-[12px] text-muted sm:block">Data /3, Management /4.5, Relating /3</p>
          </div>
          <ScoreBreakdown domains={orderedDomains} />
        </div>

        <section className="mt-8">
          <div className="mb-4">
            <h2 className="text-[22px] font-semibold text-heading">Report detail</h2>
            <p className="mt-1 max-w-[720px] text-[14px] leading-[1.65] text-stone-600">
              Start with the overview, then switch into a single domain for detailed evidence and practice advice.
            </p>
          </div>
          <ReportTabs activeTab={activeTab} onChange={setActiveTab} domains={orderedDomains} />
          <div className="mt-5">
            <AnimatePresence mode="wait">
              {activeTab === 'overview' ? (
                <OverviewPanel key="overview" feedback={feedback} domains={orderedDomains} />
              ) : (
                orderedDomains
                  .filter((domain) => domain.domain === activeTab)
                  .map((domain) => (
                    <DomainCard key={domain.domain} domain={domain} index={0} />
                  ))
              )}
            </AnimatePresence>
          </div>
        </section>

        {transcript.length > 0 && <TranscriptPanel lines={transcript} />}

        {!isTrial && (
          <div className="mt-10 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <Link href={from ? `/dashboard/library/${from}` : '/dashboard/library'}>
              <PrimaryButton>Practice another case</PrimaryButton>
            </Link>
            {feedback.station_id && (
              <Link
                href={`/clinical-master/station/${feedback.station_id}${from ? `?from=${from}` : ''}`}
                className="min-h-[44px] rounded-xl px-4 py-3 text-[13px] font-semibold text-primary transition hover:bg-primary/[0.06]"
              >
                Retry this case
              </Link>
            )}
            <Link
              href="/dashboard"
              className="min-h-[44px] rounded-xl px-4 py-3 text-[13px] font-semibold text-muted transition hover:bg-stone-100 hover:text-heading"
            >
              Back to dashboard
            </Link>
          </div>
        )}
      </div>
    </main>
  );
}
