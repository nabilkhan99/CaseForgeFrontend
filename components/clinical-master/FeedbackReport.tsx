'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
} from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import Link from 'next/link';
import { BlurFade } from '@/components/magicui/blur-fade';
import ArcGauge from '@/components/ui/ArcGauge';
import PrimaryButton from '@/components/ui/PrimaryButton';
import StageProgressList from '@/components/ui/StageProgressList';
import {
  ConsultationFeedback,
  DomainFeedback,
  DomainKey,
  Evidence,
  GRADE_LABELS,
  Overall,
  PASSING_VERDICTS,
  Verdict,
} from '@/lib/clinical-master/types';
import PassCelebration from '@/components/clinical-master/PassCelebration';
import { LearningPointsDisplay } from '@/components/cases/LearningPoints';
import { MarkSchemeDomains } from '@/components/cases/MarkScheme';
import {
  TONE_BAR_CLASS,
  TONE_COLOUR,
  fmtMark,
  gradeTone,
  passMarkCaption,
  passMarkFor,
  passMarkSentence,
  verdictTone,
} from '@/lib/clinical-master/scoring';
import {
  findTranscriptAnchor,
  formatTimestamp,
  normaliseTranscript,
  spokenTimestamp,
  transcriptTurnId,
  type TranscriptLine,
} from '@/lib/clinical-master/transcript';

/**
 * Page-load stagger for the report's top-level sections, top to bottom. Kept
 * tight: someone reading their own mark should not be waiting on a reveal.
 */
const REVEAL = {
  header: 0,
  verdict: 0.06,
  overview: 0.12,
  breakdown: 0.18,
  learning: 0.24,
} as const;

/**
 * One entry animation per section, skipped entirely under
 * prefers-reduced-motion — BlurFade has no reduced-motion handling of its own,
 * so the gate lives here at the call site and renders the final state.
 */
function Reveal({
  delay,
  className,
  children,
}: {
  delay: number;
  className?: string;
  children: React.ReactNode;
}) {
  const shouldReduceMotion = useReducedMotion();
  if (shouldReduceMotion) {
    return <div className={className}>{children}</div>;
  }
  return (
    <BlurFade delay={delay} className={className}>
      {children}
    </BlurFade>
  );
}

/** Poll interval, ms. */
const POLL_INTERVAL_MS = 3000;
/**
 * Give-up threshold. Marking has been measured at roughly 80 to 90 seconds, and
 * the old budget (30 × 3s = 90s) gave up right on top of that, so an ordinary
 * slow run fell through to the "still processing" screen and sent people into a
 * refresh loop. 100 × 3s = 5 minutes leaves generous headroom; past that the run
 * is genuinely stuck, not just slow. This figure stays in the code, where it is
 * a tuning constant — it is not a duration we quote to the user.
 */
const MAX_RETRIES = 100;

/**
 * The stages the marking run actually passes through, in order, checked against
 * MarkingService.mark in CaseForgeAzure (app/services/marking_service.py):
 * load the session and its transcript, map the station row onto the case pack,
 * one model pass that grades all three SCA domains and anchors each point to a
 * transcript quote, then compute_verdict() from the three grades plus any
 * tier-3 override. Nothing here is a duration or a completion claim — see the
 * note on StageProgressList for why the pacing is a pace, not a measurement.
 */
const MARKING_STAGES = [
  'Reading your transcript',
  'Loading the case notes for this station',
  'Grading the three SCA domains',
  'Pulling the evidence for each point',
  'Working out your verdict',
] as const;
/**
 * Pace, not a promise. Marking has been measured at roughly 80 to 90 seconds,
 * so five stages at 16s each light up across the usual run and the last one
 * holds for as long as the run does.
 */
const MARKING_STAGE_MS = 16000;

const DOMAIN_NAV: DomainKey[] = ['data_gathering', 'clinical_management', 'relating_to_others'];

/**
 * Score dial diameter, in px.
 *
 * The trial funnel gets a smaller one on purpose: the pricing table renders
 * directly beneath this report, so every pixel spent above it pushes the offer
 * further down the page.
 */
const GAUGE_SIZE = { app: 224, trial: 184 } as const;

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

/**
 * How long a jumped-to transcript turn stays flagged, ms. Long enough to find
 * with your eye after the scroll settles, short enough not to become chrome.
 */
const JUMP_FLAG_MS = 2400;
/**
 * The transcript body animates open over 0.2s (see TranscriptPanel), and
 * scrolling into a box that is still growing lands on a moving target. The jump
 * waits for it to settle. Paid even when the panel was already open: it is
 * imperceptible next to the scroll itself, and it keeps one code path rather
 * than two that differ only in a timeout.
 */
const TRANSCRIPT_SETTLE_MS = 220;

/**
 * How an evidence timestamp reaches the transcript.
 *
 * EvidenceBlock renders four levels below the report, so this is a context
 * rather than four layers of prop drilling. Null when the report has no
 * transcript to jump into — then the timestamps stay plain text, because a
 * control that goes nowhere is worse than no control.
 */
interface TranscriptJump {
  /** DOM id of the turn this evidence points at, or null when nothing lines up. */
  anchorFor: (evidence: Evidence) => string | null;
  /** Open the transcript if needed, scroll that turn into view, flag it. */
  jumpTo: (anchorId: string) => void;
}

const TranscriptJumpContext = createContext<TranscriptJump | null>(null);

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

/**
 * Grade colour, carried by the tint and the text only.
 *
 * The borders used to be tinted too (`border-green-200`, `border-amber-200`),
 * which drew a hard coloured outline around every graded thing and made the
 * report read as a wall of warning boxes. `border-hairline` is the house edge
 * for a passive surface; the tint still says which grade it is.
 */
function gradeColours(grade: DomainFeedback['grade']): {
  badge: string;
  text: string;
} {
  if (grade === 'CP') {
    return { badge: 'bg-green-50 text-green-700 border-hairline', text: 'text-green-700' };
  }
  if (grade === 'P') {
    return { badge: 'bg-lime-50 text-lime-700 border-hairline', text: 'text-lime-700' };
  }
  if (grade === 'F') {
    return { badge: 'bg-amber-50 text-amber-700 border-hairline', text: 'text-amber-700' };
  }
  return { badge: 'bg-red-50 text-red-700 border-hairline', text: 'text-red-700' };
}

/**
 * The domain that lost the most, proportionally.
 *
 * Both the overview's "read this one first" line and the tab that opens by
 * default come from here, so the page cannot recommend one domain and then
 * open a different one. Ties keep DOMAIN_NAV order — Array.sort is stable.
 */
function lowestScoringDomain(domains: DomainFeedback[]): DomainFeedback | undefined {
  return domains
    .slice()
    .sort((a, b) => (domainScore(a) / domainMaxPoints(a)) - (domainScore(b) / domainMaxPoints(b)))[0];
}

function verdictColours(verdict: Verdict): {
  text: string;
  badge: string;
} {
  const passing = PASSING_VERDICTS.includes(verdict);
  if (verdict === 'Pass') {
    return { text: 'text-green-700', badge: 'bg-green-50 text-green-700 border-hairline' };
  }
  if (verdict === 'Bare Pass') {
    return { text: 'text-lime-700', badge: 'bg-lime-50 text-lime-700 border-hairline' };
  }
  if (verdict === 'Bare Fail') {
    return { text: 'text-primary', badge: 'bg-amber-50 text-amber-700 border-hairline' };
  }
  return passing
    ? { text: 'text-green-700', badge: 'bg-green-50 text-green-700 border-hairline' }
    : { text: 'text-red-700', badge: 'bg-red-50 text-red-700 border-hairline' };
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

/**
 * The moment a quote was said — as a control that takes you there.
 *
 * Three states, in order of how much we actually know:
 *  - no timestamp (common: `timestamp_ms` is optional and often null) — render
 *    nothing at all, rather than a chip reading 00:00 that jumps to the top;
 *  - a timestamp we cannot place in the transcript (or no transcript on this
 *    report) — the plain mono stamp this used to be, since the time is still
 *    true even when there is nowhere to send you;
 *  - a timestamp matched to a turn — a real button.
 */
function EvidenceTimestamp({ evidence }: { evidence: Evidence }) {
  const jump = useContext(TranscriptJumpContext);
  const stamp = formatTimestamp(evidence.timestamp_ms);
  if (!stamp) return null;

  const anchorId = jump?.anchorFor(evidence) ?? null;
  if (!jump || !anchorId) {
    return <span className="font-mono tracking-normal">[{stamp}]</span>;
  }

  return (
    <button
      type="button"
      onClick={() => jump.jumpTo(anchorId)}
      // "04:12" alone is read as punctuation and says nothing about what the
      // control does; the visible text stays short.
      aria-label={`Jump to ${spokenTimestamp(evidence.timestamp_ms)} in the transcript`}
      // `border-defined` rather than the passive `border-hairline` used by the
      // static stamp: the tailwind config reserves `defined` for interactive
      // edges, and this is now the one thing in the quote you can click.
      // min-h-[44px] is the house touch target — it makes this row taller than
      // the mono prefix it replaces, which is the cost of the chip being real.
      className="inline-flex min-h-[44px] items-center gap-1.5 rounded-[6px] border border-defined bg-white px-2.5 py-1 font-mono text-[11px] tracking-normal text-primary transition hover:border-primary/30 hover:bg-primary/[0.05] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/35"
    >
      {stamp}
      <span aria-hidden className="text-[13px] leading-none text-primary/50">&rsaquo;</span>
    </button>
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
      <div className="mt-3 rounded-[10px] border border-hairline bg-stone-50/80 px-3 py-2 text-[13px] leading-[1.55] text-stone-500">
        {absenceCopy}
      </div>
    );
  }

  if (mode === 'missed' && looksLikeNonEvidenceQuote(evidence.quote)) {
    return (
      <div className="mt-3 rounded-[10px] border border-hairline bg-stone-50/80 px-3 py-2 text-[13px] leading-[1.55] text-stone-500">
        No useful direct quote for this missed item. This is marked from what was not explored.
      </div>
    );
  }

  return (
    <blockquote className="mt-3 rounded-[10px] border border-hairline bg-white/80 px-3 py-2 text-[13px] leading-[1.65] text-stone-600 shadow-elevation-1">
      <div className="mb-1 flex flex-wrap items-center gap-2 text-[11px] font-medium uppercase tracking-[0.08em] text-stone-400">
        <EvidenceTimestamp evidence={evidence} />
        {evidence.speaker && <span>{evidence.speaker}</span>}
      </div>
      <span className="italic">&ldquo;{evidence.quote}&rdquo;</span>
    </blockquote>
  );
}

/**
 * The marking wait.
 *
 * This component knows exactly two things: that a marking run was triggered,
 * and that no result row has arrived yet. Marking happens on Azure and reports
 * nothing back in between, so every number about time or completion that could
 * appear here would be invented here.
 *
 * It used to invent one: a percentage eased asymptotically toward 92, a
 * determinate bar bound to it, and an aria-valuenow announcing it to screen
 * readers. Someone whose run had died silently watched a confident 91% climb to
 * 92% and stop, indistinguishable from a run about to finish. What replaced it
 * claims only what is true — an indeterminate sweep that says "working", and a
 * log of stages the marking service genuinely runs through (see MARKING_STAGES).
 */
function MarkingProgress({ compact = false }: { compact?: boolean }) {
  const shouldReduceMotion = useReducedMotion();

  return (
    <div className="mt-6">
      <p className="mb-3 text-sm text-muted">Marking your consultation…</p>

      {/* Indeterminate: a sweep with no width binding, so there is no value to
          read off it. Decorative — the stage list below carries the meaning. */}
      <div
        className="mb-4 h-1.5 w-full overflow-hidden rounded-full bg-primary/10"
        aria-hidden="true"
      >
        {shouldReduceMotion ? (
          <div className="h-full w-full rounded-full bg-primary/25" />
        ) : (
          <motion.div
            className="h-full rounded-full"
            style={{ background: 'linear-gradient(90deg, #B45309, #D97706)' }}
            initial={{ x: '-100%' }}
            animate={{ x: '100%' }}
            transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut', repeatDelay: 0.5 }}
          />
        )}
      </div>

      <StageProgressList
        stages={MARKING_STAGES}
        stageMs={MARKING_STAGE_MS}
        label="Marking stages"
      />

      <p className="mt-4 text-xs text-stone-400">
        {compact
          ? 'Your plan options are below. No need to refresh — this page updates on its own when marking finishes.'
          : 'Marking runs on our servers, so you can close this tab. This consultation is already in your history, and its report opens from there once it is marked.'}
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
            <div className="mb-4 h-12 w-full max-w-[560px] rounded-[10px] bg-stone-200/70" />
            <div className="h-40 rounded-[16px] bg-white/70" />
          </div>
          <MarkingProgress compact />
        </div>
      </div>
    );
  }
  // The live status renders ABOVE the body skeletons. With it underneath, a
  // phone stacked ~1,100px of grey blocks first and the entire first screen
  // said nothing — the one page a candidate reaches straight after speaking
  // for twelve minutes. The skeleton grid stays as a preview of the report,
  // but the words come first at every width.
  return (
    <div className="min-h-[100dvh] bg-surface px-5 py-10">
      <div className="mx-auto max-w-[1120px]">
        <div className="animate-pulse">
          <div className="mb-8 h-5 w-48 rounded-full bg-stone-200/70" />
          <div className="h-12 w-full max-w-[560px] rounded-[10px] bg-stone-200/70" />
        </div>
        <MarkingProgress />
        <div className="mt-10 animate-pulse" aria-hidden="true">
          <div className="grid gap-5 lg:grid-cols-[1.1fr_0.9fr]">
            <div className="h-72 rounded-[10px] bg-white/70" />
            <div className="h-72 rounded-[10px] bg-white/70" />
          </div>
          <div className="mt-8 grid gap-4 md:grid-cols-3">
            <div className="h-28 rounded-[10px] bg-white/70" />
            <div className="h-28 rounded-[10px] bg-white/70" />
            <div className="h-28 rounded-[10px] bg-white/70" />
          </div>
        </div>
      </div>
    </div>
  );
}

/**
 * One domain's summary — and the control that opens its detail.
 *
 * These three used to be non-interactive summary cards, with a separate row of
 * four text tabs underneath repeating the same three names. The card already
 * carried the score, the bar and the weighting; making it the tab removes the
 * duplicate row and puts the click where the eye already is.
 */
function DomainTab({
  domain,
  active,
  tabId,
  panelId,
  onSelect,
  onKeyDown,
  buttonRef,
}: {
  domain: DomainFeedback;
  active: boolean;
  tabId: string;
  panelId: string;
  onSelect: () => void;
  onKeyDown: (event: React.KeyboardEvent<HTMLButtonElement>) => void;
  buttonRef: (element: HTMLButtonElement | null) => void;
}) {
  const meta = DOMAIN_META[domain.domain];
  const score = domainScore(domain);
  const maxPoints = domainMaxPoints(domain);
  const pct = Math.max(0, Math.min(100, (score / maxPoints) * 100));

  return (
    <button
      type="button"
      role="tab"
      id={tabId}
      ref={buttonRef}
      aria-selected={active}
      aria-controls={panelId}
      // Roving tabindex: one stop for the whole tablist, arrows move within it.
      tabIndex={active ? 0 : -1}
      onClick={onSelect}
      onKeyDown={onKeyDown}
      className={`grid min-h-[44px] grid-cols-[minmax(0,1fr)_auto] gap-3 rounded-[12px] border px-4 py-3.5 text-left transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/35 ${
        active
          ? 'border-defined bg-white shadow-elevation-2'
          : 'border-hairline bg-white/60 hover:border-defined hover:bg-white'
      }`}
    >
      <span className="min-w-0">
        <span className="mb-2 flex items-center gap-2">
          <span className={`truncate text-[13px] ${active ? 'font-semibold' : 'font-medium'} text-heading`}>
            {meta.label}
          </span>
          {meta.weightLabel && (
            <span className="rounded-full bg-stone-100 px-2 py-0.5 text-[11px] font-medium uppercase tracking-[0.08em] text-stone-500">
              weighted
            </span>
          )}
        </span>
        <span className="block h-1.5 overflow-hidden rounded-full bg-stone-200/80">
          <span
            className={`block h-full rounded-full ${TONE_BAR_CLASS[gradeTone(domain.grade)]}`}
            style={{ width: `${pct}%` }}
          />
        </span>
      </span>
      {/* S3: a score is information; a per-domain verdict badge alongside the
          overall verdict was the same judgement said four times. The bar is
          already grade-toned, and the grade stays available to screen readers. */}
      <span className="text-right">
        <span className="block font-mono text-[15px] font-medium tabular-nums text-heading">
          {fmtScore(score)}<span className="text-[13px] text-stone-400">/{fmtScore(maxPoints)}</span>
        </span>
        <span className="sr-only">{GRADE_LABELS[domain.grade]}</span>
      </span>
    </button>
  );
}

function DomainTabs({
  domains,
  active,
  onChange,
  tabId,
  panelId,
}: {
  domains: DomainFeedback[];
  active: DomainKey | null;
  onChange: (domain: DomainKey) => void;
  tabId: (domain: DomainKey) => string;
  panelId: string;
}) {
  const buttons = useRef<Partial<Record<DomainKey, HTMLButtonElement | null>>>({});

  function move(index: number, event: React.KeyboardEvent<HTMLButtonElement>) {
    const keys = domains.map((domain) => domain.domain);
    let next: number;
    if (event.key === 'ArrowRight' || event.key === 'ArrowDown') next = (index + 1) % keys.length;
    else if (event.key === 'ArrowLeft' || event.key === 'ArrowUp') next = (index - 1 + keys.length) % keys.length;
    else if (event.key === 'Home') next = 0;
    else if (event.key === 'End') next = keys.length - 1;
    else return;

    event.preventDefault();
    const key = keys[next];
    onChange(key);
    buttons.current[key]?.focus();
  }

  return (
    <div role="tablist" aria-label="Domain breakdown" className="grid gap-3 md:grid-cols-3">
      {domains.map((domain, index) => (
        <DomainTab
          key={domain.domain}
          domain={domain}
          active={active === domain.domain}
          tabId={tabId(domain.domain)}
          panelId={panelId}
          onSelect={() => onChange(domain.domain)}
          onKeyDown={(event) => move(index, event)}
          buttonRef={(element) => {
            buttons.current[domain.domain] = element;
          }}
        />
      ))}
    </div>
  );
}

type CaseNoteTab = 'learning' | 'markscheme';

/**
 * The case's own teaching material, tabbed.
 *
 * Both halves used to live only on the public case page, so trainees finished a
 * consultation and then went hunting for the same case under /sca-cases to read
 * them — the free cases and the AI stations are the same rows, so the notes were
 * always attached to the case they had just sat. Rendered as one flat section
 * this ran to several screens; tabs keep it to one.
 *
 * The learning points and the mark scheme render through the same components as
 * the public case page, so the two surfaces cannot drift apart.
 */
function CaseNotes({ feedback }: { feedback: ConsultationFeedback }) {
  const learning = feedback.clinical_learning_points ?? null;
  const scheme = feedback.mark_scheme ?? null;
  const hasScheme = Boolean(
    scheme && (scheme.data_gathering || scheme.clinical_management || scheme.relating_to_others)
  );

  const tabs = useMemo(
    () =>
      [
        ...(learning ? ([{ id: 'learning', label: 'Learning points' }] as const) : []),
        ...(hasScheme ? ([{ id: 'markscheme', label: 'Mark scheme' }] as const) : []),
      ] as { id: CaseNoteTab; label: string }[],
    [learning, hasScheme]
  );

  const [active, setActive] = useState<CaseNoteTab>(learning ? 'learning' : 'markscheme');
  const buttons = useRef<Partial<Record<CaseNoteTab, HTMLButtonElement | null>>>({});
  const baseId = useId();
  const tabIdFor = (id: CaseNoteTab) => `${baseId}-tab-${id}`;
  const panelIdFor = (id: CaseNoteTab) => `${baseId}-panel-${id}`;

  if (tabs.length === 0) return null;

  function move(index: number, event: React.KeyboardEvent<HTMLButtonElement>) {
    let next: number;
    if (event.key === 'ArrowRight' || event.key === 'ArrowDown') next = (index + 1) % tabs.length;
    else if (event.key === 'ArrowLeft' || event.key === 'ArrowUp')
      next = (index - 1 + tabs.length) % tabs.length;
    else if (event.key === 'Home') next = 0;
    else if (event.key === 'End') next = tabs.length - 1;
    else return;

    event.preventDefault();
    const id = tabs[next].id;
    setActive(id);
    buttons.current[id]?.focus();
  }

  return (
    <section>
      <h2 className="text-[24px] font-semibold text-heading">The case itself</h2>
      <p className="mt-1 max-w-[720px] text-[15px] leading-[1.65] text-stone-600">
        The clinical ground this station covers, and the indicators it was marked
        against — worth reading now, while the consultation is fresh.
      </p>

      <div role="tablist" aria-label="Case notes" className="mt-5 flex flex-wrap gap-2">
        {tabs.map((tab, index) => {
          const selected = active === tab.id;
          return (
            <button
              key={tab.id}
              id={tabIdFor(tab.id)}
              role="tab"
              type="button"
              aria-selected={selected}
              aria-controls={panelIdFor(tab.id)}
              tabIndex={selected ? 0 : -1}
              ref={(element) => {
                buttons.current[tab.id] = element;
              }}
              onClick={() => setActive(tab.id)}
              onKeyDown={(event) => move(index, event)}
              className={`min-h-[44px] rounded-[10px] border px-4 py-2.5 text-[14px] font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/35 ${
                selected
                  ? 'border-primary/30 bg-primary/[0.07] text-heading'
                  : 'border-hairline bg-surface-raised text-muted hover:text-body'
              }`}
            >
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* Both panels stay mounted so the checkbox state on the mark scheme
          survives a trip to the learning points and back. */}
      {learning && (
        <div
          id={panelIdFor('learning')}
          role="tabpanel"
          aria-labelledby={tabIdFor('learning')}
          tabIndex={0}
          hidden={active !== 'learning'}
          className="mt-5 rounded-[12px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/35"
        >
          <LearningPointsDisplay content={learning} />
        </div>
      )}
      {hasScheme && scheme && (
        <div
          id={panelIdFor('markscheme')}
          role="tabpanel"
          aria-labelledby={tabIdFor('markscheme')}
          tabIndex={0}
          hidden={active !== 'markscheme'}
          className="mt-5 rounded-[12px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/35"
        >
          <MarkSchemeDomains
            dataGathering={scheme.data_gathering}
            clinicalManagement={scheme.clinical_management}
            relatingToOthers={scheme.relating_to_others}
          />
        </div>
      )}
    </section>
  );
}

function FocusNext({ feedback }: { feedback: ConsultationFeedback }) {
  const focusAreas = feedback.focus_areas.slice().sort((a, b) => a.priority - b.priority).slice(0, 3);
  if (focusAreas.length === 0) return null;

  return (
    <section className="rounded-[10px] border border-hairline bg-surface-raised p-5">
      <div className="mb-4 text-[11px] font-semibold uppercase tracking-[0.1em] text-muted">Focus next</div>
      <div className="grid gap-4">
        {focusAreas.map((focus) => (
          <div key={`${focus.priority}-${focus.label}`} className="grid grid-cols-[32px_1fr] gap-3">
            <div className="flex h-8 w-8 items-center justify-center rounded-md bg-primary/[0.08] font-mono text-[13px] font-medium text-primary">
              {focus.priority}
            </div>
            <div>
              <h3 className="text-[15px] font-medium text-heading">{focus.label}</h3>
              <p className="mt-1 text-[13px] leading-[1.6] text-stone-600">{focus.narrative}</p>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

function VerdictPanel({
  feedback,
  sessionId,
  compact = false,
}: {
  feedback: ConsultationFeedback;
  sessionId: string;
  /** Trial funnel: the same panel, sized so the offer below it stays reachable. */
  compact?: boolean;
}) {
  const { overall } = feedback;
  const vc = verdictColours(overall.verdict);
  const isPass = (PASSING_VERDICTS as readonly string[]).includes(overall.verdict);
  const maxScore = overall.max_score || 10.5;
  const duration = fmtDuration(feedback.timing?.total_duration_ms);
  // The pass mark, ticked on the dial and stated in words. "Bare Fail" and
  // "0.5 short of 6.0" are different facts, and only the second one is useful.
  const passMark = passMarkFor(maxScore);
  const tone = verdictTone(overall.verdict);
  /** What the celebration blooms out of — measured, not guessed. */
  const scoreRef = useRef<HTMLSpanElement>(null);

  return (
    <section className="grid gap-6 rounded-[16px] border border-hairline bg-white/80 p-5 shadow-elevation-2 md:gap-8 md:p-7 lg:grid-cols-[264px_minmax(0,1fr)]">
      {/*
        M1 + M3 live inside this tile, so the bloom is anchored on the score
        rather than on the page. `overflow-hidden` is deliberate and stays: the
        bloom grows to ~460px and would otherwise spill across the whole report.
        It is safe for the dial because ArcGauge caps itself at `max-width:100%`,
        so the gauge shrinks with this column instead of being clipped by it —
        and at `lg` the column (264px) is wider than the largest gauge (224px)
        plus its padding.
      */}
      <div className="relative overflow-hidden rounded-[12px] bg-surface px-4 py-5">
        <PassCelebration passed={isPass} sessionId={sessionId} originRef={scoreRef} />
        <div className="relative z-20 flex flex-col items-center">
          <div className="mb-4 text-[11px] font-semibold uppercase tracking-[0.1em] text-muted">
            Final verdict
          </div>

          <ArcGauge
            value={overall.weighted_score}
            max={maxScore}
            threshold={passMark}
            size={compact ? GAUGE_SIZE.trial : GAUGE_SIZE.app}
            thickness={compact ? 11 : 13}
            colour={TONE_COLOUR[tone]}
            label={`${fmtMark(overall.weighted_score)} out of ${fmtMark(maxScore)}, a ${overall.verdict}. The pass mark is ${fmtMark(passMark)}.`}
          >
            <span
              ref={scoreRef}
              className={`font-mono font-bold leading-none tabular-nums text-heading ${compact ? 'text-[32px]' : 'text-[38px]'}`}
            >
              {overall.weighted_score.toFixed(1)}
            </span>
            <span className="mt-1.5 font-mono text-[13px] text-stone-400">
              / {maxScore.toFixed(1)}
            </span>
          </ArcGauge>

          <div className={`mt-1 text-center font-serif leading-none ${compact ? 'text-[26px]' : 'text-[30px]'} ${vc.text}`}>
            {overall.verdict}
          </div>
          <p className="mt-3 text-center text-[13px] leading-[1.55] text-stone-600">
            {passMarkSentence(overall.weighted_score, maxScore)}
          </p>
        </div>
      </div>

      <div className="flex min-w-0 flex-col justify-center">
        <div>
          {/* S3: the verdict is already stated at full size to the left. Repeating
              it here as a badge added no information and doubled the volume. */}
          <div className="mb-3 flex flex-wrap items-center gap-2">
            {duration && (
              <span className="inline-flex rounded-full border border-hairline bg-stone-50 px-3 py-1 text-[11px] font-medium text-stone-500">
                {duration} total
              </span>
            )}
          </div>

          <p className="max-w-[62ch] text-[15px] leading-[1.75] text-stone-700">
            {overall.one_line_summary || 'Your consultation has been marked. Use the domain breakdown below to see where marks were gained and lost.'}
          </p>
        </div>

        {overall.tier3_override_applied && (
          <div className="mt-4 rounded-[10px] border border-hairline bg-red-50 px-4 py-3 text-[13px] leading-[1.6] text-red-700">
            A safety critical issue capped the result at Fail, regardless of the arithmetic score.
          </div>
        )}
      </div>
    </section>
  );
}

/**
 * The overview is no longer a tab.
 *
 * It was the default tab, so it was what everyone saw first anyway — but being
 * a tab implied it was one of four peers you might swap between, when it is
 * really the thing you read before choosing a domain. It now sits between the
 * verdict and the domain tabs, always open, and the outer card it used to live
 * in is gone: the whitespace above and below already separates it.
 */
function OverviewPanel({
  feedback,
  domains,
}: {
  feedback: ConsultationFeedback;
  domains: DomainFeedback[];
}) {
  const lowestDomain = lowestScoringDomain(domains);
  const passedDomains = domains.filter((domain) => domain.grade === 'CP' || domain.grade === 'P').length;
  const topMisses = domains
    .flatMap((domain) => domain.what_you_missed.map((missed) => ({ ...missed, domain: domain.domain })))
    .sort((a, b) => b.consequence_tier - a.consequence_tier)
    .slice(0, 3);

  return (
    <section className="grid gap-5 lg:grid-cols-[1fr_360px]">
      <div className="rounded-[12px] bg-surface-raised px-5 py-5">
        <div className="mb-3 text-[11px] font-semibold uppercase tracking-[0.1em] text-muted">Consultation overview</div>
        <p className="text-[15px] leading-[1.75] text-stone-700">
          {feedback.overall.one_line_summary || 'This report summarises the consultation across data gathering, clinical management, and relating to others.'}
        </p>
        <div className="mt-5 grid gap-3 sm:grid-cols-3">
          <div className="rounded-[10px] border border-hairline bg-white/70 px-3 py-3">
            <div className="text-[11px] font-medium uppercase tracking-[0.08em] text-muted">Result</div>
            <div className="mt-1 text-[15px] font-semibold text-heading">{feedback.overall.verdict}</div>
          </div>
          <div className="rounded-[10px] border border-hairline bg-white/70 px-3 py-3">
            <div className="text-[11px] font-medium uppercase tracking-[0.08em] text-muted">Score</div>
            <div className="mt-1 font-mono text-[15px] font-semibold text-heading">
              {feedback.overall.weighted_score.toFixed(1)} / {feedback.overall.max_score.toFixed(1)}
            </div>
          </div>
          <div className="rounded-[10px] border border-hairline bg-white/70 px-3 py-3">
            <div className="text-[11px] font-medium uppercase tracking-[0.08em] text-muted">Domains</div>
            <div className="mt-1 text-[15px] font-semibold text-heading">{passedDomains} / {domains.length} passing</div>
          </div>
        </div>

        {lowestDomain && (
          <div className="mt-5 rounded-[10px] border border-hairline bg-amber-50/60 px-4 py-3 text-[13px] leading-[1.65] text-amber-900">
            {/* This domain is the one already open below, so the copy points
                there rather than telling you to open something twice. */}
            <span className="font-medium">Weakest area, and the one open below: </span>
            {DOMAIN_META[lowestDomain.domain].label}, which contributed {fmtScore(domainScore(lowestDomain))} / {fmtScore(domainMaxPoints(lowestDomain))} points.
          </div>
        )}

        {topMisses.length > 0 && (
          <div className="mt-5">
            <div className="mb-3 text-[11px] font-semibold uppercase tracking-[0.1em] text-muted">Highest impact misses</div>
            <div className="grid gap-3">
              {topMisses.map((missed, index) => {
                const severity = severityLabel(missed.consequence_tier);
                return (
                  <div key={`${missed.domain}-${missed.label}-${index}`} className="rounded-[10px] border border-hairline bg-white/70 px-3 py-3">
                    <div className="mb-1 flex flex-wrap items-center gap-2">
                      <span className={`rounded border px-1.5 py-0.5 text-[11px] font-medium uppercase tracking-[0.04em] ${severity.className}`}>
                        {severity.label}
                      </span>
                      <span className="text-[13px] font-medium text-stone-500">{DOMAIN_META[missed.domain].label}</span>
                    </div>
                    <p className="text-[13px] font-medium leading-[1.55] text-heading">{missed.label}</p>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      <FocusNext feedback={feedback} />
    </section>
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
        <span className={`inline-flex rounded border px-1.5 py-0.5 text-[11px] font-medium uppercase tracking-[0.04em] ${severity.className}`}>
          {severity.label}
        </span>
        <span className="text-[13px] font-medium leading-[1.55] text-heading">{item.label}</span>
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
    <article className="rounded-[10px] border border-hairline bg-stone-50/70 px-3 py-3 text-[13px] leading-[1.65] text-stone-600">
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
      className="scroll-mt-24 overflow-hidden rounded-[12px] border border-hairline bg-white/85 shadow-elevation-2"
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.15 + index * 0.08 }}
    >
      {/* The header's own radius used to be 22px on a 10px card, which showed
          as a nick in each top corner. The card clips it now. */}
      <header className={`border-b border-hairline px-5 py-4 ${meta.headerClass}`}>
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <div className="mb-2 flex flex-wrap items-center gap-2">
              <h3 className="text-[18px] font-semibold text-heading">{meta.label}</h3>
              {meta.weightLabel && (
                <span className="rounded-full border border-hairline bg-white/70 px-2.5 py-1 text-[11px] font-medium uppercase tracking-[0.08em] text-stone-500">
                  {meta.weightLabel}
                </span>
              )}
              <span className={`rounded-full border px-2.5 py-1 text-[11px] font-medium uppercase tracking-[0.08em] ${gc.badge}`}>
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
                className="rounded-full border border-hairline bg-stone-50 px-3 py-1 text-[11px] font-medium text-stone-500"
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
              <div className="rounded-[10px] border border-amber-200/70 bg-amber-50/50 px-3 py-3">
                <h5 className="mb-2 text-[11px] font-semibold uppercase tracking-[0.08em] text-amber-700">Cue handling</h5>
                <div className="space-y-3">
                  {cues.map((cue, i) => (
                    <article key={`${cue.cue}-${i}`} className="text-[13px] leading-[1.65] text-stone-600">
                      <span className="font-medium text-heading">{cue.status === 'explored' ? 'Explored' : 'Missed'}: </span>
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
                <span className="mb-1 block text-[11px] font-medium uppercase tracking-[0.08em] text-primary">
                  Biggest grade mover
                </span>
                {domain.grade_mover.narrative}
              </PracticeItem>
            )}

            {domain.model_moment && (
              <PracticeItem>
                <span className="mb-1 block text-[11px] font-medium uppercase tracking-[0.08em] text-stone-500">
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
            className="mt-5 min-h-[44px] rounded-[10px] border border-defined bg-white px-4 text-[13px] font-medium text-primary transition hover:border-primary/25 hover:bg-primary/[0.04] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
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
      <div className="mx-auto max-w-md rounded-[10px] border border-hairline bg-surface-raised p-6 text-center shadow-elevation-2">
        <p className="mb-2 text-[15px] font-semibold text-heading">{title}</p>
        <p className="mb-6 text-sm leading-[1.65] text-muted">{body}</p>
        <div className="flex flex-col items-center gap-3">{children}</div>
      </div>
    </div>
  );
}

/**
 * One turn — and, when an evidence chip has just sent the reader here, the
 * marker saying so.
 */
function TranscriptTurn({
  line,
  anchorId,
  flagged,
}: {
  line: TranscriptLine;
  anchorId: string;
  /** True while this is the turn a chip most recently jumped to. */
  flagged: boolean;
}) {
  const shouldReduceMotion = useReducedMotion();

  return (
    <li
      id={anchorId}
      // Focus lands here after a jump, so a keyboard user carries on reading
      // from the turn rather than from the top of the panel. Not in the tab
      // order — only a jump reaches it.
      tabIndex={-1}
      // Two markers, because they outlive each other. The tint is the "you
      // landed here" flag and clears after a couple of seconds; the ring
      // persists while focus does, which is the only one of the two a keyboard
      // user still needs by then. Programmatic focus following a mouse click
      // does not match :focus-visible, so a mouse user gets the tint alone.
      className={`grid grid-cols-[54px_minmax(0,1fr)] gap-3 rounded-r-[6px] border-l-2 pl-3 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/35 ${
        flagged ? 'bg-primary/[0.07]' : 'bg-transparent'
      } ${shouldReduceMotion ? '' : 'transition-colors duration-300'}`}
      style={{
        borderColor: flagged
          ? 'rgba(180,83,9,0.85)'
          : line.speaker === 'candidate'
            ? 'rgba(180,83,9,0.35)'
            : 'rgba(0,0,0,0.10)',
      }}
    >
      <span className="font-mono text-[11px] leading-[1.7] text-stone-400">
        {formatTimestamp(line.timestampMs)}
      </span>
      <span className="min-w-0">
        <span
          className={`mr-2 text-[13px] font-medium uppercase tracking-[0.06em] ${
            line.speaker === 'candidate' ? 'text-primary' : 'text-stone-500'
          }`}
        >
          {line.label}
        </span>
        <span className="text-[13px] leading-[1.7] text-stone-700">{line.text}</span>
      </span>
    </li>
  );
}

/**
 * The transcript, and the thing evidence chips scroll into.
 *
 * `open` is owned by the report rather than by this panel: a chip several
 * sections up has to be able to open it before it can scroll into it.
 */
function TranscriptPanel({
  lines,
  open,
  onToggle,
  idPrefix,
  /** Turn most recently jumped to, flagged so the reader can see where they landed. */
  flaggedAnchorId,
}: {
  lines: TranscriptLine[];
  open: boolean;
  onToggle: () => void;
  idPrefix: string;
  flaggedAnchorId: string | null;
}) {
  return (
    <section className="mt-10 border-t border-hairline pt-6">
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={open}
        aria-controls="consultation-transcript"
        className="flex min-h-[44px] w-full items-center justify-between gap-4 rounded-[10px] px-2 text-left transition hover:bg-black/[0.02] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/35"
      >
        <span>
          <span className="block text-[15px] font-semibold text-heading">Transcript</span>
          <span className="mt-0.5 block text-[13px] text-muted">
            {lines.length} turn{lines.length === 1 ? '' : 's'} — read what you actually said against the marking above
          </span>
        </span>
        <motion.span
          aria-hidden
          animate={{ rotate: open ? 90 : 0 }}
          transition={{ duration: 0.15 }}
          className="text-[13px] font-medium text-primary"
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
            <div className="mt-4 rounded-[10px] border border-hairline bg-white/70 px-4 py-4 sm:px-5">
              <p className="mb-4 text-[13px] leading-[1.6] text-stone-500">
                Automatic speech-to-text, so wording can be slightly off. Timestamps are
                minutes and seconds from the start of the consultation.
              </p>
              <ol className="space-y-3">
                {lines.map((line) => (
                  <TranscriptTurn
                    key={line.key}
                    line={line}
                    anchorId={transcriptTurnId(idPrefix, line.key)}
                    flagged={transcriptTurnId(idPrefix, line.key) === flaggedAnchorId}
                  />
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
  /**
   * Fires once, when the marked result arrives, so a parent can render
   * something alongside the report — progress, an offer — without fetching the
   * same session a second time and risking a second marking run.
   */
  onResult?: (overall: Overall) => void;
}

export default function FeedbackReport({
  sessionId,
  variant = 'app',
  from = null,
  onResult,
}: FeedbackReportProps) {
  const isTrial = variant === 'trial';

  const [feedback, setFeedback] = useState<ConsultationFeedback | null>(null);
  const [transcript, setTranscript] = useState<TranscriptLine[]>([]);
  const [loading, setLoading] = useState(true);
  const [problem, setProblem] = useState<ReportProblem | null>(null);
  /** Station behind a session we never got a report for, so retries have a target. */
  const [failedStationId, setFailedStationId] = useState<string | null>(null);
  /**
   * Null until the reader picks one. The tab that is actually open falls back
   * to the weakest domain (see `activeDomain` below), which cannot be decided
   * here because the marks have not arrived yet.
   */
  const [chosenDomain, setChosenDomain] = useState<DomainKey | null>(null);
  /** Namespaces the tablist's and the transcript's ids, so two reports could share a page. */
  const idPrefix = useId();
  const shouldReduceMotion = useReducedMotion();
  /** Owned here, not in TranscriptPanel: an evidence chip has to be able to open it. */
  const [transcriptOpen, setTranscriptOpen] = useState(false);
  /**
   * A jump asked for but not yet performed, and the turn most recently landed
   * on. Both are objects rather than bare ids so that clicking the same chip
   * twice is a new request — setting a string to the value it already holds is
   * a no-op in React, and the second click would do nothing.
   */
  const [jumpRequest, setJumpRequest] = useState<{ anchorId: string } | null>(null);
  const [landed, setLanded] = useState<{ anchorId: string } | null>(null);
  const retryCount = useRef(0);
  /**
   * Held in a ref rather than read from props inside the poll: an inline
   * callback from the parent would otherwise be a new function every render,
   * and putting it in the effect's dependencies would restart polling — and
   * re-trigger marking — on each one.
   */
  const onResultRef = useRef(onResult);
  onResultRef.current = onResult;
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
          if (data.feedback.overall) onResultRef.current?.(data.feedback.overall);
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

  const jumpTo = useCallback((anchorId: string) => {
    setTranscriptOpen(true);
    setJumpRequest({ anchorId });
  }, []);

  /**
   * Perform a requested jump, once the panel it lands in has stopped growing.
   * Cleared on the way out, so a later change to the motion preference cannot
   * re-fire an old jump.
   */
  useEffect(() => {
    if (!jumpRequest) return;
    const timer = setTimeout(() => {
      const target = document.getElementById(jumpRequest.anchorId);
      if (target) {
        // Focus first with preventScroll, then scroll deliberately: focus()
        // does its own jump otherwise, with the browser's alignment rather
        // than ours, and the turn ends up under the top edge.
        target.focus({ preventScroll: true });
        target.scrollIntoView({
          behavior: shouldReduceMotion ? 'auto' : 'smooth',
          block: 'center',
        });
        setLanded({ anchorId: jumpRequest.anchorId });
      }
      setJumpRequest(null);
    }, TRANSCRIPT_SETTLE_MS);
    return () => clearTimeout(timer);
  }, [jumpRequest, shouldReduceMotion]);

  /** The landing flag is a pointer, not a selection — it clears itself. */
  useEffect(() => {
    if (!landed) return;
    const timer = setTimeout(() => setLanded(null), JUMP_FLAG_MS);
    return () => clearTimeout(timer);
  }, [landed]);

  /**
   * Null while there is no transcript to jump into, which switches every
   * evidence chip back to the plain timestamp it used to be.
   */
  const transcriptJump = useMemo<TranscriptJump | null>(() => {
    if (transcript.length === 0) return null;
    return {
      anchorFor: (evidence) => {
        const line = findTranscriptAnchor(
          transcript,
          evidence.timestamp_ms,
          evidence.speaker
        );
        return line ? transcriptTurnId(idPrefix, line.key) : null;
      },
      jumpTo,
    };
  }, [transcript, idPrefix, jumpTo]);

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
      <Link href="/dashboard/library" className="text-sm font-medium text-primary hover:underline">
        Go to my cases
      </Link>
    );
    const dashboardLink = !isTrial && (
      <Link href="/dashboard" className="text-sm font-medium text-muted hover:text-heading hover:underline">
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
            <a href="mailto:hello@fourteenfisherman.com" className="font-medium text-primary hover:underline">
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

  /**
   * Which domain is open.
   *
   * The default is the weakest domain, not the first one: the overview already
   * names it as the thing to read first, so opening any other one would make
   * the page argue with itself. Derived rather than set in an effect, so there
   * is no flash of the wrong tab when the marks land.
   */
  const activeDomain: DomainKey | null =
    chosenDomain ?? lowestScoringDomain(orderedDomains)?.domain ?? null;
  const openDomain = orderedDomains.find((domain) => domain.domain === activeDomain) ?? null;
  const tabIdFor = (domain: DomainKey) => `${idPrefix}-tab-${domain}`;
  const panelId = `${idPrefix}-domain-panel`;

  return (
    <TranscriptJumpContext.Provider value={transcriptJump}>
    <main className="min-h-[100dvh] bg-surface font-sans">
      <div className="mx-auto max-w-[1180px] px-5 py-8 sm:px-7 lg:px-10 lg:py-10">
        {/* The header's own spring entry is replaced by — not stacked on —
            the BlurFade, so it stays a single animation and now shares one
            stagger with the sections beneath it. */}
        <Reveal delay={REVEAL.header}>
          <header className="mb-8">
          {!isTrial && (
            <nav className="mb-5 flex flex-wrap items-center gap-2 text-[13px] font-medium text-muted">
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
              <h1 className="max-w-[780px] text-[40px] font-semibold leading-[1.08] text-heading">
                {feedback.station_title || 'Consultation feedback'}
              </h1>
            </div>
            {/*
              No "Marked in 84s" chip here, deliberately.

              Marking really does take 47 to 88 seconds (measured across the
              production rows that have a claim stamp), but that number is not
              knowable on this page. `/api/generate-feedback` hands the client
              `{ status, feedback, transcript }` and nothing else; `feedback
              .timing` is consultation timing, not marking timing. The only
              honest pair is `clinical_sessions.marking_started_at` against
              `session_results.created_at`, and neither is in the payload —
              `completed_at - started_at` is NOT a substitute, because
              completed_at is stamped when the result row lands, so it spans
              the whole consultation. Quoting it would be inventing a number.
              Surfacing this properly means widening the ready response, which
              is the polling route's business, not the report's.
            */}
            <div className="flex flex-wrap gap-2 text-[13px] text-stone-500">
              <span className="rounded-full border border-hairline bg-white/70 px-3 py-1.5">Audio consultation</span>
              <span className="rounded-full border border-hairline bg-white/70 px-3 py-1.5">
                {passMarkCaption(feedback.overall.max_score)}
              </span>
            </div>
          </div>
          </header>
        </Reveal>

        <Reveal delay={REVEAL.verdict}>
          <VerdictPanel feedback={feedback} sessionId={sessionId} compact={isTrial} />
        </Reveal>

        {feedback.confidence && feedback.confidence.transcript_quality !== 'high' && (
          <div className="mt-5 rounded-[10px] border border-hairline bg-amber-50 px-4 py-3 text-[13px] leading-[1.6] text-amber-800">
            Transcript confidence was {feedback.confidence.transcript_quality}. Some feedback is given with caution.
            {feedback.confidence.notes ? ` ${feedback.confidence.notes}` : ''}
          </div>
        )}

        {/* Reading order: verdict, then what happened, then the domains. The
            gaps between the three do the separating — no outer cards. */}
        <Reveal delay={REVEAL.overview} className="mt-10 md:mt-12">
          <OverviewPanel feedback={feedback} domains={orderedDomains} />
        </Reveal>

        <Reveal delay={REVEAL.breakdown} className="mt-12 md:mt-16">
          <section>
            <div className="mb-5">
              <h2 className="text-[24px] font-semibold text-heading">Where the marks went</h2>
              <p className="mt-1 max-w-[720px] text-[15px] leading-[1.65] text-stone-600">
                Three domains, three scores. Open one to read the evidence behind its
                grade — what was credited, what cost marks, and what to practise.
              </p>
              {/* Re-homed from the old "Score key" column, which was the only
                  place the weighting was ever explained in words. */}
              <p className="mt-2 max-w-[720px] text-[13px] leading-[1.6] text-muted">
                Clinical management counts 1.5x, so it moves the total more than the
                other two and can decide the verdict on its own — which is why a domain
                grade and the overall verdict can disagree.
              </p>
            </div>

            <DomainTabs
              domains={orderedDomains}
              active={activeDomain}
              onChange={setChosenDomain}
              tabId={tabIdFor}
              panelId={panelId}
            />

            <div
              id={panelId}
              role="tabpanel"
              aria-labelledby={activeDomain ? tabIdFor(activeDomain) : undefined}
              tabIndex={0}
              className="mt-5 rounded-[12px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/35"
            >
              {/* Fires on tab change, not on load, so it is not a second entry
                  animation stacked on the Reveal above. */}
              <AnimatePresence mode="wait">
                {openDomain && (
                  <DomainCard key={openDomain.domain} domain={openDomain} index={0} />
                )}
              </AnimatePresence>
            </div>
          </section>
        </Reveal>

        {/* The case's own teaching material, after the marks and before the
            evidence. CaseNotes renders nothing when the station carries neither
            half, so it needs no guard here. */}
        <Reveal delay={REVEAL.learning} className="mt-12 md:mt-16">
          <CaseNotes feedback={feedback} />
        </Reveal>

        {transcript.length > 0 && (
          <TranscriptPanel
            lines={transcript}
            open={transcriptOpen}
            onToggle={() => setTranscriptOpen((value) => !value)}
            idPrefix={idPrefix}
            flaggedAnchorId={landed?.anchorId ?? null}
          />
        )}

        {!isTrial && (
          <div className="mt-10 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <Link href={from ? `/dashboard/library/${from}` : '/dashboard/library'}>
              <PrimaryButton>Practice another case</PrimaryButton>
            </Link>
            {feedback.station_id && (
              <Link
                href={`/clinical-master/station/${feedback.station_id}${from ? `?from=${from}` : ''}`}
                className="min-h-[44px] rounded-[10px] px-4 py-3 text-[13px] font-medium text-primary transition hover:bg-primary/[0.06]"
              >
                Retry this case
              </Link>
            )}
            <Link
              href="/dashboard"
              className="min-h-[44px] rounded-[10px] px-4 py-3 text-[13px] font-medium text-muted transition hover:bg-stone-100 hover:text-heading"
            >
              Back to dashboard
            </Link>
          </div>
        )}
      </div>
    </main>
    </TranscriptJumpContext.Provider>
  );
}
