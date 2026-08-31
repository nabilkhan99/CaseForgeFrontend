'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { MAX_REFEREE_REWARD_PENCE, REFERRAL_DISPLAY_COOKIE } from '@/lib/commerce/referrals';

const SEEN_KEY = 'ff_ref_welcome_seen';

function hasReferralCookie(): boolean {
  return document.cookie.split('; ').some((c) => c.startsWith(`${REFERRAL_DISPLAY_COOKIE}=`));
}

/**
 * Persistent, cross-tab "already acknowledged" flag. localStorage — NOT
 * sessionStorage — so a dismissal sticks across tabs, windows and restarts;
 * the trigger cookie lives 30 days, so a per-tab flag would re-nag on every new
 * tab. Guarded because storage access can throw (private mode / disabled).
 */
function hasSeen(): boolean {
  try {
    return localStorage.getItem(SEEN_KEY) === '1';
  } catch {
    return false;
  }
}

function markSeen(): void {
  try {
    localStorage.setItem(SEEN_KEY, '1');
  } catch {
    /* storage unavailable — worst case the pill may show again; harmless */
  }
}

/**
 * One-time floating notice shown to visitors who arrived through a referral
 * link, so they know both that the recommendation is attached to their order and
 * that it carries money back to them. Nothing on the checkout page says so — the
 * referee's side is paid as cash afterwards, deliberately, so their receipt is
 * for the full course — which makes saying it here the only chance to influence
 * the decision to click Buy.
 * Shows at most once per browser: it is marked seen the moment it appears.
 * The headline number is derived from the engine, never hardcoded. Driven purely
 * by the presence of the `ff_ref_by` flag cookie — no cookie data is rendered,
 * and attribution runs on the HttpOnly `ff_ref` re-validated server-side.
 */
export default function ReferralWelcome() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (hasSeen()) return;
    if (!hasReferralCookie()) return;
    setVisible(true);
    markSeen(); // acknowledge once — never nag again on this browser
  }, []);

  const dismiss = () => {
    markSeen();
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
          className="fixed inset-x-4 bottom-5 z-50 mx-auto max-w-md sm:bottom-6"
        >
          {/* Floating pill (not an inline banner): /r/CODE lands visitors at
              #pricing, so anything anchored to the page top is never seen. */}
          <div className="flex items-center justify-center gap-3 rounded-full border border-[#EBE4DB] bg-[#FFFCF8]/95 px-5 py-3 shadow-elevation-3 backdrop-blur-sm">
            <span className="inline-block h-1.5 w-1.5 shrink-0 rounded-full bg-[#B45309]" aria-hidden="true" />
            <p className="text-sm leading-snug text-[#44403C]">
              <span className="font-semibold text-[#1C1917]">You were recommended</span> Fourteen
              Fisherman — join through this link and we send you up to £
              {MAX_REFEREE_REWARD_PENCE / 100} back.
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
