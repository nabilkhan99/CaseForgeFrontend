'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { motion, useReducedMotion } from 'framer-motion';
import { ArrowRight, Check } from 'lucide-react';
import LandingNavbar from '@/components/landing/LandingNavbar';
import LandingFooter from '@/components/landing/LandingFooter';
import { Accent, Pill, WASH } from '@/components/landing/v5/editorial';
import { createClient } from '@/lib/supabase/client';
import type { GuestNotice } from '@/lib/trial/freeParams';
import { accountFirstHref, type PickerStation } from '@/lib/trial/freeStationPicks';
import ExampleReport from './ExampleReport';

/**
 * /free — the case picker.
 *
 * The offer page, not a form. Two short lines say what a case is, the five
 * cases are the one object on the page, and a small example report sits beside
 * them as proof. Everything else was cut: the length is stated once in the
 * list header rather than on every row, and each case is a single clickable
 * row rather than a title with its own button.
 *
 * VALUE BEFORE IDENTITY. Start goes to /try/talk and opens the consultation
 * there and then — no address, no password, no code in front of it. Identity
 * is asked for afterwards, on the feedback page, while the consultation is
 * being marked and the trainee has their own verdict coming. /free/open is
 * still the way back for somebody who already has an account and would rather
 * use a code than a password.
 *
 * Nothing on this page mentions days, locks, plans, cards or codes beyond the
 * pill, which is the single place "no card" is allowed to appear.
 */

/** What a free account holds, in the order a trainee meets it. */
const INCLUDED: readonly string[] = [
  'Unlimited attempts on all five cases',
  'Your own dashboard and analytics',
  'A detailed, holistic analysis of how you are progressing',
];

/** The five rows are the page. Everything else is supporting detail. */
interface FreePickerProps {
  stations: readonly PickerStation[];
  /** Why /try/talk turned this visitor away, when it did. */
  notice: GuestNotice | null;
}

/**
 * The two bounces, and what each one leaves a visitor able to do.
 *
 * Both used to end in a dead end. `limit` offered "open your dashboard", which
 * is the one thing a guest who has never made an account does not have; and
 * `unavailable` said "pick another below" when the five buttons below it would
 * bounce straight back here. So the limit notice offers the account — the way
 * to carry on now, and the only one — and the unavailable notice says the
 * honest thing, which is to wait.
 */
const NOTICES: Record<GuestNotice, { heading: string; body: React.ReactNode }> = {
  limit: {
    heading: "That's three consultations today.",
    body: (
      <>
        Come back tomorrow, or{' '}
        <Link
          href="/free/start"
          className="font-medium text-heading underline decoration-muted/40 underline-offset-4 transition-colors hover:decoration-heading"
        >
          create your free account
        </Link>{' '}
        to carry on now.
      </>
    ),
  },
  unavailable: {
    heading: 'That case is briefly unavailable.',
    body: 'Nothing is wrong at your end. Try again in a few minutes.',
  },
};

function Notice({ notice }: { notice: GuestNotice }) {
  const { heading, body } = NOTICES[notice];
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      role="status"
      className="mx-auto mb-10 max-w-6xl rounded-2xl border border-primary/20 bg-white/75 px-5 py-4 backdrop-blur sm:px-6"
    >
      <p className="text-[15px] font-semibold text-heading">{heading}</p>
      <p className="mt-1 text-[14px] leading-relaxed text-body">{body}</p>
    </motion.div>
  );
}

/**
 * One case.
 *
 * A plain `<a>`, not a `<Link>`: /try/talk opens a consultation as a side
 * effect of a GET, and Next prefetches a `<Link>` the moment it enters the
 * viewport. The route already refuses prefetches (see its `isMachineFetch`),
 * but five links in one viewport would fire five refused requests on every
 * visit to no purpose.
 */
function StationRow({
  station,
  index,
  reduceMotion,
  showMinutes,
}: {
  station: PickerStation;
  index: number;
  reduceMotion: boolean;
  /** Only when the five differ in length; otherwise the header says it once. */
  showMinutes: boolean;
}) {
  const first = index === 0;
  const details = [
    station.area,
    showMinutes ? `${station.minutes} min` : null,
    station.telephone ? 'Telephone' : null,
  ].filter(Boolean);

  return (
    <motion.li
      initial={reduceMotion ? false : { opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: 0.14 + index * 0.05 }}
      className="border-t border-hairline first:border-t-0"
    >
      <a
        href={station.href}
        aria-label={`Start: ${station.title}`}
        className="group flex min-h-[72px] items-center gap-4 px-5 py-4 transition-colors hover:bg-surface-warm/70 focus-visible:bg-surface-warm/70 focus-visible:outline-none sm:gap-5 sm:px-6"
      >
        <span className="hidden w-6 shrink-0 font-mono text-[12px] tabular-nums text-muted sm:block" aria-hidden="true">
          {String(index + 1).padStart(2, '0')}
        </span>

        <span className="min-w-0 flex-1">
          <span className="block text-[15px] font-medium leading-snug text-heading sm:text-base">
            {station.title}
          </span>
          <span className="mt-1 flex flex-wrap items-center gap-x-2 text-[13px] text-muted">
            {first && <span className="font-medium text-primary">Start here</span>}
            {first && details.length > 0 && <span aria-hidden="true">·</span>}
            {details.join(' · ')}
          </span>
        </span>

        <span
          className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full transition-all duration-200 group-hover:translate-x-0.5 ${
            first
              ? 'bg-primary text-white'
              : 'border border-defined text-heading group-hover:border-primary group-hover:bg-primary group-hover:text-white'
          }`}
          aria-hidden="true"
        >
          <ArrowRight className="h-4 w-4" />
        </span>
      </a>
    </motion.li>
  );
}

/**
 * When the bank has nothing flagged.
 *
 * Never a dead page: the account is worth making whether or not this list
 * resolved, and the dashboard they land on carries the whole library — so an
 * empty list still gets somebody to a patient, one screen later.
 */
function NoStations() {
  return (
    <div className="pt-5">
      <p className="text-[15px] leading-relaxed text-body">
        The list is being refreshed. Your account still opens the whole library.
      </p>
      <Link
        href="/free/start"
        className="mt-4 inline-flex min-h-[44px] items-center gap-2 rounded-full bg-primary px-6 py-3 text-sm font-semibold text-white transition-colors hover:opacity-90"
      >
        Start free
        <ArrowRight className="h-4 w-4" aria-hidden="true" />
      </Link>
    </div>
  );
}

export default function FreePicker({ stations, notice }: FreePickerProps) {
  const [user, setUser] = useState<{ id: string } | null>(null);
  const reduceMotion = Boolean(useReducedMotion());

  // The guest door is shut for today, so the five buttons stop pointing at it.
  // /try/talk would refuse and bounce the visitor back to this same page — five
  // buttons whose only outcome is the page they are on. Through /free/start the
  // case still gets run, on an account, which is exactly what the notice above
  // the list now offers.
  const rows =
    notice === 'limit'
      ? stations.map((station) => ({ ...station, href: accountFirstHref(station.id) }))
      : stations;

  // Said once in the list header when all five run the same length, which is
  // the normal case; a row only repeats it when they genuinely differ.
  const commonMinutes =
    rows.length > 0 && rows.every((station) => station.minutes === rows[0].minutes)
      ? rows[0].minutes
      : null;

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then(({ data }) => setUser(data.user as { id: string } | null));
  }, []);

  return (
    <div className="min-h-[100dvh] font-sans" style={WASH}>
      <LandingNavbar user={user} />

      <main className="px-5 pb-16 pt-36 sm:px-8 sm:pb-24 sm:pt-40">
        {notice && <Notice notice={notice} />}

        <div className="mx-auto grid max-w-6xl gap-8 lg:grid-cols-[0.85fr_1.15fr] lg:gap-x-16 lg:gap-y-8">
          {/* Intro. DOM order is intro, list, example so a phone reaches the
              five cases before the example; on desktop the list spans both
              rows of the right column. */}
          <div className="lg:col-start-1 lg:row-start-1">
            <motion.div
              initial={reduceMotion ? false : { opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.45 }}
            >
              <Pill>Five free cases · no card</Pill>
            </motion.div>

            <motion.h1
              initial={reduceMotion ? false : { opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.06 }}
              className="mt-6 text-[40px] font-medium leading-[1.04] tracking-tight text-heading sm:text-[56px]"
            >
              Talk to a patient.
              <br />
              <Accent>Get marked.</Accent>
            </motion.h1>

            {/* What the free account holds, as three lines rather than a
                paragraph. No days, locks or plans here: the clock is the
                dashboard's to explain, after the first case. */}
            <ul className="mt-7 space-y-3">
              {INCLUDED.map((item, index) => (
                <motion.li
                  key={item}
                  initial={reduceMotion ? false : { opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.45, delay: 0.12 + index * 0.05 }}
                  className="flex items-start gap-3 text-base leading-snug text-body [text-wrap:pretty] sm:text-[17px]"
                >
                  <span
                    className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary"
                    aria-hidden="true"
                  >
                    <Check className="h-3 w-3" strokeWidth={3} />
                  </span>
                  {item}
                </motion.li>
              ))}
            </ul>
          </div>

          {/* The five. */}
          <motion.section
            initial={reduceMotion ? false : { opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.1 }}
            aria-labelledby="free-cases-heading"
            className="lg:col-start-2 lg:row-span-2 lg:row-start-1 lg:self-start"
          >
            <div className="overflow-hidden rounded-3xl border border-hairline bg-white/80 shadow-elevation-3 backdrop-blur">
              <div className="flex items-baseline justify-between gap-4 border-b border-hairline px-5 py-4 sm:px-6">
                <h2 id="free-cases-heading" className="text-[17px] font-semibold tracking-tight text-heading">
                  Pick a case
                </h2>
                {commonMinutes !== null && (
                  <p className="font-mono text-[12px] text-muted">{commonMinutes} min each</p>
                )}
              </div>

              {rows.length === 0 ? (
                <div className="px-5 pb-6 sm:px-6">
                  <NoStations />
                </div>
              ) : (
                <ul>
                  {rows.map((station, index) => (
                    <StationRow
                      key={station.id}
                      station={station}
                      index={index}
                      reduceMotion={reduceMotion}
                      showMinutes={commonMinutes === null}
                    />
                  ))}
                </ul>
              )}
            </div>

            {notice === 'limit' && rows.length > 0 && (
              <p className="mt-3 px-1 text-[13px] leading-relaxed text-muted">
                Start opens your free account, and the case is the first one waiting on it.
              </p>
            )}

            {/* The way back in, kept quiet: it is for the handful of people
                who already have an account, not for the visitor this page is for. */}
            <p className="mt-4 px-1 text-[13px] text-muted">
              Already started?{' '}
              <Link
                href="/free/open"
                className="font-medium text-heading underline decoration-muted/40 underline-offset-4 transition-colors hover:decoration-heading"
              >
                Open your dashboard
              </Link>
            </p>
          </motion.section>

          {/* Proof, kept small. */}
          <div className="lg:col-start-1 lg:row-start-2 lg:max-w-md">
            <ExampleReport />
          </div>
        </div>
      </main>

      <LandingFooter />
    </div>
  );
}
