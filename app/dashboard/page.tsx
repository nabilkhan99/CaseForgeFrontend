'use client';

import { Suspense, useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import type { User } from '@supabase/supabase-js';
import Link from 'next/link';
import { motion, useReducedMotion } from 'framer-motion';
import { BlurFade } from '@/components/magicui/blur-fade';
import { NumberTicker } from '@/components/magicui/number-ticker';
import PrimaryButton from '@/components/ui/PrimaryButton';
import DomainTag from '@/components/ui/DomainTag';
import SessionOutcome from '@/components/ui/SessionOutcome';
import ArcGauge from '@/components/ui/ArcGauge';
import {
  getUserStats,
  getPerformanceMetrics,
  getSessionHistory,
} from '@/lib/supabase/queries/dashboard';
import { getRandomStation } from '@/lib/supabase/queries/station-library';
import type { Station } from '@/lib/supabase/queries/station-library';
import type {
  UserStats,
  PerformanceMetrics,
} from '@/lib/dashboard/types';
import type { SessionHistoryItem } from '@/lib/supabase/queries/dashboard';
import type { SubscriptionResponse } from '@/app/api/subscription/route';
import { formatRelativeDate } from '@/lib/utils';
import { claimTrialSessionsOnce } from '@/lib/trial/claimOnce';
import { ACCESS_OPENS_LABEL } from '@/lib/commerce/plans';
import {
  TONE_COLOUR,
  fmtMark,
  passMarkFor,
  passMarkPercent,
} from '@/lib/clinical-master/scoring';
import { MAX_WEIGHTED_SCORE } from '@/lib/clinical-master/types';

/**
 * Completed consultations needed before the trend report can say anything.
 * Mirrors MIN_CASES_FOR_TREND in app/api/clinical-master/trend/route.ts — below
 * it the page can only answer "not enough cases yet", so we don't offer it.
 */
const MIN_CASES_FOR_TREND = 3;

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

/**
 * Display names for the three SCA domains.
 *
 * The keys are the camelCase shape `PerformanceMetrics` uses; the third one is
 * mapped from the `relating_to_others` column in getPerformanceMetrics. Only
 * this dashboard ever called that domain "Interpersonal Skills" — the DB, the
 * marking engine, the feedback report and the exam itself all say "Relating to
 * Others", so a trainee comparing their dashboard to their report was reading
 * two names for one score. The label is corrected here; the key stays as-is
 * because it is the data contract, not the wording.
 */
const DOMAIN_LABELS: Record<string, string> = {
  dataGathering: 'Data Gathering',
  clinicalManagement: 'Clinical Management',
  interpersonalSkills: 'Relating to Others',
};

/**
 * Pass level on the 0–100 domain-average scale, derived rather than guessed.
 *
 * The bars this replaced drew their threshold at a hardcoded 70%, which was
 * simply wrong: the pass mark is 6.0 out of 10.5, or 57.1%. It is also the
 * right number for a *domain* average and not just for the weighted total —
 * the weighted score is g(D1) + 1.5·g(D2) + g(D3) out of 10.5, and GRADE_PCT
 * maps a grade to g/3 as a percentage, so three domains sitting at x% produce
 * exactly 10.5·x/100. Passing therefore means averaging 57.1% across the
 * three, and each dial's tick shows where that sits.
 */
const PASS_PERCENT = (passMarkFor() / MAX_WEIGHTED_SCORE) * 100;

const DAY_MS = 86_400_000;

/** How long before expiry the renewal nudge appears. */
const RENEWAL_WARNING_DAYS = 7;

function formatAccessDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-GB', {
    // The window ends at 23:59 UTC; format in UTC or BST shows the next day.
    timeZone: 'UTC',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}

function daysUntil(iso: string): number {
  return Math.ceil((new Date(iso).getTime() - Date.now()) / DAY_MS);
}

/**
 * Page-load stagger for the dashboard's top-level sections. Small increments
 * on purpose — this is a tool someone opens dozens of times, so the whole
 * sequence has to be over before it registers as a reveal.
 */
const REVEAL = {
  welcome: 0,
  onboarding: 0.06,
  quickStart: 0.12,
  recent: 0.18,
  progress: 0.24,
} as const;

/**
 * One entry animation per section. Under prefers-reduced-motion it renders the
 * final state immediately as a plain div — BlurFade has no reduced-motion
 * handling of its own, so the gate lives here at the call site.
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
  if (shouldReduceMotion) {
    return <div className={className}>{children}</div>;
  }
  return (
    <BlurFade delay={delay} className={className}>
      {children}
    </BlurFade>
  );
}

/**
 * A counting number. Same reduced-motion gate: the static figure, no spring.
 * NumberTicker renders the final value as real children, so the number is
 * correct before any JS runs too.
 */
function Tally({ value, className }: { value: number; className?: string }) {
  const shouldReduceMotion = useReducedMotion();
  if (shouldReduceMotion) return <>{value}</>;
  return <NumberTicker value={value} className={className} />;
}

/** Inherit the surrounding type rather than the ticker's own black/wide default. */
const TICKER_INLINE = 'text-inherit tracking-normal';

function DashboardContent() {
  const supabase = createClient();
  // `undefined` = auth not resolved yet; `null` = resolved, signed out. The
  // two used to share `null`, so the first render treated "not loaded" as
  // "signed out", skipped the subscription fetch, and painted "Good afternoon,
  // there — you're on the free tier" at paying customers on every load.
  const [user, setUser] = useState<User | null | undefined>(undefined);
  const [stats, setStats] = useState<UserStats>(defaultStats);
  const [metrics, setMetrics] = useState<PerformanceMetrics>(defaultMetrics);
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
        // Before the stats, not after: a claimed guest free mock has to be
        // counted in the "you've completed N sessions" line and appear in the
        // recent list, or the page tells them their work still isn't here.
        // Once per browser session, one indexed lookup, and it swallows its own
        // failures — see lib/trial/claimOnce.
        await claimTrialSessionsOnce();

        // getLastStation dropped with the unfinished-case strip it fed. It was
        // the only caller, so leaving it in this Promise.all would have been a
        // round trip to Supabase on every dashboard load for nothing.
        const [statsData, metricsData, recentData, randomStationData, accessRes] = await Promise.all([
          getUserStats(user.id),
          getPerformanceMetrics(user.id),
          getSessionHistory(user.id, 3, 0),
          getRandomStation(),
          fetch('/api/subscription').then((r) => (r.ok ? r.json() : null)),
        ]);

        setStats(statsData);
        setMetrics(metricsData);
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

  /**
   * Whether to frame the passed-station count as guarantee progress.
   *
   * The guarantee opens with "Join any of our plans", so it does not apply to
   * someone browsing without one — promising them £500 would be wrong. A null
   * count means the pass query failed, and a guarantee tracker reading 0 would
   * be a fabricated fact about money. Both cases fall back to the plain stat.
   */
  const showGuarantee =
    Boolean(access?.plan) &&
    stats.passedStations !== null &&
    stats.completedStations > 0 &&
    stats.totalStations > 0;

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
    // Headroom above the greeting, on top of the layout's pt-24. The padding
    // lives here rather than in app/dashboard/layout.tsx because that layout is
    // shared with Library, History, Lectures, Trend and Settings — raising it
    // there would silently re-space five other tabs.
    //
    // Sections sit on mb-10 rather than the old uniform mb-8, and the `tall:`
    // step (min-height 940px, i.e. external monitors only) widens them further.
    // De-carding the page took away the borders that used to do the separating,
    // so whitespace has to do that work now; a 13" laptop still gets the tighter
    // rhythm so the page does not turn into a scroll.
    <div className="pt-2 tall:pt-8">
      {/* Welcome section */}
      <Reveal delay={REVEAL.welcome} className="mb-10 tall:mb-14">
        <h1 className="text-[24px] font-bold text-heading tracking-[-0.02em]">
          {greeting}, {firstName}
        </h1>
        <p className="text-[13px] text-muted mt-1">
          {stats.completedStations > 0 ? (
            <>
              {/* Only the figures count up \u2014 the sentence around them stays put. */}
              You&apos;ve completed <Tally value={stats.completedStations} className={TICKER_INLINE} />{' '}
              session{stats.completedStations !== 1 ? 's' : ''}
              {stats.currentStreak >= 2 && (
                <>
                  {' \u00B7 '}
                  <Tally value={stats.currentStreak} className={TICKER_INLINE} />
                  -day streak
                </>
              )}
            </>
          ) : (
            'Start your first consultation to begin tracking progress'
          )}
        </p>
        <div className="flex flex-wrap items-center gap-2 mt-2">
          {/* Passing a station is the goal, so it gets its own headline number.
              Hidden until the first session — "Passed 0 of 78" is a poor greeting —
              and hidden again when the pass query failed (passedStations === null),
              because a confident zero would be a fabricated fact. */}
          {/* S2: with a plan, this count is progress toward the £500 guarantee
              and moves into its own block below. Without one, the guarantee does
              not apply ("Join any of our plans"), so it stays a plain stat. */}
          {!showGuarantee && stats.passedStations !== null && stats.completedStations > 0 && stats.totalStations > 0 && (
            /* Entry animation removed: the whole welcome block now fades in
               once via Reveal, and stacking a second fade on a child of it
               animated the same pixels twice. */
            <span
              className="inline-flex items-center gap-1.5 px-3 py-1 rounded-md text-[11px] font-medium font-mono"
              style={
                stats.passedStations > 0
                  ? { background: 'rgba(22,163,74,0.08)', color: '#15803D' }
                  : { background: 'rgba(0,0,0,0.03)', color: '#78716C' }
              }
            >
              Passed {stats.passedStations} of {stats.totalStations} stations
            </span>
          )}
          {!showGuarantee && stats.passedStations !== null && stats.completedStations > 0 && stats.totalStations > 0 && (
            <span className="text-[11px] text-muted">
              Passed means {fmtMark(passMarkFor())} / {fmtMark(MAX_WEIGHTED_SCORE)} or better
            </span>
          )}
          {stats.examCountdownDays > 0 && (
            <span
              className="inline-flex items-center gap-1.5 px-3 py-1 rounded-md text-[11px] font-medium font-mono"
              style={{ background: 'rgba(180,83,9,0.08)', color: '#92400E' }}
            >
              SCA exam in {stats.examCountdownDays} days
            </span>
          )}
        </div>
        {/* The cross-case trend report answers "am I getting better?", which is
            the whole reason someone pays for month two — and until now nothing
            in the product linked to it. Offered only once it has enough cases
            to say something. */}
        {stats.completedStations >= MIN_CASES_FOR_TREND && (
          <Link
            href="/dashboard/development"
            className="inline-block mt-3 text-[13px] font-medium text-primary hover:underline"
          >
            Your development picture &rarr;
          </Link>
        )}

        {/* S2 — the guarantee tracker.
            "Passed 0 of 200 stations" was the first fact the dashboard gave you,
            and with nothing attached it read as a tally of what you had not done.
            It is in fact the only view a customer has of a £500 cash promise, so
            it keeps its prominence and gets its meaning back.
            Wording follows the FAQ ("pass all 200 mock stations first, not just
            attempt them… unlimited tries… £500 within 5 working days"); the
            count is best-attempt, matching "unlimited tries", because
            passedStationIds() counts distinct stations with any passing attempt. */}
        {showGuarantee && (
          /* Entry animation removed for the same reason as the badge above —
             the Reveal on the welcome block covers this. The progress bar
             below keeps its fill animation: that is a value being drawn, not a
             second entrance.

             De-carded: a raised, bordered tile made this read as a widget
             bolted onto the greeting. Rules above and below give it the same
             separation without a container, matching the library's
             NextForYou band. The progress bar inside is the only thing here
             that still needs an edge, and it draws its own. */
          <div className="mt-6 border-y border-hairline py-5">
            <div className="flex items-baseline justify-between gap-3">
              <span className="text-[11px] font-semibold uppercase tracking-[0.13em] text-primary">
                Your £500 guarantee
              </span>
              <span className="font-mono text-[13px] font-bold tabular-nums text-heading">
                {/* Numerator only: the denominator is a fixed fact, not progress. */}
                <Tally value={stats.passedStations ?? 0} className={TICKER_INLINE} />
                <span className="font-normal text-muted"> / {stats.totalStations}</span>
              </span>
            </div>
            <div className="mt-2.5 h-1.5 overflow-hidden rounded-full bg-black/[0.05]">
              <motion.div
                className="h-full rounded-full bg-primary"
                initial={{ width: 0 }}
                animate={{
                  width: `${Math.min(100, ((stats.passedStations ?? 0) / stats.totalStations) * 100)}%`,
                }}
                transition={{ duration: 0.9, ease: [0.16, 0.84, 0.36, 1] }}
              />
            </div>
            <p className="mt-2.5 text-[11.5px] leading-[1.5] text-muted">
              Pass all {stats.totalStations} stations, sit your SCA, and if you don&apos;t pass we
              send you <span className="font-medium text-body">£500 in cash</span> within 5 working
              days. Unlimited attempts — a station counts once you score{' '}
              {fmtMark(passMarkFor())} / {fmtMark(MAX_WEIGHTED_SCORE)} or better.{' '}
              <Link href="/pricing" className="font-medium text-primary hover:underline">
                How it works
              </Link>
            </p>
          </div>
        )}
      </Reveal>

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
        /* Two different situations share this banner, and only one of them is
           an alert. Unbounced it is a standing status a preorder buyer reads
           on every load for weeks — that is a hairline row, not a tinted
           surface. Bounced, it is the explanation for a case that has just
           refused to open, so it keeps the tint: the user arrived here looking
           for exactly this sentence and it must not read as page furniture.
           Inline rgba swapped for the primary token either way. */
        <motion.div
          className={
            bouncedPending
              ? 'mb-6 tall:mb-8 rounded-[10px] border border-primary/[0.12] bg-primary/[0.06] px-4 py-3'
              : 'mb-6 tall:mb-8 border-y border-hairline py-3.5'
          }
          initial={{ opacity: 0, y: -4 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <p className="text-[13px] text-heading">
            {bouncedPending ? 'Not long now — that case opens on ' : <>You&apos;re in{access.planName ? ` — ${access.planName}` : ''}. Your access opens on </>}
            <span className="font-medium">{ACCESS_OPENS_LABEL}</span>.
            {bouncedPending && ' Your plan is ready; consultations start then.'}
          </p>
        </motion.div>
      )}
      {/* S1: the "you don't have a plan yet" strip used to live here, as a
          13px link, above a dashed box announcing a start date. The quick-start
          block below now carries that as the page's primary action, so saying it
          twice — quietly first — only competed with itself. */}
      {access?.state === 'read_only' && !access.bypass && (
        /* Kept on a tinted surface. De-carding uniformly would have flattened
           the one message on this page that costs the reader money to miss:
           practice has stopped and only renewing restarts it. Same rgba values
           as before, expressed as primary tokens rather than an inline style. */
        <motion.div
          className="mb-6 tall:mb-8 rounded-[10px] border border-primary/[0.18] bg-primary/[0.08] px-4 py-3"
          initial={{ opacity: 0, y: -4 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <p className="text-[13px] text-heading">
            Your access has ended &mdash; your history stays available.{' '}
            <Link href="/pricing?renew=true" className="text-primary font-medium hover:underline">
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
          /* Also kept tinted. This one has a deadline attached — it is the last
             prompt that can still change the outcome before access ends — and a
             countdown that reads as quietly as the plan name below it would not
             be a countdown at all. */
          <motion.div
            className="mb-6 tall:mb-8 rounded-[10px] border border-primary/[0.12] bg-primary/[0.06] px-4 py-3"
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
          >
            <p className="text-[13px] text-heading">
              Your plan expires in {daysLeft} day{daysLeft !== 1 ? 's' : ''} &mdash;{' '}
              <Link href="/pricing?renew=true" className="text-primary font-medium hover:underline">
                renew to keep access
              </Link>
            </p>
          </motion.div>
        );
      })()}
      {access?.state === 'active' && access.planName && (
        <motion.div
          className="mb-6 tall:mb-8 text-[13px] text-muted"
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
        /* De-carded. Three numbered steps between two rules is the house style
           for exactly this ("features as numbered rows"), and the raised card
           was giving a one-off explainer more visual weight than the primary
           action directly beneath it. */
        <Reveal
          delay={REVEAL.onboarding}
          className="mb-10 tall:mb-14 border-y border-hairline py-6 tall:py-8"
        >
          <div className="text-[11px] font-semibold text-primary uppercase tracking-[0.1em] mb-4">
            How it works
          </div>
          <div className="flex flex-col sm:flex-row gap-6 sm:gap-10">
            <div className="flex-1">
              <div className="text-[24px] font-semibold text-primary/20 font-mono mb-1">01</div>
              <div className="text-[15px] font-medium text-heading mb-1">Pick a case</div>
              <div className="text-[13px] text-muted">
                Choose from {stats.totalStations > 0 ? `${stats.totalStations} stations` : 'stations'} across every SCA domain
              </div>
            </div>
            <div className="flex-1">
              <div className="text-[24px] font-semibold text-primary/20 font-mono mb-1">02</div>
              <div className="text-[15px] font-medium text-heading mb-1">Talk to your patient</div>
              <div className="text-[13px] text-muted">Voice consultation with an AI patient that responds naturally</div>
            </div>
            <div className="flex-1">
              <div className="text-[24px] font-semibold text-primary/20 font-mono mb-1">03</div>
              <div className="text-[15px] font-medium text-heading mb-1">Get scored</div>
              <div className="text-[13px] text-muted">Scored feedback on all three SCA domains, a couple of minutes after you finish</div>
            </div>
          </div>
        </Reveal>
      )}

      {/* Quick start. A buyer whose window hasn't opened (or has closed) can
          browse the library but not start — say so here rather than letting
          the button bounce them back to this page with no explanation. */}
      <Reveal delay={REVEAL.quickStart} className="mb-10 tall:mb-14">
        {access && !access.allowed && !access.plan && !access.bypass ? (
          /* S1: no plan at all is a different situation from a plan that hasn't
             opened yet, and it used to render as the latter — telling someone
             who has bought nothing that "practice opens 1 September", while the
             one action they can actually take sat in a 13px link further up. */
          <>
            <Link href="/pricing">
              <PrimaryButton size="lg" fullWidth>
                See plans
              </PrimaryButton>
            </Link>
            <p className="text-center mt-2 text-[13px] text-muted">
              Or{' '}
              <Link href="/dashboard/library" className="text-primary hover:underline">
                browse the case library
              </Link>{' '}
              free while you decide.
            </p>
          </>
        ) : access && !access.allowed ? (
          /* De-carded. For the read_only case this dashed box repeated the
             tinted banner at the top of the page almost word for word, so two
             competing surfaces were delivering one message; the banner keeps
             the tint and this keeps the type. Nothing here is an action the
             user can take that the banner has not already offered. */
          <div className="border-y border-hairline py-5 text-center">
            <p className="text-[15px] font-semibold text-heading">
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
        {/* The "Unfinished Case" strip stood here. Removed on the product
            owner's call: it could only ever offer a restart from the beginning,
            which is the same thing the library button above already does, and a
            second card competing with the page's primary action bought nothing.
            Its query (getLastStation) went with it. */}
      </Reveal>

      {/* Recent sessions */}
      {recentSessions.length > 0 && (
        <Reveal delay={REVEAL.recent} className="mb-10 tall:mb-14">
          {/* The scale caption that sat opposite this eyebrow is gone on the
              product owner's call. Each row already carries a SessionOutcome
              that states its own verdict, and the guarantee block above spells
              the pass mark out in full, so the header was explaining a scale
              twice over. */}
          <div className="text-[11px] font-semibold text-muted uppercase tracking-[0.1em] mb-3">
            Recent Sessions
          </div>
          <div className="divide-y divide-hairline">
            {/* Per-row entry animations dropped: the Reveal above already
                brings this list in, and running both meant every row faded
                twice, out of step with the block containing it. */}
            {recentSessions.map((session) => (
              <div key={session.id}>
                <Link
                  href={`/clinical-master/feedback/${session.id}`}
                  className="flex items-center gap-3 py-3 hover:bg-black/[0.02] px-2 -mx-2 rounded-[10px] transition-colors"
                >
                  <div className="flex-1 min-w-0">
                    <div className="text-[15px] font-medium text-heading truncate">{session.stationTitle}</div>
                    <div className="flex items-center gap-2 mt-0.5">
                      <DomainTag name={session.domainName} size="sm" />
                      <span className="text-[11px] text-muted">{formatRelativeDate(session.completedAt)}</span>
                    </div>
                  </div>
                  {/* S4: shared with the history page so the two can't drift
                      apart again — they had already grown different wording for
                      the same state. */}
                  <div className="flex-shrink-0">
                    <SessionOutcome session={session} />
                  </div>
                </Link>
              </div>
            ))}
          </div>
          {/* Was "View all history" pointing at a page that listed every
              session. That page is now Development, which has no list on it at
              all — so the link follows the list rather than the URL: past
              attempts live on the Library's topic pages, next to the case they
              belong to. */}
          <Link
            href="/dashboard/library"
            className="text-[13px] text-primary hover:underline mt-2 inline-block"
          >
            View all your cases
          </Link>
        </Reveal>
      )}

      {/* Domain progress */}
      {(metrics.dataGathering > 0 || metrics.clinicalManagement > 0 || metrics.interpersonalSkills > 0) && (
        <Reveal delay={REVEAL.progress}>
          <div className="text-[11px] font-semibold text-muted uppercase tracking-[0.1em] mb-2">
            Your Progress
          </div>
          {/* What these numbers are an average OF, said once for all three
              dials rather than three times.

              This matters more than it looks. The figures come from four grade
              bands (CP/P/F/CF → 100/67/33/0) averaged across marked
              consultations, so after one case a dial can only read 0, 33, 67 or
              100, and after two only nine values exist. A percentage sign
              promises continuous precision the data cannot deliver, so the
              caption says out loud that the scale is stepped — and the numbers
              render as whole percentages with no decimal and no counting
              animation, since a ticker sweeping through 41, 42, 43 would show
              readings that can never actually occur. */}
          <p className="mb-6 max-w-[62ch] text-[11.5px] leading-[1.5] text-muted">
            Your average grade in each domain across every marked consultation. The
            tick marks pass level — {fmtMark(passMarkFor())} / {fmtMark(MAX_WEIGHTED_SCORE)},
            or {passMarkPercent()}%. Each consultation is graded in four bands, so
            these figures move in steps; expect large jumps until you have a dozen
            cases behind you.
          </p>
          <div className="grid grid-cols-1 gap-8 sm:grid-cols-3 sm:gap-4">
            {/* No entrance animation per dial: the Reveal above already brings
                this block in, and the file has learned four times over what
                happens when a child fades inside a parent that is already
                fading. The arc sweep is a value being drawn, which is the one
                kind of motion allowed in here — and ArcGauge gates that sweep
                on useReducedMotion internally (collapsing it to duration 0
                rather than branching on `initial`, so hydration still matches),
                so `delay` only staggers a motion that can already switch itself
                off. No second gate is needed at this call site. */}
            {domainEntries.map((entry, i) => {
              // Green once the domain average is at or above pass level, amber
              // below. Two tones, not the report's three: a red dial on the
              // page you open every morning would be a verdict on a rolling
              // average, and an average is not a verdict.
              const tone = entry.value >= PASS_PERCENT ? 'pass' : 'borderline';
              return (
                <div key={entry.key} className="flex flex-col items-center">
                  <ArcGauge
                    value={entry.value}
                    max={100}
                    threshold={PASS_PERCENT}
                    size={176}
                    thickness={11}
                    colour={TONE_COLOUR[tone]}
                    label={`${DOMAIN_LABELS[entry.key]}: ${entry.value}% average grade. Pass level is ${passMarkPercent()}%.`}
                    delay={0.25 + i * 0.12}
                  >
                    <span className="font-mono text-[30px] font-bold leading-none tabular-nums text-heading">
                      {entry.value}
                      <span className="text-[16px] font-medium text-muted">%</span>
                    </span>
                  </ArcGauge>
                  <div className="mt-1 text-center text-[13px] font-medium text-heading">
                    {DOMAIN_LABELS[entry.key]}
                  </div>
                </div>
              );
            })}
          </div>
          <Link
            href="/dashboard/library"
            className="text-[13px] text-primary hover:underline mt-3 inline-block"
          >
            View library
          </Link>
        </Reveal>
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
