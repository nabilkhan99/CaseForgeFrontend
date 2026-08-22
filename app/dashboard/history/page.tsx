'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import type { User } from '@supabase/supabase-js';
import { motion } from 'framer-motion';
import PageHeader from '@/components/ui/PageHeader';
import DomainTag from '@/components/ui/DomainTag';
import PrimaryButton from '@/components/ui/PrimaryButton';
import SecondaryButton from '@/components/ui/SecondaryButton';
import Container from '@/components/ui/Container';
import {
  getSessionHistory,
  type SessionHistoryItem,
} from '@/lib/supabase/queries/dashboard';
import { formatElapsedSince, formatMinutesShort, formatRelativeDate } from '@/lib/utils';
import { TONE_COLOUR, passMarkCaption } from '@/lib/clinical-master/scoring';

/** Statuses this page lists — the same set getSessionHistory is asked for. */
const LISTED_STATUSES = ['completed', 'processing', 'abandoned'];
/** How often the "marking, N min ago" caption re-renders while you watch it. */
const TICK_MS = 30_000;

/**
 * The right-hand cluster of a history row.
 *
 * Every outcome says something specific. Sessions the user walked out of are
 * half of all real activity and used to appear nowhere in the product; a
 * session still being marked used to flip to "No feedback available" the
 * instant it started, because its age was read off a completed_at that is null
 * until marking finishes.
 */
function OutcomeCluster({ session, now }: { session: SessionHistoryItem; now: number }) {
  if (session.outcome === 'scored') {
    return (
      <div className="flex items-center gap-2" title={passMarkCaption(session.maxScore)}>
        <span
          className="text-[11px] font-semibold uppercase"
          style={{ color: session.passed ? TONE_COLOUR.pass : TONE_COLOUR.fail }}
        >
          {session.verdict}
        </span>
        <span className="text-[12px] font-mono text-muted">
          {session.weightedScore.toFixed(1)}/{session.maxScore.toFixed(1)}
        </span>
      </div>
    );
  }

  if (session.outcome === 'marking') {
    const elapsed = formatElapsedSince(session.startedAt, now);
    return (
      <div className="text-right">
        <span className="text-[11px] font-semibold text-primary">Marking…</span>
        <span className="block text-[10px] text-muted">
          Usually 1&ndash;2 minutes{elapsed ? ` · started ${elapsed}` : ''}
        </span>
      </div>
    );
  }

  if (session.outcome === 'stalled') {
    return (
      <div className="text-right">
        <span className="text-[11px] font-semibold" style={{ color: TONE_COLOUR.borderline }}>
          Marking didn&apos;t finish
        </span>
        <span className="block text-[10px] text-muted">Open to try again</span>
      </div>
    );
  }

  if (session.outcome === 'unfinished') {
    const elapsed = formatMinutesShort(session.elapsedMs);
    return (
      <span className="text-[11px] font-medium text-muted">
        Left early{elapsed ? ` · ${elapsed}` : ''}
      </span>
    );
  }

  return <span className="text-[11px] font-medium text-muted">No feedback available</span>;
}

export default function HistoryPage() {
  const supabase = createClient();
  const [user, setUser] = useState<User | null>(null);
  const [sessions, setSessions] = useState<SessionHistoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [hasMore, setHasMore] = useState(true);
  const [totalCount, setTotalCount] = useState(0);
  const [completedCount, setCompletedCount] = useState(0);
  const [loadingMore, setLoadingMore] = useState(false);
  /** Re-render on a timer so "started 4 min ago" stays true while you watch. */
  const [now, setNow] = useState(() => Date.now());

  const ITEMS_PER_PAGE = 20;

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      setUser(user);
    });
  }, [supabase.auth]);

  const hasMarking = sessions.some((session) => session.outcome === 'marking');
  useEffect(() => {
    if (!hasMarking) return;
    const id = setInterval(() => setNow(Date.now()), TICK_MS);
    return () => clearInterval(id);
  }, [hasMarking]);

  useEffect(() => {
    async function fetchHistory() {
      if (!user?.id) {
        if (user === null) setLoading(false);
        return;
      }

      try {
        // Two counts: the pager needs the size of the list it is paging (which
        // includes unfinished and processing rows), the subtitle needs the
        // number of consultations actually finished. Counting one and showing
        // the other produced "Load More (20 of 18)".
        const [{ count: listed }, { count: completed }] = await Promise.all([
          supabase
            .from('clinical_sessions')
            .select('*', { count: 'exact', head: true })
            .eq('user_id', user.id)
            .in('status', LISTED_STATUSES),
          supabase
            .from('clinical_sessions')
            .select('*', { count: 'exact', head: true })
            .eq('user_id', user.id)
            .eq('status', 'completed'),
        ]);

        setTotalCount(listed || 0);
        setCompletedCount(completed || 0);

        const data = await getSessionHistory(user.id, ITEMS_PER_PAGE, 0, { includeUnfinished: true });
        setSessions(data);
        setHasMore(data.length === ITEMS_PER_PAGE);
      } catch (error) {
        if (error instanceof Error) {
          // Handle silently
        }
      } finally {
        setLoading(false);
      }
    }

    fetchHistory();
  }, [user, supabase]);

  const loadMore = async () => {
    if (!user?.id || !hasMore || loadingMore) return;
    setLoadingMore(true);

    try {
      const data = await getSessionHistory(user.id, ITEMS_PER_PAGE, sessions.length, {
        includeUnfinished: true,
      });
      setSessions(prev => [...prev, ...data]);
      setHasMore(data.length === ITEMS_PER_PAGE);
    } catch (error) {
      if (error instanceof Error) {
        // Handle silently
      }
    } finally {
      setLoadingMore(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <motion.div
          className="w-8 h-8 rounded-full border-2 border-primary border-t-transparent"
          animate={{ rotate: 360 }}
          transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
        />
      </div>
    );
  }

  return (
    <div>
      <PageHeader
        title="Session History"
        subtitle={
          totalCount > 0
            ? `${completedCount} completed session${completedCount !== 1 ? 's' : ''} \u00B7 ${passMarkCaption()}`
            : undefined
        }
      />

      {sessions.length === 0 ? (
        <Container>
          <div className="text-center py-12">
            <p className="text-[16px] font-semibold text-heading mb-2">No sessions yet</p>
            <p className="text-[14px] text-muted mb-6">
              Complete a clinical consultation to see your history here.
            </p>
            <Link href="/dashboard/library">
              <PrimaryButton>Start Your First Session</PrimaryButton>
            </Link>
          </div>
        </Container>
      ) : (
        <div>
          <div className="divide-y divide-black/[0.06]">
            {sessions.map((session, i) => (
              <motion.div
                key={session.id}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.03 }}
              >
                {/* An unfinished session has no report to open, so the row goes
                    back to the case itself. Completed work stays visually
                    primary: unfinished rows are muted, never coloured. */}
                <Link
                  href={
                    session.outcome === 'unfinished' && session.stationId
                      ? `/clinical-master/station/${session.stationId}`
                      : `/clinical-master/feedback/${session.id}`
                  }
                  className={`flex items-center gap-3 py-3.5 px-2 -mx-2 rounded-lg hover:bg-black/[0.02] transition-colors group ${
                    session.outcome === 'unfinished' ? 'opacity-70 hover:opacity-100' : ''
                  }`}
                >
                  <div className="flex-1 min-w-0">
                    <div
                      className={`text-[14px] truncate transition-colors group-hover:text-primary ${
                        session.outcome === 'unfinished'
                          ? 'font-normal text-muted'
                          : 'font-medium text-heading'
                      }`}
                    >
                      {session.stationTitle}
                    </div>
                    <div className="flex items-center gap-2 mt-1">
                      <DomainTag name={session.domainName} size="sm" />
                      <span className="text-[11px] text-muted">{formatRelativeDate(session.completedAt)}</span>
                    </div>
                  </div>

                  {/* Outcome cluster — flex-shrink-0 so it never gets clipped */}
                  <div className="flex-shrink-0">
                    <OutcomeCluster session={session} now={now} />
                  </div>
                </Link>
              </motion.div>
            ))}
          </div>

          {hasMore && (
            <div className="flex justify-center py-6">
              <SecondaryButton onClick={loadMore} disabled={loadingMore}>
                {loadingMore ? 'Loading...' : `Load More (${sessions.length} of ${totalCount})`}
              </SecondaryButton>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
