'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { motion, useReducedMotion } from 'framer-motion';
import type { Transition } from 'framer-motion';
import type { User } from '@supabase/supabase-js';
import PageHeader from '@/components/ui/PageHeader';
import type { LecturesResponse, LectureSummary } from '@/app/api/lectures/route';
import type { EntitlementState } from '@/lib/commerce/entitlements';
import type { SubscriptionResponse } from '@/app/api/subscription/route';
import { upgradeEnquiryMailto } from '@/lib/commerce/upgrade';
import { createClient } from '@/lib/supabase/client';
import { getLectureProgress } from '@/lib/supabase/queries/lectureProgress';
import {
  describeWatchedOffset,
  lectureWatchStatus,
  minutesLeft,
  pickLectureHero,
  watchedFraction,
  type LectureHeroMode,
  type LectureProgressMap,
  type LectureWatchStatus,
} from '@/lib/lectures/progress';

/**
 * The lecture course.
 *
 * Shape: one dark "cinema" hero for the lecture worth watching next, then the
 * whole course as typographic rows. No thumbnails anywhere — there is no
 * artwork for these lectures and inventing gradient rectangles to stand in for
 * it was explicitly rejected, so the running order (mono numbers), the titles
 * and the real descriptions do the work.
 *
 * WHAT THE HERO MEANS HERE. `lecture_progress` records the furthest position
 * each user reached in each lecture, so the hero is now genuinely personal:
 * the half-watched lecture they touched most recently (RESUME), else the first
 * one they have not finished (NEXT UP), else — for someone who has watched the
 * lot — the one they finished last (WATCH AGAIN). A signed-out or brand-new
 * visitor has no rows at all, which lands on lecture 01 with the original
 * START HERE copy: "next up" implies a history they don't have yet.
 *
 * The list underneath shows every lecture regardless of which one the hero
 * took, because the hero is a suggestion and the running order is the course.
 * That means the hero's lecture appears twice on a first visit; the row marks
 * itself "Resuming above" so the repetition reads as deliberate.
 *
 * Locked users see the same list, greyed — the running order and the titles are
 * the upgrade pitch, so this page never renders an empty "you don't have this"
 * screen; it renders what they'd get. Deliberately NO dark hero when locked:
 * the hero's whole proposition is a big play button, and offering one to
 * someone who cannot press it is a tease that breaks on click. Locked keeps the
 * merchandising card plus the full greyed running order instead.
 *
 * Why the lock copy branches: someone who bought Complete and let it lapse owns
 * this course already. Telling them to "upgrade" to the thing they paid for
 * reads as a bug and sends them to the wrong /pricing notice, so read_only gets
 * renew language. And a lock caused by a broken entitlement lookup is not a
 * tier at all — it gets neither pitch, just "try again".
 */

interface LockNotice {
  copy: string;
  href: string | null;
  cta: string | null;
}

function lockNotice(state: EntitlementState, unavailable: boolean): LockNotice {
  if (unavailable) {
    return {
      copy: 'Lectures are temporarily unavailable — try again shortly.',
      href: null,
      cta: null,
    };
  }
  if (state === 'read_only') {
    return {
      copy: 'Your access has ended —',
      href: '/pricing?renew=true',
      cta: 'renew to keep watching',
    };
  }
  return {
    copy: 'The lecture course is part of Complete —',
    href: '/pricing?want=lectures',
    cta: 'see what Complete adds',
  };
}

function totalMinutes(lectures: LectureSummary[]): number {
  return Math.round(lectures.reduce((sum, l) => sum + (l.durationSeconds ?? 0), 0) / 60);
}

/**
 * The locked state is a merchandising surface, not an error: the one thing
 * Self-Study lacks, shown as something worth having. One card, house style —
 * the list underneath stays as bare rows between rules.
 */
/** The hero's single primary action, shared by both of its two shapes. */
const UPGRADE_CTA_CLASS =
  'inline-flex items-center min-h-[44px] px-5 rounded-[10px] text-[14px] font-semibold text-white bg-gradient-to-br from-[#B45309] to-[#D97706] shadow-[0_4px_12px_rgba(180,83,9,0.2)] disabled:opacity-60';

function UpgradeHero({ lectures, upgradeHref }: { lectures: LectureSummary[]; upgradeHref: string | null }) {
  const mins = totalMinutes(lectures);
  const n = lectures.length;
  // Only quantify once there is something to quantify — "18 minutes of
  // teaching" undersells a course that is still being published.
  const substantial = n >= 6 && mins >= 120;
  const hours = substantial ? `${Math.round(mins / 60)} hours` : null;
  return (
    <motion.div
      className="mb-8 rounded-[16px] px-6 py-6 sm:px-8 sm:py-7 shadow-elevation-2"
      style={{
        background: 'linear-gradient(135deg, rgba(180,83,9,0.05), rgba(180,83,9,0.02))',
        border: '1px solid rgba(180,83,9,0.12)',
      }}
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ type: 'spring', stiffness: 80, damping: 20 }}
    >
      <div className="text-[11px] font-semibold text-primary uppercase tracking-[0.1em] mb-3">
        Included with Complete
      </div>
      <h2 className="text-[24px] font-semibold text-heading tracking-[-0.01em] mb-2">
        {hours ? `${hours} of on-demand SCA teaching` : 'The on-demand SCA lecture course'}
      </h2>
      <p className="text-[15px] leading-[1.65] text-muted max-w-xl mb-5">
        {substantial ? `${n} lectures across the three SCA domains` : 'Lectures across the three SCA domains'}, taught
        against the marking framework your consultations are scored on &mdash; watch as often as you like for the
        length of your plan. Complete also adds a coaching day.
      </p>
      {/* A live Self-Study customer asks for the upgrade by email and it is
          quoted by hand — the Portal cannot switch a one-off plan (see
          UPGRADEABLE_FROM). Everyone else — no plan, or a lapsed one — belongs
          on the acquisition page. */}
      {upgradeHref ? (
        <>
          <a href={upgradeHref} className={UPGRADE_CTA_CLASS}>
            Upgrade to Complete &rarr;
          </a>
          <p className="text-[13px] text-muted mt-3">
            Email us and we&rsquo;ll reply with your price &mdash; you only pay the difference.
          </p>
        </>
      ) : (
        <Link href="/pricing?want=lectures" className={UPGRADE_CTA_CLASS}>
          See what Complete adds &rarr;
        </Link>
      )}
    </motion.div>
  );
}

function formatDuration(seconds: number | null): string | null {
  if (!seconds || seconds <= 0) return null;
  const mins = Math.round(seconds / 60);
  return `${mins} min`;
}

/**
 * `description` is nullable and, on the one lecture published today, holds a
 * placeholder ("ff INTRO"). Nothing can tell a placeholder from real copy, so
 * the only thing worth defending against is null/whitespace — which would
 * otherwise paint a blank line under the title. There is deliberately no
 * fallback string: absence is fine, invention is not. Locked users get null
 * from the API by design, which lands here too.
 */
function cleanDescription(description: string | null): string | null {
  const trimmed = description?.trim();
  return trimmed ? trimmed : null;
}

/** Running-order number, zero-padded. Position in the list, not sort_order —
 *  sort_order is an arbitrary int and today's only lecture is 0. */
function runningNumber(position: number): string {
  return String(position).padStart(2, '0');
}

/**
 * Entrance transitions for the page, switched off under prefers-reduced-motion.
 *
 * Reduced motion collapses the duration to zero rather than dropping `initial`:
 * the server cannot know the preference, so branching on `initial` would hand
 * React different markup to hydrate. A zero-duration transition lands on the
 * final state in the same frame. Same pattern as ArcGauge.
 */
function useEntrance(): (delay: number) => Transition {
  const shouldReduceMotion = useReducedMotion();
  return (delay: number) =>
    shouldReduceMotion ? { duration: 0 } : { duration: 0.42, delay, ease: 'easeOut' };
}

const HERO_BACKGROUND = 'linear-gradient(140deg, #292420 0%, #1C1917 55%, #241d15 100%)';
/** Soft amber light bleeding in at two opposite corners, so the panel reads as
 *  lit rather than as a black rectangle. */
const HERO_GLOW =
  'radial-gradient(58% 78% at 100% 0%, rgba(245,158,11,0.20), transparent 62%), ' +
  'radial-gradient(55% 75% at 0% 100%, rgba(180,83,9,0.20), transparent 58%)';

function PlayTriangle({ className }: { className: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M8 5.5v13l11-6.5-11-6.5z" />
    </svg>
  );
}

function LockGlyph() {
  return (
    <svg
      className="w-3.5 h-3.5 flex-shrink-0"
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth={2}
      aria-hidden="true"
    >
      <path strokeLinecap="round" strokeLinejoin="round" d="M16 11V7a4 4 0 10-8 0v4M6 11h12v9H6z" />
    </svg>
  );
}

/** The one green in the palette, reserved for "you have finished this". */
const WATCHED_GREEN = '#15803D';
/** Progress fill. Brighter than the primary so it reads on the dark hero too. */
const PROGRESS_AMBER = '#F59E0B';

function TickGlyph() {
  return (
    <svg
      className="w-3.5 h-3.5 flex-shrink-0"
      fill="none"
      viewBox="0 0 24 24"
      stroke={WATCHED_GREEN}
      strokeWidth={2.5}
      aria-hidden="true"
    >
      <path strokeLinecap="round" strokeLinejoin="round" d="M5 12.5l4.5 4.5L19 7" />
    </svg>
  );
}

const HERO_EYEBROW: Record<LectureHeroMode, string> = {
  resume: 'Resume',
  'next-up': 'Next up',
  'watch-again': 'Watch again',
  'start-here': 'Start here',
};

/**
 * The one high-contrast moment in a cream product: the lecture to watch next,
 * at full size, with a play control you cannot miss. Only ever rendered
 * unlocked — see the file header.
 */
function CinemaHero({
  lecture,
  position,
  mode,
  secondsWatched,
  transition,
}: {
  lecture: LectureSummary;
  position: number;
  mode: LectureHeroMode;
  secondsWatched: number;
  transition: Transition;
}) {
  const resuming = mode === 'resume';
  const description = cleanDescription(lecture.description);
  const remaining = minutesLeft(lecture.durationSeconds, secondsWatched);
  const fraction = watchedFraction(lecture.durationSeconds, secondsWatched);

  // Resuming, the useful number is what is LEFT, not how long the whole thing
  // runs — they already know, they watched most of it.
  const stamp = resuming && remaining !== null ? `${remaining} min left` : formatDuration(lecture.durationSeconds);

  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={transition}>
      <Link
        href={`/dashboard/lectures/${lecture.id}`}
        className="group relative block overflow-hidden rounded-[16px] shadow-elevation-3 focus-visible-ring"
        style={{ background: HERO_BACKGROUND }}
      >
        <span
          aria-hidden="true"
          className="pointer-events-none absolute inset-0"
          style={{ backgroundImage: HERO_GLOW }}
        />

        <div className="relative px-6 py-8 sm:px-10 sm:py-11">
          <div className="text-[11px] font-semibold uppercase tracking-[0.1em] text-[#F59E0B]">
            {HERO_EYEBROW[mode]}
            {' · '}
            <span className="font-mono tabular-nums">Lecture {runningNumber(position)}</span>
          </div>

          <h2
            className="mt-3 text-[26px] sm:text-[38px] font-extrabold leading-[1.12] tracking-[-0.02em]"
            style={{ color: '#FFFCF8' }}
          >
            {lecture.title}
          </h2>

          {/* Resuming, where they got to is more use than what the lecture is
              about — they have already heard the first half of the answer. */}
          {resuming ? (
            <p className="mt-3 max-w-[52ch] text-[15px] leading-[1.6]" style={{ color: 'rgba(250,250,247,0.72)' }}>
              You left off {describeWatchedOffset(secondsWatched)} &mdash; pick up where you stopped.
            </p>
          ) : (
            description && (
              <p
                className="mt-3 max-w-[52ch] text-[15px] leading-[1.6]"
                style={{ color: 'rgba(250,250,247,0.72)' }}
              >
                {description}
              </p>
            )
          )}

          <div className="mt-8 flex items-end justify-between gap-4">
            <span
              className="flex h-[68px] w-[68px] sm:h-[84px] sm:w-[84px] items-center justify-center rounded-full text-primary motion-safe:transition-transform motion-safe:duration-200 motion-safe:group-hover:scale-[1.06]"
              style={{
                background: 'rgba(255,252,248,0.96)',
                boxShadow: '0 10px 30px rgba(0,0,0,0.35)',
              }}
            >
              <PlayTriangle className="ml-[3px] h-6 w-6 sm:h-8 sm:w-8" />
            </span>

            {stamp && (
              <span
                className="font-mono text-[12px] tabular-nums uppercase tracking-[0.08em]"
                style={{ color: 'rgba(250,250,247,0.55)' }}
              >
                {stamp}
              </span>
            )}
          </div>
        </div>

        {/* Pinned to the card's own bottom edge rather than floated inside it:
            it is a property of the card, like a progress bar on a video. */}
        {resuming && fraction > 0 && (
          <span
            aria-hidden="true"
            className="absolute inset-x-0 bottom-0 block h-[5px]"
            style={{ background: 'rgba(255,255,255,0.12)' }}
          >
            <motion.span
              className="block h-full"
              style={{ background: PROGRESS_AMBER }}
              initial={{ width: 0 }}
              animate={{ width: `${Math.round(fraction * 100)}%` }}
              transition={transition}
            />
          </span>
        )}
      </Link>
    </motion.div>
  );
}

/**
 * One lecture as a typographic row: number, title, real description. Hairline
 * between rows, no box.
 *
 * The right-hand column carries the state — a lock when the plan doesn't
 * include the course, a green tick once the lecture is watched, and minutes
 * remaining rather than total minutes while one is unfinished. An unfinished
 * lecture also warms the whole row, which is the only fill on the page and so
 * survives being the one thing the eye lands on.
 */
function LectureRow({
  lecture,
  position,
  locked,
  status,
  secondsWatched,
  isHero,
  transition,
}: {
  lecture: LectureSummary;
  position: number;
  locked: boolean;
  status: LectureWatchStatus;
  secondsWatched: number;
  isHero: boolean;
  transition: Transition;
}) {
  const description = cleanDescription(lecture.description);
  const watched = !locked && status === 'watched';
  const inProgress = !locked && status === 'in-progress';
  const remaining = minutesLeft(lecture.durationSeconds, secondsWatched);
  const fraction = watchedFraction(lecture.durationSeconds, secondsWatched);
  const stamp =
    inProgress && remaining !== null ? `${remaining} min left` : formatDuration(lecture.durationSeconds);

  const titleClass = locked
    ? 'text-muted'
    : inProgress
      ? 'text-primary'
      : watched
        ? // Dimmed, not struck through: it is still a link worth following, it
          // just no longer competes with the lectures still to watch.
          'text-muted group-hover:text-primary'
        : 'text-heading group-hover:text-primary';

  const inner = (
    <>
      <span
        className={`font-mono text-[13px] tabular-nums flex-shrink-0 w-[26px] pt-[2px] ${
          inProgress ? 'text-primary' : 'text-muted'
        }`}
      >
        {runningNumber(position)}
      </span>

      <div className="flex-1 min-w-0">
        <div className={`text-[15px] font-medium leading-[1.4] transition-colors ${titleClass}`}>
          {lecture.title}
        </div>
        {/* No element at all when there is no description — an empty line under
            the title reads as a rendering fault. */}
        {description && (
          <p className="mt-1 text-[13px] leading-[1.5] text-muted line-clamp-2">{description}</p>
        )}

        {inProgress && fraction > 0 && (
          <div className="mt-2 flex items-center gap-2">
            <span
              aria-hidden="true"
              className="block h-[3px] w-[180px] max-w-full rounded-full overflow-hidden"
              style={{ background: 'rgba(180,83,9,0.14)' }}
            >
              <motion.span
                className="block h-full rounded-full"
                style={{ background: PROGRESS_AMBER }}
                initial={{ width: 0 }}
                animate={{ width: `${Math.round(fraction * 100)}%` }}
                transition={transition}
              />
            </span>
            {/* Only when the hero took this same lecture — otherwise it points
                at a card that isn't there. */}
            {isHero && <span className="text-[11px] text-muted">Resuming above</span>}
          </div>
        )}
      </div>

      {/* pt matches the number column so both sit on the title's line rather
          than on the top of the row box, which the description makes taller. */}
      <div className="flex items-center gap-2 flex-shrink-0 pt-[3px] text-muted">
        {locked && <LockGlyph />}
        {watched && (
          <>
            <TickGlyph />
            <span className="text-[12px]" style={{ color: WATCHED_GREEN }}>
              Watched
            </span>
          </>
        )}
        {stamp && <span className="font-mono text-[12px] tabular-nums">{stamp}</span>}
      </div>
    </>
  );

  return (
    <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={transition}>
      {locked ? (
        <div className="flex items-start gap-4 py-4 px-2 -mx-2 min-h-[44px] opacity-60 select-none">
          {inner}
        </div>
      ) : (
        <Link
          href={`/dashboard/lectures/${lecture.id}`}
          className={`group flex items-start gap-4 py-4 px-2 -mx-2 min-h-[44px] rounded-[10px] duration-200 transition-[background-color,transform] focus-visible-ring motion-safe:hover:-translate-y-[1px] ${
            inProgress ? 'bg-[rgba(180,83,9,0.04)] hover:bg-[rgba(180,83,9,0.07)]' : 'hover:bg-black/[0.02]'
          }`}
        >
          {inner}
        </Link>
      )}
    </motion.div>
  );
}

/** Hero, then the eyebrow, then rows — small increments so the whole sequence
 *  is over before it registers as a reveal. */
const HERO_DELAY = 0;
const EYEBROW_DELAY = 0.08;
const ROWS_DELAY = 0.12;

export default function LecturesPage() {
  const [lectures, setLectures] = useState<LectureSummary[]>([]);
  const [locked, setLocked] = useState(false);
  const [state, setState] = useState<EntitlementState>('none');
  const [unavailable, setUnavailable] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  // Whether "what Complete adds" is a hand-quoted upgrade enquiry or a trip to
  // the acquisition page. Defaults to false — the safe answer for anyone
  // without a plan — and flips once we know they hold a LIVE Self-Study plan.
  const [canSwitch, setCanSwitch] = useState(false);
  // Their plan key, so the enquiry email can say what they already hold.
  const [planKey, setPlanKey] = useState<string | null>(null);
  // `undefined` means auth is still resolving. Reading progress before then
  // shows a returning user a course with nothing watched and a START HERE hero
  // for a lecture they finished a week ago — see the library index for the
  // same pattern.
  const [user, setUser] = useState<User | null | undefined>(undefined);
  const [progress, setProgress] = useState<LectureProgressMap>({});
  const [progressReady, setProgressReady] = useState(false);

  const entrance = useEntrance();

  useEffect(() => {
    const supabase = createClient();
    supabase.auth
      .getUser()
      .then(({ data }) => setUser(data.user ?? null))
      .catch(() => setUser(null));
  }, []);

  useEffect(() => {
    if (user === undefined) return;
    if (!user) {
      setProgressReady(true);
      return;
    }

    let cancelled = false;
    getLectureProgress(user.id)
      .then((map) => {
        if (!cancelled) setProgress(map);
      })
      // A progress read that fails must not hide the course; the page simply
      // degrades to the state it had before any of this existed.
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setProgressReady(true);
      });
    return () => {
      cancelled = true;
    };
  }, [user]);

  useEffect(() => {
    let cancelled = false;
    fetch('/api/subscription')
      .then((r) => (r.ok ? r.json() : null))
      .then((data: SubscriptionResponse | null) => {
        if (cancelled || !data) return;
        const selfStudy = data.plan === 'self_study' || data.plan === 'self_study_monthly';
        if (selfStudy && data.state !== 'read_only') {
          setCanSwitch(true);
          setPlanKey(data.plan ?? null);
        }
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const res = await fetch('/api/lectures', { cache: 'no-store' });
        if (!res.ok) throw new Error(String(res.status));
        const data: LecturesResponse = await res.json();
        if (cancelled) return;
        setLectures(data.lectures ?? []);
        setLocked(Boolean(data.locked));
        setState(data.state ?? 'none');
        setUnavailable(Boolean(data.unavailable));
      } catch {
        if (!cancelled) setError('Could not load the lectures.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, []);

  // The hero cannot be picked until progress is in, so the spinner covers both
  // rather than painting a START HERE card that swaps to RESUME a beat later.
  const busy = loading || !progressReady;

  const count = `${lectures.length} lecture${lectures.length !== 1 ? 's' : ''}`;
  const subtitle = busy
    ? 'Loading…'
    : lectures.length === 0
      ? 'Lectures are on the way'
      : locked && !unavailable && state !== 'read_only'
        ? `${count} — included with Complete`
        : count;

  const notice = lockNotice(state, unavailable);

  // Only for someone who can actually play it — everyone else gets the plain
  // list. Progress is empty for a locked or signed-out viewer, so the pick
  // falls through to lecture 01 on its own.
  const hero = locked ? null : pickLectureHero(lectures, progress);

  return (
    <div>
      <PageHeader title="Lectures" subtitle={subtitle} />

      {locked && !busy && !unavailable && state !== 'read_only' && (
        <UpgradeHero
          lectures={lectures}
          upgradeHref={canSwitch ? upgradeEnquiryMailto(user?.email, planKey) : null}
        />
      )}

      {locked && !busy && (unavailable || state === 'read_only') && (
        <motion.div
          className="mb-8 px-4 py-3 rounded-[10px]"
          style={{ background: 'rgba(180,83,9,0.04)', border: '1px solid rgba(180,83,9,0.08)' }}
          initial={{ opacity: 0, y: -4 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <p className="text-[13px] text-heading">
            {notice.copy}
            {notice.href && notice.cta && (
              <>
                {' '}
                <Link href={notice.href} className="text-primary font-medium hover:underline">
                  {notice.cta}
                </Link>
              </>
            )}
          </p>
        </motion.div>
      )}

      {error && (
        <div className="mb-8 border-l-2 border-danger pl-4 py-2 text-[13px] text-danger">{error}</div>
      )}

      {busy ? (
        <div className="flex items-center justify-center py-16">
          <motion.div
            className="w-8 h-8 rounded-full border-2 border-primary border-t-transparent"
            animate={{ rotate: 360 }}
            transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
          />
        </div>
      ) : lectures.length === 0 && !error ? (
        <p className="py-8 text-[13px] text-muted">
          No lectures published yet. They&apos;ll appear here as they go live.
        </p>
      ) : (
        <>
          {hero && (
            <CinemaHero
              lecture={hero.lecture}
              position={hero.position}
              mode={hero.mode}
              secondsWatched={progress[hero.lecture.id]?.secondsWatched ?? 0}
              transition={entrance(HERO_DELAY)}
            />
          )}

          {/* Every lecture, always — the hero is a suggestion, this is the
              course. Skipping the hero's own row would renumber the list
              around a choice that changes with the viewer's progress. */}
          <div className={hero ? 'mt-12' : ''}>
            <motion.div
              className="text-[11px] font-semibold uppercase tracking-[0.1em] text-muted mb-1"
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={entrance(EYEBROW_DELAY)}
            >
              The course
            </motion.div>
            <div className="divide-y divide-hairline">
              {lectures.map((lecture, index) => (
                <LectureRow
                  key={lecture.id}
                  lecture={lecture}
                  position={index + 1}
                  locked={locked}
                  status={lectureWatchStatus(
                    lecture.durationSeconds,
                    progress[lecture.id]?.secondsWatched,
                  )}
                  secondsWatched={progress[lecture.id]?.secondsWatched ?? 0}
                  isHero={hero?.lecture.id === lecture.id}
                  transition={entrance(ROWS_DELAY + Math.min(index, 12) * 0.04)}
                />
              ))}
            </div>
          </div>

          {/* A one-lecture course looks like a page that failed to load the
              rest, so say so rather than leaving the silence. */}
          {lectures.length === 1 && (
            <motion.p
              className="mt-8 text-[13px] text-muted"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={entrance(EYEBROW_DELAY)}
            >
              More lectures are on the way &mdash; they&apos;ll appear here as they go live.
            </motion.p>
          )}
        </>
      )}
    </div>
  );
}
