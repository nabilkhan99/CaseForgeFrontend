'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import PageHeader from '@/components/ui/PageHeader';
import type { LecturesResponse, LectureSummary } from '@/app/api/lectures/route';
import type { EntitlementState } from '@/lib/commerce/entitlements';
import type { SubscriptionResponse } from '@/app/api/subscription/route';
import ManageBillingButton from '@/components/commerce/ManageBillingButton';

/**
 * The lecture course. Locked users see the same list, greyed — the running
 * order and the titles are the upgrade pitch, so this page never renders an
 * empty "you don't have this" screen; it renders what they'd get.
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
  'inline-flex items-center min-h-[44px] px-5 rounded-xl text-[14px] font-semibold text-white bg-gradient-to-br from-[#B45309] to-[#D97706] shadow-[0_4px_12px_rgba(180,83,9,0.2)] disabled:opacity-60';

function UpgradeHero({ lectures, canSwitch }: { lectures: LectureSummary[]; canSwitch: boolean }) {
  const mins = totalMinutes(lectures);
  const n = lectures.length;
  // Only quantify once there is something to quantify — "18 minutes of
  // teaching" undersells a course that is still being published.
  const substantial = n >= 6 && mins >= 120;
  const hours = substantial ? `${Math.round(mins / 60)} hours` : null;
  return (
    <motion.div
      className="mb-8 rounded-[20px] px-6 py-6 sm:px-8 sm:py-7"
      style={{
        background: 'linear-gradient(135deg, rgba(180,83,9,0.05), rgba(180,83,9,0.02))',
        border: '1px solid rgba(180,83,9,0.12)',
        boxShadow: '0 24px 64px rgba(180,83,9,0.06), 0 2px 4px rgba(0,0,0,0.04)',
      }}
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ type: 'spring', stiffness: 80, damping: 20 }}
    >
      <div className="text-[10px] font-semibold text-primary uppercase tracking-[0.1em] mb-3">
        Included with Complete
      </div>
      <h2 className="text-[22px] font-semibold text-heading tracking-[-0.01em] mb-2">
        {hours ? `${hours} of on-demand SCA teaching` : 'The on-demand SCA lecture course'}
      </h2>
      <p className="text-[14px] leading-[1.65] text-muted max-w-xl mb-5">
        {substantial ? `${n} lectures across the three SCA domains` : 'Lectures across the three SCA domains'}, taught
        against the marking framework your consultations are scored on &mdash; watch as often as you like for the
        length of your plan. Complete also adds a coaching day.
      </p>
      {/* A live Self-Study customer switches plan inside Stripe's Portal, which
          prorates the difference against the time left on their term. Everyone
          else — no plan, or a lapsed one — belongs on the acquisition page. */}
      {canSwitch ? (
        <>
          <ManageBillingButton
            flow="subscription_update"
            busyLabel="Opening Stripe…"
            className={UPGRADE_CTA_CLASS}
          >
            Upgrade to Complete &rarr;
          </ManageBillingButton>
          <p className="text-[12px] text-muted mt-3">
            You pay only for the time left on your plan.
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

function PlayGlyph({ muted }: { muted: boolean }) {
  return (
    <div
      className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
      style={
        muted
          ? { background: 'rgba(0,0,0,0.04)', color: 'rgba(0,0,0,0.28)' }
          : { background: 'rgba(180,83,9,0.08)', color: '#B45309' }
      }
    >
      {muted ? (
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M16 11V7a4 4 0 10-8 0v4M6 11h12v9H6z"
          />
        </svg>
      ) : (
        <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
          <path d="M8 5.5v13l11-6.5-11-6.5z" />
        </svg>
      )}
    </div>
  );
}

function LectureRow({
  lecture,
  index,
  locked,
}: {
  lecture: LectureSummary;
  index: number;
  locked: boolean;
}) {
  const duration = formatDuration(lecture.durationSeconds);

  const inner = (
    <>
      <PlayGlyph muted={locked} />

      <div className="flex-1 min-w-0">
        <div
          className={`text-[15px] font-medium truncate transition-colors ${
            locked ? 'text-muted' : 'text-heading group-hover:text-primary'
          }`}
        >
          <span className="font-mono text-[12px] text-muted mr-2 tabular-nums">
            {String(index + 1).padStart(2, '0')}
          </span>
          {lecture.title}
        </div>
        {(lecture.description || duration) && (
          <div className="text-[12px] text-muted mt-0.5 truncate">
            {lecture.description}
            {lecture.description && duration ? ' · ' : ''}
            {duration}
          </div>
        )}
      </div>

      {!locked && (
        <svg
          className="w-4 h-4 text-muted group-hover:text-primary transition-colors flex-shrink-0"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2}
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
        </svg>
      )}
    </>
  );

  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: Math.min(index * 0.04, 0.4) }}
    >
      {locked ? (
        <div className="flex items-center gap-4 py-4 px-2 -mx-2 opacity-60 select-none">{inner}</div>
      ) : (
        <Link
          href={`/dashboard/lectures/${lecture.id}`}
          className="flex items-center gap-4 py-4 px-2 -mx-2 rounded-lg hover:bg-black/[0.02] transition-colors group"
        >
          {inner}
        </Link>
      )}
    </motion.div>
  );
}

export default function LecturesPage() {
  const [lectures, setLectures] = useState<LectureSummary[]>([]);
  const [locked, setLocked] = useState(false);
  const [state, setState] = useState<EntitlementState>('none');
  const [unavailable, setUnavailable] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  // Whether "what Complete adds" is a Stripe plan switch or a trip to the
  // acquisition page. Defaults to false — the safe answer for anyone without a
  // plan — and flips once we know they hold a LIVE Self-Study subscription.
  const [canSwitch, setCanSwitch] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetch('/api/subscription')
      .then((r) => (r.ok ? r.json() : null))
      .then((data: SubscriptionResponse | null) => {
        if (cancelled || !data) return;
        const selfStudy = data.plan === 'self_study' || data.plan === 'self_study_monthly';
        if (selfStudy && data.state !== 'read_only') setCanSwitch(true);
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

  const count = `${lectures.length} lecture${lectures.length !== 1 ? 's' : ''}`;
  const subtitle = loading
    ? 'Loading…'
    : lectures.length === 0
      ? 'Lectures are on the way'
      : locked && !unavailable && state !== 'read_only'
        ? `${count} — included with Complete`
        : count;

  const notice = lockNotice(state, unavailable);

  return (
    <div>
      <PageHeader title="Lectures" subtitle={subtitle} />

      {locked && !loading && !unavailable && state !== 'read_only' && (
        <UpgradeHero lectures={lectures} canSwitch={canSwitch} />
      )}

      {locked && !loading && (unavailable || state === 'read_only') && (
        <motion.div
          className="mb-8 px-4 py-3 rounded-xl"
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

      {loading ? (
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
        <div className="divide-y divide-black/[0.06]">
          {lectures.map((lecture, index) => (
            <LectureRow key={lecture.id} lecture={lecture} index={index} locked={locked} />
          ))}
        </div>
      )}
    </div>
  );
}
