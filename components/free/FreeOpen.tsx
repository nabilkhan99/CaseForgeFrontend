'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import LandingNavbar from '@/components/landing/LandingNavbar';
import LandingFooter from '@/components/landing/LandingFooter';
import { WASH } from '@/components/landing/v5/editorial';
import { createClient } from '@/lib/supabase/client';
import FreeSignUpBox from './FreeSignUpBox';

/**
 * /free/open — the way back to an account.
 *
 * This is the form that used to be /free, moved rather than changed: the same
 * two fields, the same six-digit code, the same `send-code` / `verify-code`
 * pair, and the same landing on the dashboard. What changed is who it is for.
 *
 * /free is now a picker, because asking for an address before anybody has seen
 * a consultation is friction in front of value. The people who still need a
 * form are the ones who already have something to come back to — an address
 * they used at the reveal, a link from an email, a code in their inbox — and
 * for them a form is the shortest path rather than an obstacle. So this page
 * is one column, one box, and nothing to read.
 *
 * `verify-code`'s sign-up branch still creates the account when there is not
 * one, so an address that has never been here also works. That is deliberate:
 * a person who mistypes their way to this page should not hit a wall.
 */

interface FreeOpenProps {
  /** Pre-fills the address — carried in the query from wherever it was typed. */
  initialEmail?: string;
  /** A code has already been sent, so open on the code step rather than resend. */
  codeAlreadySent?: boolean;
}

export default function FreeOpen({ initialEmail, codeAlreadySent }: FreeOpenProps) {
  const [user, setUser] = useState<{ id: string } | null>(null);

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then(({ data }) => setUser(data.user as { id: string } | null));
  }, []);

  return (
    <div className="min-h-[100dvh] font-sans" style={WASH}>
      <LandingNavbar user={user} />

      <main className="px-5 pb-20 pt-28 sm:px-8 sm:pb-28 sm:pt-32">
        <div className="mx-auto max-w-[27rem]">
          <motion.h1
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.45 }}
            className="text-[30px] font-medium leading-[1.1] tracking-tight text-heading sm:text-[36px]"
          >
            Open your dashboard
          </motion.h1>

          <motion.p
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.45, delay: 0.06 }}
            className="mt-3 text-base leading-relaxed text-body"
          >
            Enter the email you used and we will send a 6-digit code.
          </motion.p>

          <div className="mt-7">
            <FreeSignUpBox initialEmail={initialEmail} codeAlreadySent={codeAlreadySent} />
          </div>

          <p className="mt-6 text-[13px] text-muted">
            Not started yet?{' '}
            <Link
              href="/free"
              className="font-medium text-heading underline decoration-muted/40 underline-offset-4 transition-colors hover:decoration-heading"
            >
              See the five free cases
            </Link>
          </p>
        </div>
      </main>

      <LandingFooter />
    </div>
  );
}
