'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import type { User } from '@supabase/supabase-js';
import { getStationsForDomain, type Station } from '@/lib/supabase/queries/station-library';
import { use } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import PageHeader from '@/components/ui/PageHeader';
import Container from '@/components/ui/Container';
import PrimaryButton from '@/components/ui/PrimaryButton';
import ScoreBadge from '@/components/ui/ScoreBadge';

function formatDate(dateStr?: string): string {
  if (!dateStr) return '';
  const date = new Date(dateStr);
  const now = new Date();
  const diffDays = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24));
  if (diffDays === 0) return 'Today';
  if (diffDays === 1) return 'Yesterday';
  if (diffDays < 7) return `${diffDays}d ago`;
  if (diffDays < 30) return `${Math.floor(diffDays / 7)}w ago`;
  return `${Math.floor(diffDays / 30)}mo ago`;
}

function StationRow({ station, onStart, onViewFeedback }: {
  station: Station;
  onStart: (stationId: string) => void;
  onViewFeedback: (sessionId: string) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const hasAttempts = station.attempts.length > 0;
  const latestAttempt = hasAttempts ? station.attempts[0] : null;

  const handleClick = () => {
    if (hasAttempts && station.attempts.length > 1) {
      setExpanded(!expanded);
    } else if (hasAttempts && latestAttempt) {
      onViewFeedback(latestAttempt.sessionId);
    } else {
      onStart(station.id);
    }
  };

  return (
    <div className="border-b border-black/[0.06] last:border-b-0">
      {/* Main row */}
      <div
        onClick={handleClick}
        className="flex items-center gap-4 py-4 px-2 -mx-2 rounded-lg hover:bg-black/[0.02] transition-colors cursor-pointer group"
      >
        <div className="flex-1 min-w-0">
          <div className="text-[15px] font-semibold text-heading group-hover:text-primary transition-colors truncate">
            {station.title}
          </div>
          <div className="flex items-center gap-2 mt-0.5">
            <span className="text-[12px] text-muted">{station.patient_name}</span>
            {station.difficulty && (
              <span
                className="text-[10px] font-semibold uppercase tracking-wide px-1.5 py-0.5 rounded"
                style={{
                  background:
                    station.difficulty === 'hard'
                      ? 'rgba(220,38,38,0.08)'
                      : station.difficulty === 'medium'
                        ? 'rgba(217,119,6,0.08)'
                        : 'rgba(34,197,94,0.08)',
                  color:
                    station.difficulty === 'hard'
                      ? '#DC2626'
                      : station.difficulty === 'medium'
                        ? '#D97706'
                        : '#16A34A',
                }}
              >
                {station.difficulty}
              </span>
            )}
            {hasAttempts && (
              <span className="text-[11px] text-muted">
                {station.attempts.length} attempt{station.attempts.length !== 1 ? 's' : ''}
              </span>
            )}
          </div>
        </div>

        {/* Score or Start button */}
        {hasAttempts && latestAttempt?.score != null ? (
          <ScoreBadge score={latestAttempt.score} showLabel />
        ) : (
          <span className="text-[12px] text-muted">Not started</span>
        )}

        {/* Start button for not-started */}
        {!hasAttempts && (
          <button
            onClick={(e) => { e.stopPropagation(); onStart(station.id); }}
            className="text-[12px] font-semibold text-primary hover:underline cursor-pointer"
          >
            Start
          </button>
        )}

        {/* Expand indicator for multi-attempt stations */}
        {hasAttempts && station.attempts.length > 1 && (
          <motion.svg
            className="w-4 h-4 text-muted flex-shrink-0"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
            animate={{ rotate: expanded ? 90 : 0 }}
            transition={{ duration: 0.15 }}
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
          </motion.svg>
        )}
      </div>

      {/* Expanded attempts */}
      <AnimatePresence>
        {expanded && hasAttempts && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="pl-6 pb-3 space-y-1">
              {station.attempts.map((attempt, i) => (
                <div
                  key={attempt.sessionId}
                  onClick={() => onViewFeedback(attempt.sessionId)}
                  className="flex items-center gap-3 py-2 px-2 -mx-2 rounded-lg hover:bg-black/[0.02] cursor-pointer transition-colors"
                >
                  <span className="text-[11px] text-muted font-mono w-5">
                    #{station.attempts.length - i}
                  </span>
                  <span className="text-[13px] text-body flex-1">
                    {formatDate(attempt.completedAt)}
                  </span>
                  {attempt.score != null && (
                    <ScoreBadge score={attempt.score} size="sm" />
                  )}
                </div>
              ))}
              <button
                onClick={(e) => { e.stopPropagation(); onStart(station.id); }}
                className="flex items-center gap-1.5 py-2 px-2 -mx-2 text-[13px] font-semibold text-primary hover:underline cursor-pointer"
              >
                Try Again
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

interface PageProps {
  params: Promise<{ domainId: string }>;
}

export default function DomainDetailPage({ params }: PageProps) {
  const { domainId } = use(params);
  const router = useRouter();
  const [stations, setStations] = useState<Station[]>([]);
  const [domainName, setDomainName] = useState('');
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState<User | null>(null);

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then(({ data: { user } }) => {
      setUser(user);
    });
  }, []);

  useEffect(() => {
    async function fetchData() {
      setLoading(true);
      const supabase = createClient();
      const { data: domain } = await supabase
        .from('domains')
        .select('name')
        .eq('id', domainId)
        .single();

      if (domain) {
        setDomainName(domain.name);
      }

      const stationsData = await getStationsForDomain(domainId, user?.id);
      setStations(stationsData);
      setLoading(false);
    }

    fetchData();
  }, [domainId, user]);

  const handleStartStation = (stationId: string) => {
    router.push(`/clinical-master/station/${stationId}?from=${domainId}`);
  };

  const handleViewFeedback = (sessionId: string) => {
    router.push(`/clinical-master/feedback/${sessionId}?from=${domainId}`);
  };

  const completedCount = stations.filter(s => s.status === 'completed').length;
  const stationsWithScores = stations.filter(s => s.attempts.length > 0 && s.attempts[0].score != null);
  const avgScore = stationsWithScores.length > 0
    ? Math.round(stationsWithScores.reduce((sum, s) => sum + (s.attempts[0].score || 0), 0) / stationsWithScores.length)
    : 0;

  return (
    <div>
      <PageHeader
        title={domainName || 'Loading...'}
        subtitle={
          stations.length > 0
            ? `${completedCount}/${stations.length} completed${avgScore > 0 ? ` \u00B7 Average: ${avgScore}%` : ''}`
            : undefined
        }
        breadcrumbs={[
          { label: 'Library', href: '/dashboard/library' },
          { label: domainName || '...', href: `/dashboard/library/${domainId}` },
        ]}
      >
        {avgScore > 0 && <ScoreBadge score={avgScore} showLabel />}
      </PageHeader>

      {loading ? (
        <div className="flex items-center justify-center py-16">
          <motion.div
            className="w-8 h-8 rounded-full border-2 border-primary border-t-transparent"
            animate={{ rotate: 360 }}
            transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
          />
        </div>
      ) : stations.length === 0 ? (
        <Container>
          <div className="text-center py-8">
            <p className="text-[15px] text-muted mb-2">No stations available</p>
            <p className="text-[13px] text-muted mb-6">More stations coming soon for this domain</p>
            <Link href="/dashboard/library">
              <PrimaryButton size="sm">Back to Library</PrimaryButton>
            </Link>
          </div>
        </Container>
      ) : (
        <div>
          {stations.map((station, i) => (
            <motion.div
              key={station.id}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.04 }}
            >
              <StationRow
                station={station}
                onStart={handleStartStation}
                onViewFeedback={handleViewFeedback}
              />
            </motion.div>
          ))}
        </div>
      )}
    </div>
  );
}
