'use client';

import Link from 'next/link';
import { format } from 'date-fns';
import { motion } from 'framer-motion';
import VerdictPill from '@/components/ui/VerdictPill';
import RecordingPlay from '@/components/trainer/RecordingPlay';
import { fmtMark } from '@/lib/clinical-master/scoring';
import type { Verdict } from '@/lib/clinical-master/types';
import { isMarking, isScored } from '@/lib/trainer/cohortStats';
import type { TrainerSession } from '@/app/api/trainer/overview/route';

/** One session, plus who sat it — the merged list loses that otherwise. */
export interface AttributedSession {
  session: TrainerSession;
  studentName: string;
  colour: string;
}

interface CohortSessionListProps {
  entries: AttributedSession[];
  /**
   * How many rows to draw. Undefined shows them all — which is what a single
   * student's view does, because their whole history is the point of asking
   * for one student.
   */
  limit?: number;
}

/** "5 Sep", the same stamp the trend readout uses. */
function stamp(iso: string): string {
  const date = new Date(iso);
  return Number.isFinite(date.getTime()) ? format(date, 'd MMM') : '';
}

/**
 * The cohort's consultations, newest first.
 *
 * A row is one link's worth of information and three controls, which is why it
 * is a row of elements rather than one big anchor: play is a button, the case
 * opens the student's own feedback report, and nesting either inside the other
 * produces markup that neither keyboards nor long-press menus handle.
 *
 * AN UNMARKED SESSION IS NOT A ZERO. A consultation still with the engine gets
 * an amber "Marking" pill and no score; one that was abandoned gets neither.
 * Both stay in the list — the trainer's count of what their student did has to
 * match what their student actually did, and a silently dropped row is how a
 * trainee gets told they have practised less than they have.
 */
export default function CohortSessionList({ entries, limit }: CohortSessionListProps) {
  const shown = limit === undefined ? entries : entries.slice(0, limit);

  if (shown.length === 0) {
    return (
      <p className="py-12 text-center text-[15px] text-muted">
        No consultations yet.
      </p>
    );
  }

  return (
    <div>
      <div className="divide-y divide-hairline">
        {shown.map(({ session, studentName, colour }, index) => {
          const scored = isScored(session);
          const marking = isMarking(session);

          return (
            <motion.div
              key={session.id}
              className="flex flex-wrap items-center gap-x-3 gap-y-2 py-3.5 sm:flex-nowrap"
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: Math.min(index, 12) * 0.03, duration: 0.25 }}
            >
              {/* Who. The dot is the chart's colour for this student, so the
                  line they hovered up there and the row down here are visibly
                  the same person; the name carries it for everyone else. */}
              <div className="flex w-[132px] flex-shrink-0 items-center gap-2">
                <span
                  aria-hidden="true"
                  className="h-[7px] w-[7px] flex-shrink-0 rounded-full"
                  style={{ background: colour }}
                />
                <span className="truncate text-[13px] font-medium text-heading">{studentName}</span>
              </div>

              <span className="w-[52px] flex-shrink-0 font-mono text-[11px] tabular-nums text-muted">
                {stamp(session.date)}
              </span>

              <Link
                href={`/clinical-master/feedback/${session.id}`}
                className="min-w-0 flex-1 truncate rounded text-[14px] text-body transition-colors hover:text-primary focus-visible-ring"
              >
                {session.stationTitle}
              </Link>

              <div className="flex flex-shrink-0 items-center gap-2.5">
                {scored && session.verdict ? (
                  <VerdictPill verdict={session.verdict as Verdict} passed={session.passed} size="sm" />
                ) : marking ? (
                  // Amber, not grey: this row will become a score, and a trainer
                  // refreshing to find out is the behaviour to encourage.
                  <span
                    className="inline-flex items-center rounded-md px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide"
                    style={{ background: 'rgba(180,83,9,0.1)', color: '#B45309' }}
                  >
                    Marking
                  </span>
                ) : (
                  // Sat, never marked — abandoned, or the engine failed. Saying
                  // so beats an invented score.
                  <span className="text-[11px] text-muted">Not marked</span>
                )}

                <span className="w-[62px] flex-shrink-0 text-right font-mono text-[12px] tabular-nums text-heading">
                  {scored
                    ? `${session.weightedScore!.toFixed(1)} / ${fmtMark(session.maxScore)}`
                    : ''}
                </span>

                {session.hasRecording ? (
                  <RecordingPlay
                    sessionId={session.id}
                    studentName={studentName}
                    caseTitle={session.stationTitle}
                  />
                ) : (
                  // Holds the column so the "Feedback" links stay in line
                  // whether or not a row has audio.
                  <span className="hidden w-8 flex-shrink-0 sm:block" aria-hidden="true" />
                )}

                <Link
                  href={`/clinical-master/feedback/${session.id}`}
                  className="hidden flex-shrink-0 rounded text-[12px] font-semibold text-primary hover:underline sm:inline focus-visible-ring"
                >
                  Feedback &rarr;
                </Link>
              </div>
            </motion.div>
          );
        })}
      </div>

      {limit !== undefined && entries.length > shown.length && (
        <p className="pt-4 text-[12px] text-muted">
          Showing the latest {shown.length} of {entries.length} consultations &mdash; pick a student
          to see all of theirs.
        </p>
      )}
    </div>
  );
}
