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
import { formatRelativeDate } from '@/lib/utils';

export default function HistoryPage() {
  const supabase = createClient();
  const [user, setUser] = useState<User | null>(null);
  const [sessions, setSessions] = useState<SessionHistoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [hasMore, setHasMore] = useState(true);
  const [totalCount, setTotalCount] = useState(0);
  const [loadingMore, setLoadingMore] = useState(false);

  const ITEMS_PER_PAGE = 20;

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      setUser(user);
    });
  }, [supabase.auth]);

  useEffect(() => {
    async function fetchHistory() {
      if (!user?.id) {
        if (user === null) setLoading(false);
        return;
      }

      try {
        // Fetch total count
        const { count } = await supabase
          .from('clinical_sessions')
          .select('*', { count: 'exact', head: true })
          .eq('user_id', user.id)
          .eq('status', 'completed');

        setTotalCount(count || 0);

        const data = await getSessionHistory(user.id, ITEMS_PER_PAGE, 0);
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
      const data = await getSessionHistory(user.id, ITEMS_PER_PAGE, sessions.length);
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
        subtitle={totalCount > 0 ? `${totalCount} completed session${totalCount !== 1 ? 's' : ''}` : undefined}
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
                <Link
                  href={`/clinical-master/feedback/${session.id}`}
                  className="flex items-center gap-3 py-3.5 px-2 -mx-2 rounded-lg hover:bg-black/[0.02] transition-colors group"
                >
                  <div className="flex-1 min-w-0">
                    <div className="text-[14px] font-medium text-heading group-hover:text-primary transition-colors truncate">
                      {session.stationTitle}
                    </div>
                    <div className="flex items-center gap-2 mt-1">
                      <DomainTag name={session.domainName} size="sm" />
                      <span className="text-[11px] text-muted">{formatRelativeDate(session.completedAt)}</span>
                    </div>
                  </div>

                  {/* Verdict band + weighted score — flex-shrink-0 so they never get clipped */}
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <span
                      className="text-[11px] font-semibold uppercase"
                      style={{ color: session.passed ? '#16A34A' : '#DC2626' }}
                    >
                      {session.verdict ?? 'Pending'}
                    </span>
                    <span className="text-[12px] font-mono text-muted">
                      {session.weightedScore.toFixed(1)}/{session.maxScore.toFixed(1)}
                    </span>
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
