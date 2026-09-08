'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { motion, useReducedMotion } from 'framer-motion';
import { ArrowRight } from 'lucide-react';
import LandingNavbar from '@/components/landing/LandingNavbar';
import LandingFooter from '@/components/landing/LandingFooter';
import { Pill, WASH } from '@/components/landing/v5/editorial';
import { createClient } from '@/lib/supabase/client';
import type { GuestNotice } from '@/lib/trial/freeParams';
import type { PickerStation } from '@/lib/trial/freeStationPicks';
import ExampleReport from './ExampleReport';

/**
 * /free — the case picker.
 *
 * This page used to ask for an email address, a first name and a six-digit
 * code before anybody had seen the product. That is friction in front of
 * value, and value now comes first everywhere: the consultation is the call to
 * action, and identity is asked for at the reveal, after the first station,
 * where the trainee has their own verdict on the screen in front of them.
 *
 * So there is no form here. The left column says what a station gives back and
 * then shows one; the right column is five cases, each one click from a live
 * patient. The form still exists — at /free/open, for somebody coming back to
 * an account they already have.
 *
 * Nothing on this page mentions days, locks, plans, cards or codes beyond the
 * pill, which is the single place "no card" is allowed to appear.
 */

/** The five rows are the page. Everything else is one sentence of support. */
interface FreePickerProps {
  stations: readonly PickerStation[];
  /** Why /try/talk turned this visitor away, when it did. */
  notice: GuestNotice | null;
}

const NOTICES: Record<GuestNotice, { heading: string; body: string }> = {
  limit: {
    heading: "That's three consultations today.",
    body: 'Three a day is the limit while you are a guest. Come back tomorrow, or open your dashboard to carry on now.',
  },
  unavailable: {
    heading: 'That case is briefly unavailable.',
    body: 'Nothing is wrong at your end. Pick another below, or try again in a few minutes.',
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
      className="mx-auto mb-10 max-w-5xl rounded-2xl border border-primary/20 bg-white/75 px-5 py-4 backdrop-blur sm:px-6"
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
}: {
  station: PickerStation;
  index: number;
  reduceMotion: boolean;
}) {
  const first = index === 0;

  return (
    <motion.li
      initial={reduceMotion ? false : { opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.42, delay: 0.16 + index * 0.05 }}
      className="border-b border-hairline py-4"
    >
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          {first && (
            <p className="mb-1.5 font-mono text-[10px] uppercase tracking-[0.16em] text-primary">
              Most people start here
            </p>
          )}
          <p
            className={`text-[15px] leading-snug text-heading sm:text-base ${
              first ? 'font-semibold' : 'font-medium'
            }`}
          >
            {station.title}
          </p>
          <p className="mt-1 text-[13px] text-muted">{station.meta}</p>
        </div>

        <a
          href={station.href}
          className={`inline-flex min-h-[44px] shrink-0 items-center gap-1.5 rounded-full px-5 py-2.5 text-sm font-semibold transition-colors ${
            first
              ? 'bg-primary text-white hover:opacity-90'
              : 'border border-defined bg-white text-heading hover:bg-surface-warm'
          }`}
        >
          Start
          <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
        </a>
      </div>
    </motion.li>
  );
}

/**
 * When the bank has nothing flagged.
 *
 * Never a dead page: the one-click door has its own fallback chain (see
 * lib/trial/guestStation) and will find a case even when no station carries
 * the flag, so an empty list still gets somebody into a consultation.
 */
function NoStations() {
  return (
    <div className="mt-6 border-t border-hairline pt-6">
      <p className="text-[15px] leading-relaxed text-body">
        The list is being refreshed. You can still start a consultation now.
      </p>
      <a
        href="/try/talk"
        className="mt-4 inline-flex min-h-[44px] items-center gap-2 rounded-full bg-primary px-6 py-3 text-sm font-semibold text-white transition-colors hover:opacity-90"
      >
        Start a consultation
        <ArrowRight className="h-4 w-4" aria-hidden="true" />
      </a>
    </div>
  );
}

export default function FreePicker({ stations, notice }: FreePickerProps) {
  const [user, setUser] = useState<{ id: string } | null>(null);
  const reduceMotion = Boolean(useReducedMotion());

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then(({ data }) => setUser(data.user as { id: string } | null));
  }, []);

  return (
    <div className="min-h-[100dvh] font-sans" style={WASH}>
      <LandingNavbar user={user} />

      <main className="px-5 pb-16 pt-28 sm:px-8 sm:pb-24 sm:pt-32">
        {notice && <Notice notice={notice} />}

        <div className="mx-auto grid max-w-5xl gap-10 lg:grid-cols-[1.1fr_1fr] lg:gap-14">
          {/* Left: what a station gives back, and one to look at. */}
          <div>
            <motion.p
              initial={reduceMotion ? false : { opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.45 }}
            >
              <Pill>Five free stations · no card</Pill>
            </motion.p>

            <motion.h1
              initial={reduceMotion ? false : { opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.06 }}
              className="mt-5 text-[32px] font-medium leading-[1.08] tracking-tight text-heading sm:text-[44px]"
            >
              Talk to a patient. Get marked. See the one thing to change.
            </motion.h1>

            <motion.p
              initial={reduceMotion ? false : { opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.12 }}
              className="mt-5 max-w-[34em] text-base leading-relaxed text-body sm:text-[19px] sm:leading-[1.55]"
            >
              A live 12-minute consultation with an AI patient, then a report against the three
              SCA domains. Your first verdict is shown before we ask for anything. Save it to
              keep all five on your board.
            </motion.p>

            <ExampleReport />
          </div>

          {/* Right: the five, in Ishaq's order. */}
          <div className="lg:sticky lg:top-28 lg:self-start">
            <motion.h2
              initial={reduceMotion ? false : { opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.45, delay: 0.1 }}
              className="text-[22px] font-medium tracking-tight text-heading sm:text-2xl"
            >
              Pick where to start
            </motion.h2>

            {stations.length === 0 ? (
              <NoStations />
            ) : (
              <>
                <ul className="mt-5 border-t border-hairline">
                  {stations.map((station, index) => (
                    <StationRow
                      key={station.id}
                      station={station}
                      index={index}
                      reduceMotion={reduceMotion}
                    />
                  ))}
                </ul>

                <p className="mt-4 text-[13px] leading-relaxed text-muted">
                  Your microphone is asked for when you press Start. End whenever you like; a
                  full run gets a marked report.
                </p>
              </>
            )}
          </div>
        </div>

        {/* The way back in, kept quiet: it is for the handful of people who
            already have an account, not for the visitor this page is for. */}
        <p className="mx-auto mt-14 max-w-5xl text-[13px] text-muted">
          Already have a link or a code?{' '}
          <Link
            href="/free/open"
            className="font-medium text-heading underline decoration-muted/40 underline-offset-4 transition-colors hover:decoration-heading"
          >
            Open your dashboard
          </Link>
        </p>
      </main>

      <LandingFooter />
    </div>
  );
}
