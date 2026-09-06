'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import { ArrowRight } from 'lucide-react';
import { trackEvent } from '@/lib/analytics';

/**
 * "Open your dashboard", on the report of a consultation someone sat as a guest.
 *
 * The consultation they just read is theirs, and by this point in the page they
 * have verified their address — so there is an account, it has their session
 * attached and it has five stations on it. The only thing missing is a way into
 * it from a browser that may not be the one that will read the email.
 *
 * Pressing it asks the server to mail a one-time sign-in link
 * (/api/try/dashboard-link). Deliberately an EMAIL rather than an inline
 * redirect: this page is reachable by anyone holding the session id — that is
 * what makes the guest funnel work at all — so handing the browser a session
 * off a click here would let whoever has the link become the account. Sending
 * it to the verified address instead means the person who proved the address is
 * the person who gets in.
 *
 * The route answers identically whatever happened (no lead, unverified,
 * throttled, sent), so there is nothing to branch on and one confirmation
 * covers every case.
 */
export default function OpenDashboardButton({ sessionId }: { sessionId: string }) {
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);

  async function requestLink() {
    if (sending || sent) return;
    setSending(true);
    try {
      void trackEvent('trial_dashboard_link_requested', { session: sessionId });
      await fetch('/api/try/dashboard-link', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId }),
      });
    } catch {
      // Same outcome either way; the copy below already says "if that address…".
    } finally {
      setSending(false);
      setSent(true);
    }
  }

  if (sent) {
    return (
      <motion.p
        initial={{ opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
        className="text-[14px] leading-relaxed text-muted"
      >
        Check your inbox — a one-time sign-in link is on its way. It opens your dashboard, with this
        consultation already on it.
      </motion.p>
    );
  }

  return (
    <div className="flex flex-col items-center gap-2">
      <button
        type="button"
        onClick={() => void requestLink()}
        disabled={sending}
        className="cta-button px-7 py-3.5 text-[15px]"
      >
        {sending ? 'Sending…' : 'Open your dashboard'}
        {!sending && <ArrowRight className="h-4 w-4" aria-hidden="true" />}
      </button>
      <p className="text-[12.5px] text-muted">
        We&apos;ll email you a one-time link. Four more stations are waiting on it.
      </p>
    </div>
  );
}
