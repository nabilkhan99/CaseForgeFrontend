'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { motion, useReducedMotion } from 'framer-motion';
import { BlurFade } from '@/components/magicui/blur-fade';
import PageHeader from '@/components/ui/PageHeader';
import StudentTabs from '@/components/trainer/StudentTabs';
import CohortTrend, { toSeriesPoints, type CohortSeries } from '@/components/trainer/CohortTrend';
import CohortStatBand from '@/components/trainer/CohortStatBand';
import CohortSessionList, {
  type AttributedSession,
} from '@/components/trainer/CohortSessionList';
import {
  markedCount,
  studentColour,
  studentName,
  summariseCohort,
} from '@/lib/trainer/cohortStats';
import type { TrainerOverviewResponse } from '@/app/api/trainer/overview/route';

/**
 * How many consultations the "All students" view lists.
 *
 * Nine, not everything: across three students it is a couple of weeks of
 * practice, which is what "how is the cohort doing" means, and the count line
 * under it says what was left out. Picking one student lifts the cap entirely —
 * asking about a person is asking about all of their work.
 */
const ALL_STUDENTS_ROWS = 9;

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
 * call site, as it does on Development and the dashboard home.
 */
function Reveal({
  delay,
  children,
}: {
  delay: number;
  children: React.ReactNode;
}) {
  const shouldReduceMotion = useReducedMotion();
  if (shouldReduceMotion) return <div>{children}</div>;
  return <BlurFade delay={delay}>{children}</BlurFade>;
}

const REVEAL = { tabs: 0, chart: 0.06, stats: 0.12, list: 0.18 } as const;

/** What the page knows about the cohort right now. */
type LoadState =
  | { kind: 'loading' }
  | { kind: 'forbidden' }
  | { kind: 'error' }
  | { kind: 'ready'; overview: TrainerOverviewResponse };

/**
 * Students — the trainer's view of their cohort.
 *
 * ONE FILTER, THREE CONSEQUENCES. The tabs at the top drive the chart, the stat
 * band and the list together. That is the whole interaction model: everything
 * below the tabs is an answer to "who are we talking about", and a page where
 * the chart and the list could disagree about that would be unreadable.
 *
 * NOTHING HERE IS THE TRAINER'S OWN WORK. They are a member of their own cohort
 * so they can sit the same cases; the API strips their user id out of the
 * student list before any query runs, so their practice never appears on this
 * page. Their own scores are on Development, where everyone else's are.
 *
 * READ-ONLY, DELIBERATELY — and read-only in the billing sense too. There is no
 * way to reassign cases, message a student or leave a note; and following a row
 * into an unmarked case does not start the marking run, because that is a paid
 * Azure call against somebody else's session (/api/generate-feedback suppresses
 * the trigger for a trainer-authorised read). This is a pilot: the trainer's
 * feedback loop is a conversation they are already having, and the product's
 * job is to give them something true to have it about.
 */
export default function StudentsPage() {
  const [state, setState] = useState<LoadState>({ kind: 'loading' });
  const [selected, setSelected] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    fetch('/api/trainer/overview')
      .then(async (response) => {
        if (cancelled) return;
        if (response.status === 403) {
          setState({ kind: 'forbidden' });
          return;
        }
        if (!response.ok) {
          setState({ kind: 'error' });
          return;
        }
        setState({ kind: 'ready', overview: (await response.json()) as TrainerOverviewResponse });
      })
      .catch(() => {
        if (!cancelled) setState({ kind: 'error' });
      });

    return () => {
      cancelled = true;
    };
  }, []);

  const overview = state.kind === 'ready' ? state.overview : null;

  /** Cohort join order fixes each student's colour, once, for the whole page. */
  const students = useMemo(
    () =>
      (overview?.students ?? []).map((student, index) => ({
        student,
        name: studentName(student),
        colour: studentColour(index),
      })),
    [overview],
  );

  const visible = useMemo(
    () => (selected === null ? students : students.filter((s) => s.student.userId === selected)),
    [students, selected],
  );

  const series = useMemo<CohortSeries[]>(
    () =>
      visible.map(({ student, name, colour }) => ({
        userId: student.userId,
        name,
        colour,
        points: toSeriesPoints(student.sessions),
      })),
    [visible],
  );

  /** Newest first, and attributed — the merged list loses who sat what. */
  const entries = useMemo<AttributedSession[]>(
    () =>
      visible
        .flatMap(({ student, name, colour }) =>
          student.sessions.map((session) => ({ session, studentName: name, colour })),
        )
        .sort((a, b) => new Date(b.session.date).getTime() - new Date(a.session.date).getTime()),
    [visible],
  );

  const sessions = useMemo(() => entries.map((entry) => entry.session), [entries]);
  const stats = useMemo(() => summariseCohort(sessions), [sessions]);
  const marked = useMemo(() => markedCount(sessions), [sessions]);

  if (state.kind === 'loading') return <Spinner />;

  if (state.kind === 'forbidden') {
    // Not a 404: they navigated here from a tab this account was shown, so the
    // honest answer is that the cohort is gone, not that the page never was.
    return (
      <div>
        <PageHeader title="Students" />
        <p className="max-w-[560px] text-[15px] leading-[1.6] text-muted">
          This account doesn&rsquo;t have a cohort. If that&rsquo;s a surprise, get in touch and
          we&rsquo;ll take a look.
        </p>
      </div>
    );
  }

  if (state.kind === 'error' || !overview) {
    return (
      <div>
        <PageHeader title="Students" />
        <p className="max-w-[560px] text-[15px] leading-[1.6] text-muted">
          Couldn&rsquo;t load your cohort just now. Refreshing usually sorts it.
        </p>
      </div>
    );
  }

  const tabs = [
    { userId: null, label: 'All students', colour: null },
    ...students.map(({ student, name, colour }) => ({
      userId: student.userId,
      label: name,
      colour,
    })),
  ];

  return (
    <div>
      <PageHeader
        title="Students"
        subtitle={`How your cohort is progressing across their ${overview.assignedCount} assigned cases.`}
      />

      {students.length === 0 ? (
        // Deliberately spare. Dressing an empty cohort up as a feature would be
        // worse than a sentence and some space — the same rule Development's
        // "not enough cases yet" state follows.
        <div className="py-16 text-center">
          <p className="text-[15px] text-muted">
            Nobody has been added to {overview.cohortName} yet.
          </p>
          <Link
            href="/dashboard/library"
            className="mt-4 inline-block text-[13px] font-medium text-primary hover:underline focus-visible-ring"
          >
            Practise a case yourself &rarr;
          </Link>
        </div>
      ) : (
        <>
          <Reveal delay={REVEAL.tabs}>
            <StudentTabs tabs={tabs} selected={selected} onSelect={setSelected} />
          </Reveal>

          <Reveal delay={REVEAL.chart}>
            <CohortTrend series={series} />
          </Reveal>

          <Reveal delay={REVEAL.stats}>
            <CohortStatBand stats={stats} marked={marked} />
          </Reveal>

          <Reveal delay={REVEAL.list}>
            <CohortSessionList
              entries={entries}
              // One student means all of their work; the cohort view is a
              // recent-activity feed with a count line under it.
              limit={selected === null ? ALL_STUDENTS_ROWS : undefined}
            />
            {overview.truncated && (
              <p className="pt-3 text-[11px] text-muted">
                Only the most recent consultations are shown &mdash; this cohort has more history
                than this page loads.
              </p>
            )}
          </Reveal>
        </>
      )}
    </div>
  );
}
