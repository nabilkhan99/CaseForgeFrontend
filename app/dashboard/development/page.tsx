'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import type { User } from '@supabase/supabase-js';
import { motion, useReducedMotion } from 'framer-motion';
import { BlurFade } from '@/components/magicui/blur-fade';
import PageHeader from '@/components/ui/PageHeader';
import ScoreTrend from '@/components/ui/ScoreTrend';
import DomainAverages from '@/components/development/DomainAverages';
import PatternList from '@/components/development/PatternList';
import TrajectoryBlock from '@/components/development/TrajectoryBlock';
import { createClient } from '@/lib/supabase/client';
import {
  getSessionHistory,
  type SessionHistoryItem,
} from '@/lib/supabase/queries/dashboard';
import { getCaseTitles, getDomainCaseSeries } from '@/lib/supabase/queries/development';
import type { DomainCasePoints } from '@/lib/development/domainAverages';
import { isTrendReportV2, type TrendReportV2 } from '@/lib/clinical-master/trendTypes';
import { formatRelativeDate } from '@/lib/utils';

/** Enough recent sessions to feed the chart and to name most evidence cases for free. */
const HISTORY_LIMIT = 20;

const POLL_MS = 3000;
/**
 * Poll budget for a first build. The trend engine takes 1–2 minutes, so the
 * budget has to clear that with room: 100 × 3s = 5 minutes, the same figure the
 * marking wait settled on after a shorter one turned an ordinary slow run into
 * a refresh loop.
 */
const MAX_POLLS = 100;

/** What the page knows about the report right now. */
type TrendState =
  | { kind: 'polling' }
  | { kind: 'insufficient'; marked: number; required: number }
  | { kind: 'ready'; report: TrendReportV2 }
  | { kind: 'stalled' };

function Spinner() {
  return (
    <div className="flex items-center justify-center py-20">
      <motion.div
        className="h-8 w-8 rounded-full border-2 border-primary border-t-transparent"
        animate={{ rotate: 360 }}
        transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
      />
    </div>
  );
}

/**
 * One entry animation per section, skipped under prefers-reduced-motion —
 * BlurFade has no reduced-motion handling of its own, so the gate lives at the
 * call site, as it does on the dashboard home and the feedback report.
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
  if (shouldReduceMotion) return <div className={className}>{children}</div>;
  return (
    <BlurFade delay={delay} className={className}>
      {children}
    </BlurFade>
  );
}

const REVEAL = { chart: 0, domains: 0.06, report: 0.12 } as const;

/** The wait while the engine reads the cases. Quiet on purpose — it is not the content. */
function GeneratingNotice() {
  const shouldReduceMotion = useReducedMotion();
  return (
    <div className="py-2">
      <motion.p
        className="text-[15px] text-muted"
        animate={shouldReduceMotion ? undefined : { opacity: [0.45, 1, 0.45] }}
        transition={{ duration: 2.2, repeat: Infinity, ease: 'easeInOut' }}
      >
        Reading your last cases&hellip;
      </motion.p>
      <p className="mt-1.5 text-[13px] text-muted">
        This page updates on its own &mdash; no need to refresh.
      </p>
    </div>
  );
}

/**
 * Development — the macro picture, and the only page that answers "am I getting
 * better, and at what?".
 *
 * The session list that used to live here is gone: a flat list of every case
 * was a log, not a picture, and per-case history now sits on the Library topic
 * pages where a case is the thing you are already looking at. What is left is
 * the shape of the scores, the three domain averages, and the one to three
 * things costing marks — each with the trainee's own words next to the words a
 * passing candidate uses.
 *
 * NUMBERS AND WORDS COME FROM DIFFERENT PLACES. The chart and the domain
 * averages are arithmetic over `session_results`; only the trajectory sentence
 * and the patterns come from the trend engine. So the figures are right the
 * moment a case is marked, and they cannot drift from what the feedback report
 * showed for the same consultation.
 */
export default function DevelopmentPage() {
  // `undefined` = auth hasn't answered, `null` = genuinely signed out. Firing
  // the queries on the initial null renders a returning user's page empty for a
  // second before their data arrives.
  const [user, setUser] = useState<User | null | undefined>(undefined);
  const [sessions, setSessions] = useState<SessionHistoryItem[]>([]);
  const [domainCases, setDomainCases] = useState<DomainCasePoints[]>([]);
  const [loadingData, setLoadingData] = useState(true);
  const [trend, setTrend] = useState<TrendState>({ kind: 'polling' });
  /** case_id → station title, for the evidence rows under each pattern. */
  const [caseTitles, setCaseTitles] = useState<Map<string, string>>(new Map());
  const polls = useRef(0);

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then(({ data }) => setUser(data.user ?? null));
  }, []);

  useEffect(() => {
    if (user === undefined) return;
    if (user === null) {
      setLoadingData(false);
      return;
    }
    let cancelled = false;

    async function load(userId: string) {
      try {
        const [history, cases] = await Promise.all([
          getSessionHistory(userId, HISTORY_LIMIT, 0),
          getDomainCaseSeries(userId),
        ]);
        if (cancelled) return;
        setSessions(history);
        setDomainCases(cases);
      } finally {
        if (!cancelled) setLoadingData(false);
      }
    }

    load(user.id);
    return () => {
      cancelled = true;
    };
  }, [user]);

  const poll = useCallback(async (): Promise<TrendState | null> => {
    const response = await fetch('/api/clinical-master/trend', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    });
    const data = await response.json();

    if (data?.status === 'ready' && isTrendReportV2(data.report)) {
      return { kind: 'ready', report: data.report };
    }
    if (data?.status === 'insufficient_data') {
      return {
        kind: 'insufficient',
        marked: Number(data.marked ?? 0),
        required: Number(data.required ?? 0),
      };
    }
    return null;
  }, []);

  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    polls.current = 0;

    async function run() {
      let settled: TrendState | null = null;
      try {
        settled = await poll();
      } catch {
        // A dropped request is not an answer; fall through and try again.
      }
      if (cancelled) return;
      if (settled) {
        setTrend(settled);
        return;
      }
      polls.current += 1;
      if (polls.current >= MAX_POLLS) {
        // We stopped waiting; the build did not. Saying when it will land would
        // be a guess, so the copy says where it lands instead.
        setTrend({ kind: 'stalled' });
        return;
      }
      timer = setTimeout(run, POLL_MS);
    }

    let timer = setTimeout(run, 400);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [user, poll]);

  /**
   * Name the evidence cases.
   *
   * History is already loaded for the chart and covers the recent window, so
   * most ids are free. Only what it cannot name costs a query — and an id that
   * still resolves to nothing is rendered as "One of your cases" rather than a
   * uuid, which would be worse than saying nothing.
   */
  useEffect(() => {
    if (trend.kind !== 'ready') return;
    let cancelled = false;

    const ids = Array.from(
      new Set(
        trend.report.patterns.flatMap((pattern) =>
          (pattern.evidence ?? []).map((item) => item.case_id).filter(Boolean),
        ),
      ),
    );
    if (ids.length === 0) return;

    const known = new Map<string, string>();
    for (const session of sessions) {
      if (session.stationTitle) known.set(session.id, session.stationTitle);
    }
    const missing = ids.filter((id) => !known.has(id));

    if (missing.length === 0) {
      setCaseTitles(known);
      return;
    }

    getCaseTitles(missing)
      .then((fetched) => {
        if (cancelled) return;
        setCaseTitles(new Map([...known, ...fetched]));
      })
      .catch(() => {
        if (!cancelled) setCaseTitles(known);
      });

    return () => {
      cancelled = true;
    };
  }, [trend, sessions]);

  if (user === undefined || loadingData) return <Spinner />;

  const report = trend.kind === 'ready' ? trend.report : null;
  const casesIncluded = report?.window?.cases_included ?? domainCases.length;
  const lastScored = sessions.find((session) => session.outcome === 'scored');
  const lastCaseLabel = lastScored?.completedAt
    ? formatRelativeDate(lastScored.completedAt).toLowerCase()
    : null;

  const subtitle = report
    ? `Across your last ${casesIncluded} marked cases · updated after every case${
        lastCaseLabel ? ` · last case ${lastCaseLabel}` : ''
      }`
    : undefined;

  return (
    <div>
      <PageHeader title="Development" subtitle={subtitle} />

      <Reveal delay={REVEAL.chart}>
        <ScoreTrend sessions={sessions} />
      </Reveal>

      <Reveal delay={REVEAL.domains}>
        <DomainAverages cases={domainCases} />
      </Reveal>

      <Reveal delay={REVEAL.report}>
        {trend.kind === 'ready' && (
          <>
            <TrajectoryBlock
              trajectory={trend.report.overall_trajectory}
              narrative={trend.report.overall_narrative}
            />
            <PatternList
              patterns={trend.report.patterns}
              casesIncluded={casesIncluded}
              titles={caseTitles}
            />
          </>
        )}

        {trend.kind === 'polling' && <GeneratingNotice />}

        {trend.kind === 'stalled' && (
          <p className="max-w-[560px] text-[15px] leading-[1.6] text-muted">
            Still building your picture. It carries on in the background whether or not
            this page is open &mdash; come back in a few minutes and it will be here.
          </p>
        )}

        {trend.kind === 'insufficient' && (
          // Deliberately spare. There is nothing to say yet, and dressing that
          // up as a feature would be worse than a sentence and some space.
          <div className="py-16 text-center">
            <p className="text-[15px] text-muted">
              {trend.marked} of {trend.required} cases until your development picture
              appears
            </p>
            {/* The one action available from an empty page. */}
            <Link
              href="/dashboard/library"
              className="mt-4 inline-block text-[13px] font-medium text-primary hover:underline focus-visible-ring"
            >
              Practise a case &rarr;
            </Link>
          </div>
        )}
      </Reveal>
    </div>
  );
}
