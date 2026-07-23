'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { REFERRAL_DISPLAY_COOKIE } from '@/lib/commerce/referrals';

const DISMISS_KEY = 'ff_ref_welcome_dismissed';

function readDisplayCookie(): string | null {
  const match = document.cookie
    .split('; ')
    .find((c) => c.startsWith(`${REFERRAL_DISPLAY_COOKIE}=`));
  if (!match) return null;
  const value = decodeURIComponent(match.slice(REFERRAL_DISPLAY_COOKIE.length + 1)).trim();
  return value || null;
}

/**
 * Slim ribbon shown to visitors who arrived through a referral link, so they
 * know the recommendation is attached to their order. Display-only: the value
 * comes from the non-HttpOnly `ff_ref_by` cookie and is never used for
 * attribution (checkout re-validates the HttpOnly `ff_ref` server-side).
 */
export default function ReferralWelcome() {
  const [name, setName] = useState<string | null>(null);

  useEffect(() => {
    if (sessionStorage.getItem(DISMISS_KEY)) return;
    setName(readDisplayCookie());
  }, []);

  const dismiss = () => {
    sessionStorage.setItem(DISMISS_KEY, '1');
    setName(null);
  };

  return (
    <AnimatePresence>
      {name ? (
        <motion.div
          initial={{ opacity: 0, y: -12 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -12 }}
          transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
          className="border-b border-[#EBE4DB] bg-[#FFFCF8]"
        >
          <div className="mx-auto flex max-w-5xl items-center justify-center gap-3 px-6 py-2.5">
            <span className="inline-block h-1.5 w-1.5 rounded-full bg-[#B45309]" aria-hidden="true" />
            <p className="text-sm text-[#44403C]">
              <span className="font-semibold text-[#1C1917]">{name}</span> recommended Fourteen
              Fisherman — their referral is attached to your order.
            </p>
            <button
              type="button"
              onClick={dismiss}
              aria-label="Dismiss"
              className="ml-1 text-[#A8A29E] transition-colors hover:text-[#44403C]"
            >
              <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" aria-hidden="true">
                <path d="M18 6L6 18M6 6l12 12" />
              </svg>
            </button>
          </div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}
