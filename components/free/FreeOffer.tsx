'use client';

import { Suspense, useEffect, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { motion } from 'framer-motion';
import { ArrowRight } from 'lucide-react';
import LandingNavbar from '@/components/landing/LandingNavbar';
import LandingFooter from '@/components/landing/LandingFooter';
import { Pill, WASH } from '@/components/landing/v5/editorial';
import { createClient } from '@/lib/supabase/client';
import FreeSignUpBox from './FreeSignUpBox';

/**
 * /free — the deliberate door.
 *
 * The offer, stated plainly, and the two ways in: sign up now, or talk to a
 * patient first. Nothing else. No pricing table, no testimonials, no FAQ — the
 * page exists to be read in fifteen seconds by somebody who arrived from an
 * ad or a nav CTA and has already decided to try something.
 *
 * The word "trial" appears nowhere a person can see, and never on a button.
 * The offer is "five stations, five days, no card"; "trial" is the internal
 * name and reads as a countdown to being sold something.
 *
 * Typography-driven, per the design system: four numbered rows rather than four
 * cards, one bordered box (the sign-up, which earns its container because it is
 * the page's single action), and the offer's terms as text rather than tiles.
 */

/** The four things somebody needs to know before typing an address. */
const TERMS: readonly string[] = [
  'Five stations chosen to cover data gathering, management and relating.',
  'Five days, counted from your first consultation, not from today.',
  'When they are done, your board and reports stay. Stations lock until you pick a plan.',
  'Nothing to cancel. We never take a card for this.',
];

function FreeOfferInner() {
  const [user, setUser] = useState<{ id: string } | null>(null);
  const params = useSearchParams();

  // Carried by the portfolio tool's banner, which sends the code itself and
  // hands the person over here rather than asking for the address twice.
  const initialEmail = params.get('email') ?? undefined;
  const codeAlreadySent = params.get('code') === 'sent';

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then(({ data }) => setUser(data.user as { id: string } | null));
  }, []);

  return (
    <div className="min-h-[100dvh] font-sans" style={WASH}>
      <LandingNavbar user={user} />

      <main className="px-5 pb-16 pt-28 sm:px-8 sm:pb-24 sm:pt-32">
        <div className="mx-auto grid max-w-5xl gap-10 lg:grid-cols-[1.15fr_1fr] lg:gap-14">
          {/* Left: the offer */}
          <div>
            <motion.p
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.45 }}
            >
              <Pill>Free · no card</Pill>
            </motion.p>

            <motion.h1
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.06 }}
              className="mt-5 text-[34px] font-medium leading-[1.06] tracking-tight text-heading sm:text-5xl"
            >
              Five SCA stations, marked. This week.
            </motion.h1>

            <motion.p
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.12 }}
              className="mt-5 max-w-[34em] text-base leading-relaxed text-body sm:text-[19px] sm:leading-[1.55]"
            >
              Live 12-minute consultations with an AI patient, scored across the three RCGP
              domains, each with the one change that moves your grade. Your dashboard keeps every
              result.
            </motion.p>

            {/* Numbered rows between hairlines — the house treatment for a
                short list of facts, rather than a grid of cards. */}
            <ul className="mt-9 border-t border-hairline">
              {TERMS.map((term, index) => (
                <motion.li
                  key={term}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.45, delay: 0.18 + index * 0.06 }}
                  className="flex gap-4 border-b border-hairline py-4"
                >
                  <span className="mt-[3px] font-mono text-[11px] tabular-nums text-primary">
                    {String(index + 1).padStart(2, '0')}
                  </span>
                  <span className="text-[15px] leading-relaxed text-body sm:text-base">{term}</span>
                </motion.li>
              ))}
            </ul>
          </div>

          {/* Right: the two doors */}
          <div className="lg:sticky lg:top-28 lg:self-start">
            <FreeSignUpBox initialEmail={initialEmail} codeAlreadySent={codeAlreadySent} />

            <div className="my-6 flex items-center gap-4">
              <span className="h-px flex-1 bg-hairline" />
              <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted">or</span>
              <span className="h-px flex-1 bg-hairline" />
            </div>

            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.2 }}
            >
              {/* Door (b). Deliberately the quiet treatment: it is the better
                  route for somebody who wants proof before an address, and the
                  worse one for somebody who has already decided. */}
              <Link
                href="/try/talk"
                className="flex w-full items-center justify-center gap-2 rounded-full border border-defined bg-white px-6 py-4 text-base font-semibold text-heading transition-colors hover:bg-surface-warm"
              >
                Talk to a patient first, no sign-up
                <ArrowRight className="h-4 w-4" aria-hidden="true" />
              </Link>
              <p className="mt-3 text-[13px] leading-relaxed text-muted">
                Opens a consultation now. You see your verdict before we ask for anything.
              </p>
            </motion.div>
          </div>
        </div>
      </main>

      <LandingFooter />
    </div>
  );
}

/** useSearchParams needs a Suspense boundary for static prerendering. */
export default function FreeOffer() {
  return (
    <Suspense fallback={null}>
      <FreeOfferInner />
    </Suspense>
  );
}
