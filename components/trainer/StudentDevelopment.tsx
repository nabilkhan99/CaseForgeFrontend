'use client';

import { useEffect, useId, useMemo, useState } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import DomainAverages from '@/components/development/DomainAverages';
import PatternList from '@/components/development/PatternList';
import TrajectoryBlock from '@/components/development/TrajectoryBlock';
import { isTrendReportV2 } from '@/lib/clinical-master/trendTypes';
import type { TrainerStudentDevelopmentResponse } from '@/app/api/trainer/students/[userId]/development/route';

/**
 * Mirrors MIN_CASES_FOR_TREND in app/api/clinical-master/trend/route.ts — the
 * number the student's own page counts down to.
 */
const MIN_CASES_FOR_PICTURE = 3;

/** What the section knows about the selected student right now. */
export type StudentDevelopmentState =
  | { kind: 'loading' }
  | { kind: 'error' }
  | { kind: 'ready'; development: TrainerStudentDevelopmentResponse };

/**
 * The route already validates all of this; the page checks the shape again
 * rather than trusting a response body, the same way Development re-checks
 * `isTrendReportV2` on what the trend route hands it.
 */
function parseDevelopment(body: unknown): TrainerStudentDevelopmentResponse {
  const raw = (typeof body === 'object' && body !== null ? body : {}) as Record<string, unknown>;
  const titles = raw.caseTitles;
  const cases: unknown[] = Array.isArray(raw.domainCases) ? raw.domainCases : [];
  return {
    report: isTrendReportV2(raw.report) ? raw.report : null,
    domainCases: cases.filter(
      (entry): entry is TrainerStudentDevelopmentResponse['domainCases'][number] =>
        typeof entry === 'object' &&
        entry !== null &&
        typeof (entry as { points?: unknown }).points === 'object' &&
        (entry as { points?: unknown }).points !== null,
    ),
    caseTitles:
      typeof titles === 'object' && titles !== null ? (titles as Record<string, string>) : {},
    markedCount: Number.isFinite(Number(raw.markedCount)) ? Number(raw.markedCount) : 0,
  };
}

/**
 * One student's Development data, fetched when they are picked and kept for
 * the life of the page.
 *
 * The cache lives in the caller (this hook runs in the page, above the tab
 * switch) so going back to a student already seen is instant rather than a
 * second round trip. Only successes are kept: a failed load is retried the
 * next time that student's tab is picked, instead of pinning them to an error
 * until a refresh.
 *
 * Switching tabs mid-request aborts the request, and the `cancelled` flag
 * stops a response that beat the abort from landing under the wrong name.
 */
export function useStudentDevelopment(userId: string | null): StudentDevelopmentState | null {
  const [cache, setCache] = useState<Record<string, TrainerStudentDevelopmentResponse>>({});
  const [failedFor, setFailedFor] = useState<string | null>(null);

  const cached = userId ? cache[userId] : undefined;
  const isCached = cached !== undefined;

  useEffect(() => {
    if (!userId || isCached) return;
    const controller = new AbortController();
    let cancelled = false;
    setFailedFor(null);

    fetch(`/api/trainer/students/${encodeURIComponent(userId)}/development`, {
      signal: controller.signal,
    })
      .then(async (response) => {
        if (!response.ok) throw new Error(`development request failed: ${response.status}`);
        const development = parseDevelopment(await response.json());
        if (!cancelled) setCache((previous) => ({ ...previous, [userId]: development }));
      })
      .catch(() => {
        if (!cancelled) setFailedFor(userId);
      });

    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [userId, isCached]);

  if (!userId) return null;
  if (cached) return { kind: 'ready', development: cached };
  if (failedFor === userId) return { kind: 'error' };
  return { kind: 'loading' };
}

/** A muted sentence in the section body — every state that isn't the picture itself. */
function Note({ children }: { children: React.ReactNode }) {
  return <p className="max-w-[560px] text-[15px] leading-[1.6] text-muted">{children}</p>;
}

/** The wait for the first load. Quiet on purpose, as on Development — it is not the content. */
function LoadingNote({ name }: { name: string }) {
  const shouldReduceMotion = useReducedMotion();
  return (
    <motion.p
      className="text-[15px] text-muted"
      animate={shouldReduceMotion ? undefined : { opacity: [0.45, 1, 0.45] }}
      transition={{ duration: 2.2, repeat: Infinity, ease: 'easeInOut' }}
    >
      Loading {name}&rsquo;s development&hellip;
    </motion.p>
  );
}

function DevelopmentBody({
  name,
  development,
}: {
  name: string;
  development: TrainerStudentDevelopmentResponse;
}) {
  const { report, domainCases, caseTitles, markedCount } = development;
  const titles = useMemo(() => new Map(Object.entries(caseTitles)), [caseTitles]);
  const casesIncluded = report?.window?.cases_included ?? domainCases.length;

  return (
    <>
      {/* Drawn whether or not there is a report, exactly as on the student's
          own page: the averages are arithmetic over marked cases and exist
          from the first one. */}
      <DomainAverages cases={domainCases} studentName={name} />

      {report ? (
        <>
          <TrajectoryBlock
            trajectory={report.overall_trajectory}
            narrative={report.overall_narrative}
          />
          <PatternList
            patterns={report.patterns}
            casesIncluded={casesIncluded}
            titles={titles}
            studentName={name}
          />
        </>
      ) : markedCount < MIN_CASES_FOR_PICTURE ? (
        <Note>
          {markedCount} of {MIN_CASES_FOR_PICTURE} marked cases until {name}&rsquo;s development
          picture appears
        </Note>
      ) : (
        // Never built from here: a build is a paid Azure call on the student's
        // account, and it runs when they open their own Development page.
        <Note>
          {name}&rsquo;s development picture hasn&rsquo;t been built yet. It builds when they
          next open their Development page.
        </Note>
      )}
    </>
  );
}

interface StudentDevelopmentProps {
  userId: string;
  /** Display name for the student, from the cohort overview. */
  name: string;
  state: StudentDevelopmentState;
}

/**
 * One student's Development page, inside the trainer's Students tab.
 *
 * The same three components the student sees, in the same order, with the
 * copy switched from "you" to their name — a coach preparing for a one to one
 * should be looking at what the student looked at, not a paraphrase of it.
 * The trajectory sentence and the pattern glosses are the engine's own words
 * and still speak to the student; the caption under the heading says so.
 *
 * No container: a heading, a caption and the page's own hairline rules, like
 * the rest of this tab.
 */
export default function StudentDevelopment({ userId, name, state }: StudentDevelopmentProps) {
  const shouldReduceMotion = useReducedMotion();
  const headingId = useId();

  return (
    <section aria-labelledby={headingId} className="mb-12">
      <div className="mb-5">
        <h2 id={headingId} className="text-[15px] font-semibold tracking-[-0.01em] text-heading">
          {name}&rsquo;s development
        </h2>
        <p className="mt-0.5 text-[13px] text-muted">
          What {name} sees on their Development page, updated after every marked case.
        </p>
      </div>

      {/* Keyed on who and what, so picking another student fades the new
          picture in rather than swapping it under the reader's eye. */}
      <motion.div
        key={`${userId}-${state.kind}`}
        initial={shouldReduceMotion ? false : { opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.2, ease: 'easeOut' }}
      >
        {state.kind === 'loading' && <LoadingNote name={name} />}
        {state.kind === 'error' && (
          <Note>
            Couldn&rsquo;t load {name}&rsquo;s development just now. Refreshing usually sorts it.
          </Note>
        )}
        {state.kind === 'ready' && (
          <DevelopmentBody name={name} development={state.development} />
        )}
      </motion.div>
    </section>
  );
}
