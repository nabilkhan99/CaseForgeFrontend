'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import type { User } from '@supabase/supabase-js';
import Link from 'next/link';
import { motion } from 'framer-motion';
import Container from '@/components/ui/Container';
import PrimaryButton from '@/components/ui/PrimaryButton';
import ScoreBadge from '@/components/ui/ScoreBadge';
import DomainTag from '@/components/ui/DomainTag';
import {
  getUserStats,
  getPerformanceMetrics,
  getLastStation,
  getSessionHistory,
} from '@/lib/supabase/queries/dashboard';
import { getRandomStation } from '@/lib/supabase/queries/station-library';
import type { Station } from '@/lib/supabase/queries/station-library';
import type {
  UserStats,
  PerformanceMetrics,
  LastStation,
} from '@/lib/dashboard/types';
import type { SessionHistoryItem } from '@/lib/supabase/queries/dashboard';
import { formatRelativeDate } from '@/lib/utils';

const defaultStats: UserStats = {
  currentStreak: 0,
  completedStations: 0,
  totalStations: 0,
  examCountdownDays: 0,
};

const defaultMetrics: PerformanceMetrics = {
  dataGathering: 0,
  clinicalManagement: 0,
  interpersonalSkills: 0,
};

const DOMAIN_LABELS: Record<string, string> = {
  dataGathering: 'Data Gathering',
  clinicalManagement: 'Clinical Management',
  interpersonalSkills: 'Interpersonal Skills',
};

export default function DashboardPage() {
  const supabase = createClient();
  const [user, setUser] = useState<User | null>(null);
  const [stats, setStats] = useState<UserStats>(defaultStats);
  const [metrics, setMetrics] = useState<PerformanceMetrics>(defaultMetrics);
  const [lastStation, setLastStation] = useState<LastStation | null>(null);
  const [recentSessions, setRecentSessions] = useState<SessionHistoryItem[]>([]);
  const [randomStation, setRandomStation] = useState<Station | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      setUser(user);
    });
  }, [supabase.auth]);

  useEffect(() => {
    async function fetchDashboardData() {
      if (!user?.id) {
        if (user === null) setLoading(false);
        return;
      }

      try {
        const [statsData, metricsData, lastStationData, recentData, randomStationData] = await Promise.all([
          getUserStats(user.id),
          getPerformanceMetrics(user.id),
          getLastStation(user.id),
          getSessionHistory(user.id, 3, 0),
          getRandomStation(),
        ]);

        setStats(statsData);
        setMetrics(metricsData);
        setLastStation(lastStationData);
        setRecentSessions(recentData);
        setRandomStation(randomStationData);
      } catch (error) {
        if (error instanceof Error) {
          // Silently handle dashboard data errors
        }
      } finally {
        setLoading(false);
      }
    }

    fetchDashboardData();
  }, [user]);

  const firstName = user?.user_metadata?.full_name?.split(' ')[0] || 'there';

  const greeting = (() => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good morning';
    if (hour < 18) return 'Good afternoon';
    return 'Good evening';
  })();

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

  const domainEntries = [
    { key: 'dataGathering', value: metrics.dataGathering },
    { key: 'clinicalManagement', value: metrics.clinicalManagement },
    { key: 'interpersonalSkills', value: metrics.interpersonalSkills },
  ];

  return (
    <div>
      {/* Welcome section */}
      <div className="mb-8">
        <h1 className="text-[28px] font-bold text-heading tracking-[-0.02em]">
          {greeting}, {firstName}
        </h1>
        <p className="text-[14px] text-muted mt-1">
          {stats.completedStations > 0
            ? `You've completed ${stats.completedStations} session${stats.completedStations !== 1 ? 's' : ''}${stats.currentStreak > 0 ? ` \u00B7 ${stats.currentStreak}-day streak` : ''}`
            : 'Start your first consultation to begin tracking progress'}
        </p>
        {stats.examCountdownDays > 0 && (
          <span
            className="inline-flex items-center gap-1.5 mt-2 px-3 py-1 rounded-lg text-[11px] font-semibold font-mono"
            style={{ background: 'rgba(180,83,9,0.08)', color: '#92400E' }}
          >
            SCA exam in {stats.examCountdownDays} days
          </span>
        )}
      </div>

      {/* Getting started onboarding for new users */}
      {stats.completedStations === 0 && (
        <div className="mb-8 rounded-[20px] bg-surface-raised border border-black/[0.06] p-6" style={{ boxShadow: '0 24px 64px rgba(180,83,9,0.06), 0 2px 4px rgba(0,0,0,0.04)' }}>
          <div className="text-[10px] font-semibold text-primary uppercase tracking-[0.1em] mb-4">
            How it works
          </div>
          <div className="flex flex-col sm:flex-row gap-6">
            <div className="flex-1">
              <div className="text-[24px] font-bold text-primary/20 font-mono mb-1">01</div>
              <div className="text-[14px] font-semibold text-heading mb-1">Pick a case</div>
              <div className="text-[13px] text-muted">Choose from 78 stations across all SCA domains</div>
            </div>
            <div className="flex-1">
              <div className="text-[24px] font-bold text-primary/20 font-mono mb-1">02</div>
              <div className="text-[14px] font-semibold text-heading mb-1">Talk to your patient</div>
              <div className="text-[13px] text-muted">Voice consultation with an AI patient that responds naturally</div>
            </div>
            <div className="flex-1">
              <div className="text-[24px] font-bold text-primary/20 font-mono mb-1">03</div>
              <div className="text-[14px] font-semibold text-heading mb-1">Get scored</div>
              <div className="text-[13px] text-muted">Instant feedback on all three SCA domains</div>
            </div>
          </div>
        </div>
      )}

      {/* Quick start */}
      <div className="mb-8">
        {lastStation ? (
          <Container>
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex-1 min-w-0">
                <div className="text-[10px] font-semibold text-muted uppercase tracking-[0.1em] mb-1.5">
                  Resume Session
                </div>
                <div className="text-[15px] font-semibold text-heading truncate">{lastStation.title}</div>
                <div className="flex items-center gap-2 mt-1">
                  <DomainTag name={lastStation.domain} size="sm" />
                  <span className="text-[12px] text-muted">{lastStation.patientName}</span>
                  <span className="text-[11px] font-mono text-primary font-semibold">
                    {Math.floor(lastStation.timeRemaining / 60)}m
                  </span>
                </div>
              </div>
              <Link href={`/clinical-master/session/${lastStation.sessionId}?stationId=${lastStation.id}`} className="sm:w-auto">
                <PrimaryButton size="sm" fullWidth>Continue</PrimaryButton>
              </Link>
            </div>
          </Container>
        ) : (
          <div>
            <Link href="/dashboard/library">
              <PrimaryButton size="lg" fullWidth>
                Start a New Session
              </PrimaryButton>
            </Link>
            {randomStation && (
              <div className="text-center mt-2">
                <Link
                  href={`/clinical-master/station/${randomStation.id}`}
                  className="text-[13px] text-primary hover:underline"
                >
                  or pick a random case &rarr;
                </Link>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Recent sessions */}
      {recentSessions.length > 0 && (
        <div
          className="mb-8"
        >
          <div className="text-[10px] font-semibold text-muted uppercase tracking-[0.1em] mb-3">
            Recent Sessions
          </div>
          <div className="divide-y divide-black/[0.06]">
            {recentSessions.map((session, i) => (
              <motion.div
                key={session.id}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.12 + i * 0.06 }}
              >
                <Link
                  href={`/clinical-master/feedback/${session.id}`}
                  className="flex items-center gap-3 py-3 hover:bg-black/[0.02] px-2 -mx-2 rounded-lg transition-colors"
                >
                  <div className="flex-1 min-w-0">
                    <div className="text-[14px] font-medium text-heading truncate">{session.stationTitle}</div>
                    <div className="flex items-center gap-2 mt-0.5">
                      <DomainTag name={session.domainName} size="sm" />
                      <span className="text-[11px] text-muted">{formatRelativeDate(session.completedAt)}</span>
                    </div>
                  </div>
                  <ScoreBadge score={session.overallScore} showLabel />
                </Link>
              </motion.div>
            ))}
          </div>
          <Link
            href="/dashboard/history"
            className="text-[13px] text-primary hover:underline mt-2 inline-block"
          >
            View all history
          </Link>
        </div>
      )}

      {/* Domain progress */}
      {(metrics.dataGathering > 0 || metrics.clinicalManagement > 0 || metrics.interpersonalSkills > 0) && (
        <div>
          <div className="text-[10px] font-semibold text-muted uppercase tracking-[0.1em] mb-3">
            Your Progress
          </div>
          <div className="space-y-4">
            {domainEntries.map((entry, i) => (
              <motion.div
                key={entry.key}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.2 + i * 0.06 }}
              >
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-[13px] font-medium text-heading">
                    {DOMAIN_LABELS[entry.key]}
                  </span>
                  <span className="text-[12px] font-mono font-semibold text-primary">
                    {entry.value}%
                  </span>
                </div>
                <div className="relative h-2 rounded-full bg-black/[0.04] overflow-hidden">
                  {/* Pass threshold marker at 70% */}
                  <div
                    className="absolute top-0 bottom-0 w-px bg-black/10 z-10"
                    style={{ left: '70%' }}
                  />
                  <motion.div
                    className="h-full rounded-full"
                    style={{ background: 'linear-gradient(90deg, #B45309, #D97706)' }}
                    initial={{ width: 0 }}
                    animate={{ width: `${entry.value}%` }}
                    transition={{ type: 'spring', stiffness: 40, damping: 20, delay: 0.3 + i * 0.1 }}
                  />
                </div>
              </motion.div>
            ))}
          </div>
          <Link
            href="/dashboard/library"
            className="text-[13px] text-primary hover:underline mt-3 inline-block"
          >
            View library
          </Link>
        </div>
      )}
    </div>
  );
}
