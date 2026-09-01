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
import TrainingHeatmap from '@/components/dashboard/TrainingHeatmap';
import { getUserStats, getDailyActivityTimestamps } from '@/lib/supabase/queries/dashboard';
import { getRandomStation, getStationIndex } from '@/lib/supabase/queries/station-library';
import type { Station } from '@/lib/supabase/queries/station-library';
import { saveExamDate } from '@/lib/supabase/queries/profile';
import { dailySeed, pickNextForYou } from '@/lib/stations/librarySearch';
import {
  buildIntensityCalendar,
  intensityWindowStart,
  type IntensityCalendar,
} from '@/lib/dashboard/trainingIntensity';
import type { UserStats } from '@/lib/dashboard/types';
import type { SubscriptionResponse } from '@/app/api/subscription/route';
import { claimTrialSessionsOnce } from '@/lib/trial/claimOnce';

const defaultStats: UserStats = {
  currentStreak: 0,
  completedStations: 0,
  totalStations: 0,
  examCountdownDays: 0,
  examDate: null,
};

const DAY_MS = 86_400_000;

/** How long before expiry the renewal nudge appears. */
const RENEWAL_WARNING_DAYS = 7;

function daysUntil(iso: string): number {
  return Math.ceil((new Date(iso).getTime() - Date.now()) / DAY_MS);
}

/**
 * Days until a `YYYY-MM-DD` exam date, or null when it is not a date at all.
 *
 * Deliberately the same arithmetic getUserStats runs on the stored value: a
 * date this accepted but that query floored to 0 would save successfully and
 * then show no countdown, which reads as a lost write.
 */
function daysUntilExamDate(value: string): number | null {
  if (!value) return null;
  const when = new Date(value);
  return Number.isNaN(when.getTime()) ? null : daysUntil(value);
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
  intensity: 0.18,
  guarantee: 0.24,
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
  const [upNext, setUpNext] = useState<Station | null>(null);
  const [calendar, setCalendar] = useState<IntensityCalendar | null>(null);
  // Pass progress for the guarantee line, counted off the station index the
  // picker already fetches — no extra query. null when the index came back
  // empty (which is also what a failed fetch looks like), so a rendered count
  // is always one counted from real rows, never a fabricated zero.
  const [passProgress, setPassProgress] = useState<{ passed: number; total: number } | null>(null);
  // `undefined` = not fetched yet; `null` = the lookup failed. Only a loaded
  // answer may drive a "you have no plan" message.
  const [access, setAccess] = useState<SubscriptionResponse | null | undefined>(undefined);
  const [loading, setLoading] = useState(true);
  // The inline exam-date affordance, shown only where the countdown can't be.
  const [examDraft, setExamDraft] = useState('');
  const [examSaving, setExamSaving] = useState(false);
  const [examError, setExamError] = useState<string | null>(null);
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
        // getPerformanceMetrics went the same way with the three domain dials.
        //
        // One clock for the whole load: the activity window, the day the
        // recommendation is seeded on and the calendar all have to agree, and a
        // render that straddled midnight would build them from two dates.
        const today = new Date();
        const [statsData, stationIndex, activity, accessRes] = await Promise.all([
          getUserStats(user.id),
          getStationIndex(user.id),
          getDailyActivityTimestamps(user.id, intensityWindowStart(today).toISOString()),
          fetch('/api/subscription').then((r) => (r.ok ? r.json() : null)),
        ]);

        setStats(statsData);
        setExamDraft(statsData.examDate ?? '');
        setCalendar(buildIntensityCalendar(activity, today));
        setPassProgress(
          stationIndex.length > 0
            ? { passed: stationIndex.filter((s) => s.passed).length, total: stationIndex.length }
            : null,
        );
        setAccess(accessRes?.state ? (accessRes as SubscriptionResponse) : null);

        // The picker only ever offers a station the user has never attempted,
        // so it runs out once the bank is exhausted; a random case is still a
        // case to practise.
        const recommended = pickNextForYou(stationIndex, dailySeed(today, user.id));
        setUpNext(recommended ?? (await getRandomStation()));
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
   * Whether the trainee may start a consultation right now.
   *
   * The same test the quick-start block below has always switched on: an
   * unanswered or failed subscription lookup counts as allowed, because the one
   * thing worse than offering a case to someone who cannot open it is hiding
   * the product from someone who has paid.
   */
  const canStart = access?.allowed ?? true;

  const shouldReduceMotion = useReducedMotion();

  /**
   * The guarantee opens with "Join any of our plans", so the line renders only
   * for someone holding one — promising a browser £500 would be wrong. Not
   * gated on `canStart`: an expired plan-holder's progress toward the promise
   * is still theirs, and still the argument for renewing.
   */
  const showGuarantee =
    Boolean(access?.plan) && passProgress !== null && stats.completedStations > 0;

  const handleSaveExamDate = async () => {
    if (!user?.id) return;

    const days = daysUntilExamDate(examDraft);
    if (days === null || days <= 0) {
      setExamError('Pick a date in the future.');
      return;
    }

    setExamSaving(true);
    setExamError(null);
    // saveExamDate reports failure in its return value, but supabase-js can
    // also reject outright (network drop, aborted fetch) — and a rejection
    // escaping this handler would leave the button stuck on "Saving…" with no
    // error and no way back short of a reload.
    let saved = false;
    try {
      saved = await saveExamDate(user.id, examDraft);
    } catch (error: unknown) {
      console.error('[dashboard] exam date save failed', error);
    } finally {
      setExamSaving(false);
    }

    if (!saved) {
      setExamError('That didn’t save. Try again.');
      return;
    }

    // The countdown reads from `stats`, so it is updated in place rather than
    // reloading a whole dashboard around a one-field save.
    setStats((previous) => ({ ...previous, examDate: examDraft, examCountdownDays: days }));
  };

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
        <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-4">
          <div className="min-w-0">
            <h1 className="text-[24px] font-bold text-heading tracking-[-0.02em]">
              {greeting}, {firstName}
            </h1>
            {/* The tally and the pass mark have gone. The count is a headline
                figure on the board below and the pass mark is printed on every
                report, so on a page opened daily this line only restated two
                numbers the reader already had. The first-run instruction stays:
                it is the one case with nothing else on screen to say it. */}
            {stats.completedStations === 0 && (
              <p className="text-[13px] text-muted mt-1">
                Start your first consultation to begin tracking progress
              </p>
            )}
          </div>

          {/* The countdown, or the question that produces one.
              stats.examCountdownDays is floored at 0, so it cannot distinguish
              "no date" from "date already past" \u2014 stats.examDate does, and both
              of those cases want the same thing: a date. */}
          {stats.examCountdownDays > 0 ? (
            <div className="flex flex-shrink-0 items-baseline gap-2">
              <span className="font-mono text-[36px] font-bold leading-none text-primary">
                <Tally value={stats.examCountdownDays} className={TICKER_INLINE} />
              </span>
              <span className="text-[14px] text-body">days to your SCA</span>
            </div>
          ) : (
            /* Quiet on purpose. It occupies the countdown's slot without
               becoming a second call to action competing with "Up next", and it
               is the one field that turns this page from a log into a deadline. */
            <div className="flex-shrink-0">
              <label htmlFor="home-exam-date" className="text-[11px] text-muted">
                When&apos;s your SCA?
              </label>
              <div className="mt-1 flex items-center gap-2">
                <input
                  id="home-exam-date"
                  type="date"
                  value={examDraft}
                  onChange={(e) => {
                    setExamDraft(e.target.value);
                    setExamError(null);
                  }}
                  className="rounded-[8px] border border-defined bg-white/70 px-2.5 py-1.5 font-mono text-[13px] text-heading focus:outline-none focus:ring-2 focus:ring-primary/30"
                />
                <button
                  type="button"
                  onClick={handleSaveExamDate}
                  disabled={examSaving || !examDraft}
                  className="text-[13px] font-medium text-primary hover:underline disabled:opacity-40 disabled:hover:no-underline"
                >
                  {examSaving ? 'Saving\u2026' : 'Save'}
                </button>
              </div>
              {/* Inline, not a banner: a wrong date in one field is not news
                  the whole page needs to carry. */}
              {examError && <p className="mt-1 text-[11px] text-danger">{examError}</p>}
            </div>
          )}
        </div>
        {/* Three things stood under this greeting and were removed on the
            product owner's call, not lost in the rewrite: the "Passed X of Y
            stations" badge, the £500 guarantee tracker, and the "Your
            development picture" link. The first two put pass/fail framing on
            the one page a trainee cannot avoid — the guarantee returned on the
            same call, but as one line below the board, after the practice loop
            rather than ahead of it. The development picture needs no link from
            here any more: the Development tab in the nav is its front door. */}
      </Reveal>

      {/* Plan state. Expiry is read-only, not a lockout: the loud banner says so,
          because the history and feedback below it still work.

          A failed /api/subscription lookup leaves `access` null and falls into
          the same "no plan" prompt the old subscriptions-table banner showed —
          silence would be worse, because the buy path would simply vanish.
          `bypass` (admin, staged deployment, fail-open) suppresses the nags:
          those users have access, whatever their own purchases say. */}
      {/* state 'none' WITH a plan = a purchase whose window hasn't opened. Since
          the 1 September floor was retired that only happens on a start date we
          agreed in writing, so the date is the entitlement's own, not a fixed
          launch day. They paid; the one message that must never appear is
          "upgrade". */}
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
            {bouncedPending
              ? 'Not long now: that case opens when your access period starts.'
              : <>You&apos;re in{access.planName ? `: ${access.planName}` : ''}. Your access hasn&apos;t opened yet.</>}
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
      {/* The plan name and access-until date used to stand here. They belong to
          Settings → Plan, which already carries both alongside the billing
          controls; on the home page they were a fact restated every visit. The
          expiry prompts above stay — those are deadlines, not status. */}

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
             who has bought nothing that practice had not opened, while the
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
              {access.state === 'read_only' ? 'Your access has ended' : 'Your access has not opened yet'}
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
        ) : upNext ? (
          /* One named case instead of a button to a wall of 200.
             "Start a New Session" handed the decision back to the reader at the
             exact moment they had opened the page to be told what to do, and the
             random-case link beside it made the choice look arbitrary. This is
             the same daily recommendation the library makes, so the two surfaces
             point at one case rather than two. */
          <div className="flex flex-wrap items-end justify-between gap-x-8 gap-y-4">
            <div className="min-w-0">
              <div className="text-[10px] font-semibold uppercase tracking-[0.13em] text-primary">
                Up next
              </div>
              <div className="mb-1 mt-2 text-[24px] font-bold leading-[1.2] tracking-[-0.025em] text-heading">
                {upNext.title}
              </div>
              <div className="text-[13px] text-muted">
                {upNext.domain_name} &middot;{' '}
                {Math.round(upNext.consultation_duration_seconds / 60)} min
              </div>
            </div>
            <div className="flex flex-shrink-0 items-center gap-4">
              <Link href={`/clinical-master/station/${upNext.id}`}>
                <PrimaryButton size="sm">Start consultation &rarr;</PrimaryButton>
              </Link>
              <Link
                href="/dashboard/library"
                className="text-[12px] text-muted hover:text-primary hover:underline"
              >
                or pick another
              </Link>
            </div>
          </div>
        ) : (
          /* No station at all — an empty bank, or both lookups failed. The
             library still opens, so the page keeps a way in rather than
             rendering a hole where its primary action belongs. */
          <Link href="/dashboard/library">
            <PrimaryButton size="lg" fullWidth>
              Start a New Session
            </PrimaryButton>
          </Link>
        )}
        {/* The "Unfinished Case" strip stood here. Removed on the product
            owner's call: it could only ever offer a restart from the beginning,
            which is the same thing the library button above already does, and a
            second card competing with the page's primary action bought nothing.
            Its query (getLastStation) went with it. */}
      </Reveal>

      {/* Training intensity — the page's centrepiece.

          It replaces three domain dials and a three-row session list. Both were
          answers to "how did I do?", asked of someone who has just arrived to
          decide whether to practise today; a rolling average of four grade bands
          cannot move on the strength of one more case, so the page's biggest
          number was also its least responsive to the only thing the reader
          controls. Consultations per day can only go up, and it goes up the same
          evening.

          Hidden until the first session: an all-grey board greets nobody, and
          the "How it works" rows above are the right first screen. Gated on
          `canStart` with the hero, so a page that cannot offer practice does not
          lead with a record of it. */}
      {stats.completedStations > 0 && calendar && canStart && (
        <Reveal delay={REVEAL.intensity} className="mb-10 tall:mb-14">
          <TrainingHeatmap calendar={calendar} />
        </Reveal>
      )}

      {/* The £500 guarantee, back as one line: the S2 block left with the
          score-first page, but this is the only in-product surface the cash
          promise has, so it returns at the width of a rule — a bar filling
          toward the £500 at its far end. Wording follows the FAQ; the count is
          best-attempt, matching "unlimited tries". */}
      {showGuarantee && passProgress && (
        <Reveal delay={REVEAL.guarantee} className="mb-10 tall:mb-14">
          <div className="flex items-baseline justify-between gap-3">
            <span className="text-[11px] font-semibold uppercase tracking-[0.13em] text-primary">
              Your £500 guarantee
            </span>
            <span className="font-mono text-[11px] tabular-nums text-muted">
              {passProgress.passed} of {passProgress.total} passed
            </span>
          </div>
          <div className="mt-2.5 flex items-center gap-3">
            <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-black/[0.05]">
              {/* The fill is a value being drawn, not an entrance, so it keeps
                  its sweep — collapsed to 0s under reduced motion rather than
                  branching on `initial`, the same gate the heatmap uses. */}
              <motion.div
                className="h-full rounded-full bg-primary"
                initial={{ width: 0 }}
                animate={{
                  width: `${Math.min(100, (passProgress.passed / passProgress.total) * 100)}%`,
                }}
                transition={{ duration: shouldReduceMotion ? 0 : 0.9, ease: [0.16, 0.84, 0.36, 1] }}
              />
            </div>
            <span className="flex-shrink-0 font-mono text-[13px] font-bold text-heading">£500</span>
          </div>
          <p className="mt-2 text-[11.5px] leading-[1.5] text-muted">
            Pass all {passProgress.total} stations, sit your SCA, and if you don&apos;t pass we send
            you £500 in cash — unlimited attempts.{' '}
            <Link href="/pricing" className="font-medium text-primary hover:underline">
              How it works
            </Link>
          </p>
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
