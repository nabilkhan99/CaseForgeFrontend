'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import type { User } from '@supabase/supabase-js';
import { motion, useReducedMotion } from 'framer-motion';
import PageHeader from '@/components/ui/PageHeader';
import DomainTag from '@/components/ui/DomainTag';
import SessionOutcome from '@/components/ui/SessionOutcome';
import ScoreTrend from '@/components/ui/ScoreTrend';
import HistorySummary from '@/components/ui/HistorySummary';
import PrimaryButton from '@/components/ui/PrimaryButton';
import SecondaryButton from '@/components/ui/SecondaryButton';
import Container from '@/components/ui/Container';
import {
  getSessionHistory,
  type SessionHistoryItem,
} from '@/lib/supabase/queries/dashboard';
import { formatRelativeDate } from '@/lib/utils';
import { passMarkCaption } from '@/lib/clinical-master/scoring';

/** Statuses this page lists — the same set getSessionHistory is asked for. */
const LISTED_STATUSES = ['completed', 'processing', 'abandoned'];
/** How often the "marking, N min ago" caption re-renders while you watch it. */
const TICK_MS = 30_000;

type HistoryFilter = 'all' | 'passed' | 'failed' | 'unfinished';

const HISTORY_FILTERS: ReadonlyArray<{ id: HistoryFilter; label: string }> = [
  { id: 'all', label: 'All' },
  { id: 'passed', label: 'Passed' },
  { id: 'failed', label: 'Not yet passed' },
  { id: 'unfinished', label: 'Left early' },
];

/** Filters the rows already loaded. Paging is unchanged — see the caption below the list. */
function matchesFilters(
  session: SessionHistoryItem,
  query: string,
  filter: HistoryFilter,
): boolean {
  if (filter === 'passed' && !(session.outcome === 'scored' && session.passed)) return false;
  if (filter === 'failed' && !(session.outcome === 'scored' && !session.passed)) return false;
  if (filter === 'unfinished' && session.outcome !== 'unfinished') return false;

  const q = query.trim().toLowerCase();
  if (!q) return true;
  return (
    session.stationTitle.toLowerCase().includes(q) ||
    (session.domainName ?? '').toLowerCase().includes(q)
  );
}

/** Rows past this one all share the last delay — see the transition below. */
const MAX_STAGGERED_ROWS = 12;

export default function HistoryPage() {
  const supabase = createClient();
  const shouldReduceMotion = useReducedMotion();
  const [user, setUser] = useState<User | null>(null);
  const [sessions, setSessions] = useState<SessionHistoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [hasMore, setHasMore] = useState(true);
  const [totalCount, setTotalCount] = useState(0);
  const [completedCount, setCompletedCount] = useState(0);
  const [loadingMore, setLoadingMore] = useState(false);
  /** Re-render on a timer so "started 4 min ago" stays true while you watch. */
  const [now, setNow] = useState(() => Date.now());
  /** S7: the Case Library's controls, brought across. Both filter what is loaded. */
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<HistoryFilter>('all');
  /**
   * Row density. Local and unpersisted on purpose — it is a way of looking at
   * this list right now, not a setting, and a preference that follows you back
   * from a session three days later is a surprise rather than a convenience.
   */
  const [compact, setCompact] = useState(false);

  const ITEMS_PER_PAGE = 20;

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      setUser(user);
    });
  }, [supabase.auth]);

  const isFiltering = query.trim() !== '' || filter !== 'all';
  const visibleSessions = isFiltering
    ? sessions.filter((s) => matchesFilters(s, query, filter))
    : sessions;

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
            <p className="text-[15px] font-semibold text-heading mb-2">No sessions yet</p>
            <p className="text-[13px] text-muted mb-6">
              Complete a clinical consultation to see your history here.
            </p>
            <Link href="/dashboard/library">
              <PrimaryButton>Start Your First Session</PrimaryButton>
            </Link>
          </div>
        </Container>
      ) : (
        <div>
          {/* The figures first, then the shape, then the list. The strip reads
              every loaded row, not the filtered view — see HistorySummary. */}
          <HistorySummary
            sessions={sessions}
            hasMore={hasMore}
            compact={compact}
            onCompactChange={setCompact}
          />

          {/* M4 — the shape of the list, which the list itself cannot show. */}
          <ScoreTrend sessions={sessions} />

          {/* S7 — the Case Library's search + chips, so history can be narrowed too. */}
          <div className="mb-4">
            <label htmlFor="history-search" className="sr-only">
              Search your cases
            </label>
            <input
              id="history-search"
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search your cases, patients or symptoms"
              className="w-full rounded-[10px] border border-defined bg-white/70 px-4 py-2.5 text-base text-heading transition-all placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-primary/30 md:text-[15px]"
            />
            <div className="mt-3 flex flex-wrap gap-2">
              {HISTORY_FILTERS.map((f) => (
                <button
                  key={f.id}
                  type="button"
                  onClick={() => setFilter(f.id)}
                  aria-pressed={filter === f.id}
                  className={`rounded-full px-3 py-1.5 text-[13px] font-medium transition-colors ${
                    filter === f.id
                      ? 'bg-primary/10 text-primary'
                      : 'bg-black/[0.04] text-muted hover:text-heading'
                  }`}
                >
                  {f.label}
                </button>
              ))}
            </div>
          </div>

          <div className="divide-y divide-hairline">
            {visibleSessions.length === 0 && (
              <p className="py-10 text-center text-[13px] text-muted">
                Nothing here matches. {hasMore ? 'Older sessions may not be loaded yet.' : ''}
              </p>
            )}
            {visibleSessions.map((session, i) => (
              <motion.div
                key={session.id}
                // The stagger is capped, not proportional. An unbounded
                // `i * 0.03` is imperceptible on the first screen and absurd
                // by the hundredth row: at 100 loaded sessions the last one
                // waited three seconds to appear, on a page whose whole
                // purpose is that the rows are already there.
                //
                // Reduced motion collapses the transition rather than dropping
                // `initial`, which would hand React different markup between
                // renders. Same pattern as ArcGauge.
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                transition={
                  shouldReduceMotion
                    ? { duration: 0 }
                    : {
                        delay: Math.min(i, MAX_STAGGERED_ROWS) * 0.04,
                        duration: 0.3,
                        ease: 'easeOut',
                      }
                }
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
                  // Compact changes the padding and nothing else. Shrinking the
                  // type or dropping the domain tag would be removing content
                  // under the name of density; the point is to fit more rows on
                  // a screen, not to say less about each one.
                  className={`flex items-center gap-3 ${
                    compact ? 'py-2' : 'py-3.5'
                  } px-2 -mx-2 rounded-[10px] hover:bg-black/[0.02] transition-colors group ${
                    session.outcome === 'unfinished' ? 'opacity-70 hover:opacity-100' : ''
                  }`}
                >
                  <div className="flex-1 min-w-0">
                    <div
                      className={`text-[15px] truncate transition-colors group-hover:text-primary ${
                        session.outcome === 'unfinished'
                          ? 'font-normal text-muted'
                          : 'font-medium text-heading'
                      }`}
                    >
                      {session.stationTitle}
                    </div>
                    <div className={`flex items-center gap-2 ${compact ? 'mt-0.5' : 'mt-1'}`}>
                      <DomainTag name={session.domainName} size="sm" />
                      <span className="text-[11px] text-muted">{formatRelativeDate(session.completedAt)}</span>
                    </div>
                  </div>

                  {/* Outcome cluster — flex-shrink-0 so it never gets clipped */}
                  <div className="flex-shrink-0">
                    <SessionOutcome session={session} now={now} />
                  </div>
                </Link>
              </motion.div>
            ))}
          </div>

          {hasMore && (
            <div className="flex flex-col items-center gap-2 py-6">
              <SecondaryButton onClick={loadMore} disabled={loadingMore}>
                {loadingMore ? 'Loading...' : `Load More (${sessions.length} of ${totalCount})`}
              </SecondaryButton>
              {/* Search and the chips only see what has been loaded. Saying so
                  beats letting someone conclude a case isn't there. */}
              {isFiltering && (
                <p className="text-[11px] text-muted">
                  Searching the {sessions.length} loaded so far — load more to search the rest.
                </p>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
