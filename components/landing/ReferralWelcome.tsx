'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { REFERRAL_DISPLAY_COOKIE } from '@/lib/commerce/referrals';

const DISMISS_KEY = 'ff_ref_welcome_dismissed';

function hasReferralCookie(): boolean {
  return document.cookie.split('; ').some((c) => c.startsWith(`${REFERRAL_DISPLAY_COOKIE}=`));
}

/**
 * Floating notice shown to visitors who arrived through a referral link, so
 * they know the recommendation is attached to their order. Driven purely by the
 * presence of the `ff_ref_by` flag cookie — no cookie data is rendered, and
 * attribution runs on the HttpOnly `ff_ref` re-validated server-side.
 */
export default function ReferralWelcome() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (sessionStorage.getItem(DISMISS_KEY)) return;
    setVisible(hasReferralCookie());
  }, []);

  const dismiss = () => {
    sessionStorage.setItem(DISMISS_KEY, '1');
    setVisible(false);
  };

  return (
    <AnimatePresence>
      {visible ? (
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 16 }}
          transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1], delay: 0.4 }}
          className="fixed bottom-5 left-1/2 z-50 w-[calc(100%-2rem)] max-w-md -translate-x-1/2 sm:bottom-6"
        >
          {/* Floating pill (not an inline banner): /r/CODE lands visitors at
              #pricing, so anything anchored to the page top is never seen. */}
          <div className="flex items-center justify-center gap-3 rounded-full border border-[#EBE4DB] bg-[#FFFCF8]/95 px-5 py-3 shadow-elevation-3 backdrop-blur-sm">
            <span className="inline-block h-1.5 w-1.5 shrink-0 rounded-full bg-[#B45309]" aria-hidden="true" />
            <p className="text-sm leading-snug text-[#44403C]">
              <span className="font-semibold text-[#1C1917]">You were recommended</span> Fourteen
              Fisherman — the referral is attached to your order.
            </p>
            <button
              type="button"
              onClick={dismiss}
              aria-label="Dismiss"
              className="ml-1 shrink-0 text-[#A8A29E] transition-colors hover:text-[#44403C]"
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
