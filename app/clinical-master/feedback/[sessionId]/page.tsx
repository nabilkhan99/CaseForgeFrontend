'use client';

import { useParams, useSearchParams } from 'next/navigation';
import { useEffect, useMemo, useRef, useState, Suspense } from 'react';
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

const MAX_RETRIES = 30;
const DOMAIN_NAV: DomainKey[] = ['data_gathering', 'clinical_management', 'relating_to_others'];
type ReportTab = 'overview' | DomainKey;

const DOMAIN_META: Record<DomainKey, {
  label: string;
  shortLabel: string;
  maxPoints: number;
  weightLabel?: string;
  headerClass: string;
  barClass: string;
  softClass: string;
}> = {
  data_gathering: {
    label: 'Data gathering',
    shortLabel: 'Data',
    maxPoints: 3,
    headerClass: 'bg-amber-50/70',
    barClass: 'bg-primary',
    softClass: 'bg-primary/[0.06] text-primary border-primary/15',
  },
  clinical_management: {
    label: 'Clinical management',
    shortLabel: 'Management',
    maxPoints: 4.5,
    weightLabel: 'weighted 1.5x',
    headerClass: 'bg-red-50/60',
    barClass: 'bg-danger',
    softClass: 'bg-red-50 text-red-700 border-red-200/70',
  },
  relating_to_others: {
    label: 'Relating to others',
    shortLabel: 'Relating',
    maxPoints: 3,
    headerClass: 'bg-green-50/60',
    barClass: 'bg-success',
    softClass: 'bg-green-50 text-green-700 border-green-200/70',
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
  if (verdict === 'Pass') {
    return {
      text: 'text-green-700',
      badge: 'bg-green-50 text-green-700 border-green-200',
      bar: 'bg-success',
    };
  }
  if (verdict === 'Bare Pass') {
    return {
      text: 'text-lime-700',
      badge: 'bg-lime-50 text-lime-700 border-lime-200',
      bar: 'bg-lime-600',
    };
  }
  if (verdict === 'Bare Fail') {
    return {
      text: 'text-primary',
      badge: 'bg-amber-50 text-amber-700 border-amber-200',
      bar: 'bg-primary',
    };
  }
  return passing
    ? {
      text: 'text-green-700',
      badge: 'bg-green-50 text-green-700 border-green-200',
      bar: 'bg-success',
    }
    : {
      text: 'text-red-700',
      badge: 'bg-red-50 text-red-700 border-red-200',
      bar: 'bg-danger',
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

function LoadingState() {
  return (
    <div className="min-h-[100dvh] bg-surface px-5 py-10">
      <div className="mx-auto max-w-[1120px] animate-pulse">
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
        <p className="mt-6 text-sm text-muted">Marking your consultation...</p>
      </div>
    </div>
  );
}

function DomainMiniRow({ domain }: { domain: DomainFeedback }) {
  const meta = DOMAIN_META[domain.domain];
  const score = domainScore(domain);
  const maxPoints = domainMaxPoints(domain);
  const pct = Math.max(0, Math.min(100, (score / maxPoints) * 100));
  const gc = gradeColours(domain.grade);

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
          <div className={`h-full rounded-full ${meta.barClass}`} style={{ width: `${pct}%` }} />
        </div>
      </div>
      <div className="text-right">
        <div className="font-mono text-[13px] font-semibold text-heading">
          {fmtScore(score)}<span className="text-stone-400">/{fmtScore(maxPoints)}</span>
        </div>
        <span className={`mt-1 inline-flex rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase ${gc.badge}`}>
          {GRADE_LABELS[domain.grade]}
        </span>
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
  const pct = Math.max(0, Math.min(100, (overall.weighted_score / (overall.max_score || 10.5)) * 100));
  const duration = fmtDuration(feedback.timing?.total_duration_ms);

  return (
    <section className="grid gap-5 rounded-[24px] border border-black/[0.06] bg-white/80 p-5 shadow-[0_20px_60px_rgba(180,83,9,0.07),0_2px_4px_rgba(0,0,0,0.04)] md:p-6 lg:grid-cols-[250px_minmax(0,1fr)_240px]">
      <div className="rounded-[18px] bg-surface px-5 py-4">
        <div className="mb-3 text-[11px] font-semibold uppercase tracking-[0.1em] text-muted">Final verdict</div>
        <div className={`font-serif text-[40px] leading-none ${vc.text}`}>{overall.verdict}</div>
        <div className="mt-3 flex items-end gap-2 font-mono text-heading">
          <span className="text-[24px] font-semibold">{overall.weighted_score.toFixed(1)}</span>
          <span className="pb-1 text-[13px] text-stone-400">/ {overall.max_score.toFixed(1)}</span>
        </div>
        <div className="mt-4 h-2 overflow-hidden rounded-full bg-stone-200">
          <motion.div
            className={`h-full rounded-full ${vc.bar}`}
            initial={{ width: 0 }}
            animate={{ width: `${pct}%` }}
            transition={{ duration: 0.8, ease: 'easeOut' }}
          />
        </div>
      </div>

      <div className="flex min-w-0 flex-col justify-center">
        <div>
          <div className="mb-3 flex flex-wrap items-center gap-2">
            <span className={`inline-flex rounded-full border px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.08em] ${vc.badge}`}>
              {overall.verdict}
            </span>
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
            <span>{tab.label}</span>
            {tab.grade && (
              <span className={`ml-2 rounded-full border px-1.5 py-0.5 text-[9px] uppercase ${
                active ? 'border-white/25 text-white/80' : gradeColours(tab.grade).badge
              }`}>
                {GRADE_LABELS[tab.grade]}
              </span>
            )}
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
                className={`h-full rounded-full ${meta.barClass}`}
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

function FeedbackContent() {
  const params = useParams();
  const searchParams = useSearchParams();
  const sessionId = params.sessionId as string;
  const from = searchParams.get('from');

  const [feedback, setFeedback] = useState<ConsultationFeedback | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [timedOut, setTimedOut] = useState(false);
  const [activeTab, setActiveTab] = useState<ReportTab>('overview');
  const retryCount = useRef(0);

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
        const data = await res.json();

        if (data.status === 'ready' && data.feedback) {
          setFeedback(data.feedback);
          setLoading(false);
          return;
        }
        if (data.status === 'generating' || res.status === 404) {
          retryCount.current += 1;
          if (retryCount.current >= MAX_RETRIES) {
            setTimedOut(true);
            setLoading(false);
            return;
          }
          setTimeout(poll, 3000);
          return;
        }
        setError(true);
        setLoading(false);
      } catch {
        if (cancelled) return;
        retryCount.current += 1;
        if (retryCount.current >= MAX_RETRIES) {
          setTimedOut(true);
          setLoading(false);
          return;
        }
        setTimeout(poll, 3000);
      }
    };

    const timer = setTimeout(poll, 1200);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [sessionId]);

  const orderedDomains = useMemo(() => {
    if (!feedback) return [];
    return DOMAIN_NAV
      .map((key) => feedback.domains.find((domain) => domain.domain === key))
      .filter(Boolean) as DomainFeedback[];
  }, [feedback]);

  if (loading) return <LoadingState />;

  if (timedOut) {
    return (
      <div className="min-h-[100dvh] bg-surface px-6 py-16">
        <div className="mx-auto max-w-md rounded-[22px] border border-black/[0.06] bg-surface-raised p-6 text-center shadow-[0_16px_42px_rgba(180,83,9,0.06)]">
          <p className="mb-2 text-[16px] font-semibold text-heading">Feedback is still processing</p>
          <p className="mb-6 text-sm leading-[1.65] text-muted">
            The report may still finish in the background. Check again from your dashboard shortly.
          </p>
          <Link href="/dashboard" className="text-sm font-semibold text-primary hover:underline">
            Back to dashboard
          </Link>
        </div>
      </div>
    );
  }

  if (error || !feedback) {
    return (
      <div className="min-h-[100dvh] bg-surface px-6 py-16">
        <div className="mx-auto max-w-md rounded-[22px] border border-black/[0.06] bg-surface-raised p-6 text-center shadow-[0_16px_42px_rgba(180,83,9,0.06)]">
          <p className="mb-2 text-[16px] font-semibold text-heading">Unable to load feedback</p>
          <p className="mb-6 text-sm leading-[1.65] text-muted">Please try again later.</p>
          <Link href="/dashboard" className="text-sm font-semibold text-primary hover:underline">
            Return to dashboard
          </Link>
        </div>
      </div>
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
          <nav className="mb-5 flex flex-wrap items-center gap-2 text-[12px] font-medium text-muted">
            <Link href="/dashboard/library" className="hover:text-primary">Cases</Link>
            <span>/</span>
            <span>Feedback</span>
          </nav>
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
              <span className="rounded-full border border-black/[0.06] bg-white/70 px-3 py-1.5">Total / 10.5</span>
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
      </div>
    </main>
  );
}

export default function FeedbackPage() {
  return (
    <Suspense fallback={<LoadingState />}>
      <FeedbackContent />
    </Suspense>
  );
}
