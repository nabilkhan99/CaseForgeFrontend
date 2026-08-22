'use client';

import { Suspense, useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import type { User } from '@supabase/supabase-js';
import Link from 'next/link';
import { motion } from 'framer-motion';
import Container from '@/components/ui/Container';
import PrimaryButton from '@/components/ui/PrimaryButton';
import SecondaryButton from '@/components/ui/SecondaryButton';
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
import type { SubscriptionResponse } from '@/app/api/subscription/route';
import { formatRelativeDate } from '@/lib/utils';
import { ACCESS_OPENS_LABEL } from '@/lib/commerce/plans';

const defaultStats: UserStats = {
  currentStreak: 0,
  completedStations: 0,
  passedStations: 0,
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

const DAY_MS = 86_400_000;

/** How long before expiry the renewal nudge appears. */
const RENEWAL_WARNING_DAYS = 7;

function formatAccessDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}

function daysUntil(iso: string): number {
  return Math.ceil((new Date(iso).getTime() - Date.now()) / DAY_MS);
}

function DashboardContent() {
  const supabase = createClient();
  // `undefined` = auth not resolved yet; `null` = resolved, signed out. The
  // two used to share `null`, so the first render treated "not loaded" as
  // "signed out", skipped the subscription fetch, and painted "Good afternoon,
  // there — you're on the free tier" at paying customers on every load.
  const [user, setUser] = useState<User | null | undefined>(undefined);
  const [stats, setStats] = useState<UserStats>(defaultStats);
  const [metrics, setMetrics] = useState<PerformanceMetrics>(defaultMetrics);
  const [lastStation, setLastStation] = useState<LastStation | null>(null);
  const [recentSessions, setRecentSessions] = useState<SessionHistoryItem[]>([]);
  const [randomStation, setRandomStation] = useState<Station | null>(null);
  // `undefined` = not fetched yet; `null` = the lookup failed. Only a loaded
  // answer may drive a "you have no plan" message.
  const [access, setAccess] = useState<SubscriptionResponse | null | undefined>(undefined);
  const [loading, setLoading] = useState(true);
  // Set by the middleware / station page when a pending buyer tried to start
  // a case before their window opened.
  const bouncedPending = useSearchParams()?.get('access') === 'pending';

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      setUser(user);
    });
  }, [supabase.auth]);

  useEffect(() => {
    async function fetchDashboardData() {
      if (user === undefined) return;
      if (!user?.id) {
        setLoading(false);
        return;
      }

      try {
        const [statsData, metricsData, lastStationData, recentData, randomStationData, accessRes] = await Promise.all([
          getUserStats(user.id),
          getPerformanceMetrics(user.id),
          getLastStation(user.id),
          getSessionHistory(user.id, 3, 0),
          getRandomStation(),
          fetch('/api/subscription').then((r) => (r.ok ? r.json() : null)),
        ]);

        setStats(statsData);
        setMetrics(metricsData);
        setLastStation(lastStationData);
        setRecentSessions(recentData);
        setRandomStation(randomStationData);
        setAccess(accessRes?.state ? (accessRes as SubscriptionResponse) : null);
      } catch (error) {
        console.error('[dashboard] failed to load dashboard data', error);
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
            ? `You've completed ${stats.completedStations} session${stats.completedStations !== 1 ? 's' : ''}${stats.currentStreak >= 2 ? ` \u00B7 ${stats.currentStreak}-day streak` : ''}`
            : 'Start your first consultation to begin tracking progress'}
        </p>
        <div className="flex flex-wrap items-center gap-2 mt-2">
          {/* Passing a station is the goal, so it gets its own headline number.
              Hidden until the first session — "Passed 0 of 78" is a poor greeting —
              and hidden again when the pass query failed (passedStations === null),
              because a confident zero would be a fabricated fact. */}
          {stats.passedStations !== null && stats.completedStations > 0 && stats.totalStations > 0 && (
            <motion.span
              initial={{ opacity: 0, y: -4 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3, ease: 'easeOut' }}
              className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg text-[11px] font-semibold font-mono"
              style={
                stats.passedStations > 0
                  ? { background: 'rgba(22,163,74,0.08)', color: '#15803D' }
                  : { background: 'rgba(0,0,0,0.03)', color: '#78716C' }
              }
            >
              Passed {stats.passedStations} of {stats.totalStations} stations
            </motion.span>
          )}
          {stats.examCountdownDays > 0 && (
            <span
              className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg text-[11px] font-semibold font-mono"
              style={{ background: 'rgba(180,83,9,0.08)', color: '#92400E' }}
            >
              SCA exam in {stats.examCountdownDays} days
            </span>
          )}
        </div>
      </div>

      {/* Plan state. Expiry is read-only, not a lockout: the loud banner says so,
          because the history and feedback below it still work.

          A failed /api/subscription lookup leaves `access` null and falls into
          the same "no plan" prompt the old subscriptions-table banner showed —
          silence would be worse, because the buy path would simply vanish.
          `bypass` (admin, staged deployment, fail-open) suppresses the nags:
          those users have access, whatever their own purchases say. */}
      {/* state 'none' WITH a plan = a preorder whose window hasn't opened.
          They paid; the one message that must never appear is "upgrade". */}
      {access?.state === 'none' && access.plan && !access.bypass && (
        <motion.div
          className="mb-6 px-4 py-3 rounded-xl flex items-center justify-between gap-3"
          style={{ background: 'rgba(180,83,9,0.06)', border: '1px solid rgba(180,83,9,0.12)' }}
          initial={{ opacity: 0, y: -4 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <p className="text-[13px] text-heading">
            {bouncedPending ? 'Not long now — that case opens on ' : <>You&apos;re in{access.planName ? ` — ${access.planName}` : ''}. Your access opens on </>}
            <span className="font-semibold">{ACCESS_OPENS_LABEL}</span>.
            {bouncedPending && ' Your plan is ready; consultations start then.'}
          </p>
        </motion.div>
      )}
      {access && !access.bypass && access.state === 'none' && !access.plan && (
        <motion.div
          className="mb-6 px-4 py-3 rounded-xl flex items-center justify-between gap-3"
          style={{ background: 'rgba(180,83,9,0.04)', border: '1px solid rgba(180,83,9,0.08)' }}
          initial={{ opacity: 0, y: -4 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <p className="text-[13px] text-heading">
            You don&apos;t have a plan yet &mdash;{' '}
            <Link href="/pricing" className="text-primary font-semibold hover:underline">
              see what&apos;s included
            </Link>
          </p>
        </motion.div>
      )}
      {access?.state === 'read_only' && !access.bypass && (
        <motion.div
          className="mb-6 px-4 py-3 rounded-xl flex items-center justify-between gap-3"
          style={{ background: 'rgba(180,83,9,0.08)', border: '1px solid rgba(180,83,9,0.18)' }}
          initial={{ opacity: 0, y: -4 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <p className="text-[13px] text-heading">
            Your access has ended &mdash; your history stays available.{' '}
            <Link href="/pricing?renew=true" className="text-primary font-semibold hover:underline">
              Renew to practise again
            </Link>
          </p>
        </motion.div>
      )}
      {access?.state === 'active' && access.expiresAt && (() => {
        // The renewal decision gets made *before* access ends, so the only
        // prompt that can change the outcome is this one — the post-expiry
        // banner above is already too late for a three-month product.
        const daysLeft = daysUntil(access.expiresAt);
        if (daysLeft > RENEWAL_WARNING_DAYS || daysLeft <= 0) return null;
        return (
          <motion.div
            className="mb-6 px-4 py-3 rounded-xl flex items-center justify-between gap-3"
            style={{ background: 'rgba(180,83,9,0.06)', border: '1px solid rgba(180,83,9,0.12)' }}
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
          >
            <p className="text-[13px] text-heading">
              Your plan expires in {daysLeft} day{daysLeft !== 1 ? 's' : ''} &mdash;{' '}
              <Link href="/pricing?renew=true" className="text-primary font-semibold hover:underline">
                renew to keep access
              </Link>
            </p>
          </motion.div>
        );
      })()}
      {access?.state === 'active' && access.planName && (
        <motion.div
          className="mb-6 text-[12px] text-muted"
          initial={{ opacity: 0, y: -4 }}
          animate={{ opacity: 1, y: 0 }}
        >
          {access.planName}
          {access.isMonthly
            ? ' · renews monthly'
            : access.expiresAt
              ? ` · access until ${formatAccessDate(access.expiresAt)}`
              : ''}
        </motion.div>
      )}

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
              <div className="text-[13px] text-muted">
                Choose from {stats.totalStations > 0 ? `${stats.totalStations} stations` : 'stations'} across every SCA domain
              </div>
            </div>
            <div className="flex-1">
              <div className="text-[24px] font-bold text-primary/20 font-mono mb-1">02</div>
              <div className="text-[14px] font-semibold text-heading mb-1">Talk to your patient</div>
              <div className="text-[13px] text-muted">Voice consultation with an AI patient that responds naturally</div>
            </div>
            <div className="flex-1">
              <div className="text-[24px] font-bold text-primary/20 font-mono mb-1">03</div>
              <div className="text-[14px] font-semibold text-heading mb-1">Get scored</div>
              <div className="text-[13px] text-muted">Scored feedback on all three SCA domains, a couple of minutes after you finish</div>
            </div>
          </div>
        </div>
      )}

      {/* Quick start. A buyer whose window hasn't opened (or has closed) can
          browse the library but not start — say so here rather than letting
          the button bounce them back to this page with no explanation. */}
      <div className="mb-8">
        {access && !access.allowed ? (
          <div
            className="px-5 py-4 rounded-xl text-center"
            style={{ background: 'rgba(180,83,9,0.04)', border: '1px dashed rgba(180,83,9,0.25)' }}
          >
            <p className="text-[14px] font-semibold text-heading">
              {access.state === 'read_only' ? 'Your access has ended' : `Practice opens ${ACCESS_OPENS_LABEL}`}
            </p>
            <p className="text-[13px] text-muted mt-1">
              {access.state === 'read_only' ? (
                <Link href="/pricing?renew=true" className="text-primary font-medium hover:underline">
                  Renew to practise again
                </Link>
              ) : (
                <>
                  In the meantime,{' '}
                  <Link href="/dashboard/library" className="text-primary font-medium hover:underline">
                    browse the case library
                  </Link>
                  .
                </>
              )}
            </p>
          </div>
        ) : (
          <Link href="/dashboard/library">
            <PrimaryButton size="lg" fullWidth>
              Start a New Session
            </PrimaryButton>
          </Link>
        )}
        {randomStation && (access?.allowed ?? true) && (
          <div className="text-center mt-2">
            <Link
              href={`/clinical-master/station/${randomStation.id}`}
              className="text-[13px] text-primary hover:underline"
            >
              or pick a random case &rarr;
            </Link>
          </div>
        )}
        {lastStation && (
          <div className="mt-4">
            <Container>
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <div className="text-[10px] font-semibold text-muted uppercase tracking-[0.1em] mb-1.5">
                    Unfinished Case
                  </div>
                  <div className="text-[15px] font-semibold text-heading truncate">{lastStation.title}</div>
                  <div className="flex items-center gap-2 mt-1">
                    <DomainTag name={lastStation.domain} size="sm" />
                    <span className="text-[12px] text-muted">{lastStation.patientName}</span>
                    <span className="text-[11px] text-muted">
                      Restarts from the beginning ({Math.floor(lastStation.timeRemaining / 60)} min)
                    </span>
                  </div>
                </div>
                <Link href={`/clinical-master/session/${lastStation.sessionId}?stationId=${lastStation.id}`} className="sm:w-auto">
                  <SecondaryButton size="sm" fullWidth>Restart case</SecondaryButton>
                </Link>
              </div>
            </Container>
          </div>
        )}
      </div>

      {/* Recent sessions */}
      {recentSessions.length > 0 && (
        <div
          className="mb-8"
        >
          <div className="flex items-baseline justify-between mb-3">
            <div className="text-[10px] font-semibold text-muted uppercase tracking-[0.1em]">
              Recent Sessions
            </div>
            <span className="text-[11px] text-muted">Scored out of 10.5, the SCA weighted total</span>
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
                  <div className="flex items-center gap-2 flex-shrink-0">
                    {session.scored ? (
                      <>
                        <span
                          className="text-[11px] font-semibold uppercase"
                          style={{ color: session.passed ? '#16A34A' : '#DC2626' }}
                        >
                          {session.verdict}
                        </span>
                        <span className="text-[12px] font-mono text-muted">
                          {session.weightedScore.toFixed(1)}/{session.maxScore.toFixed(1)}
                        </span>
                      </>
                    ) : (
                      <span className="text-[11px] font-medium text-muted">
                        {session.marking ? 'Marking…' : 'No feedback available'}
                      </span>
                    )}
                  </div>
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

/** useSearchParams needs a Suspense boundary for static prerendering. */
export default function DashboardPage() {
  return (
    <Suspense fallback={null}>
      <DashboardContent />
    </Suspense>
  );
}
