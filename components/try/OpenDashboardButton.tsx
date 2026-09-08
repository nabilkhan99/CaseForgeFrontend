'use client';

import Link from 'next/link';
import { ArrowRight } from 'lucide-react';
import { trackEvent } from '@/lib/analytics';

/**
 * "Open your dashboard", under the report of a consultation sat as a guest.
 *
 * These reports are legacy — the guest lane closed on 7 September 2026 — but
 * their links are in about eighty people's inboxes and every one of those
 * people has an account waiting, made when they verified their address at the
 * gate. This is the way into it.
 *
 * ## Why /free/open rather than /dashboard
 *
 * Because this page is reachable by anyone holding the session id — that is
 * what made the guest funnel work — so it cannot assume the reader is signed
 * in, and it must not hand a session to whoever has the link. /free/open asks
 * for a 6-digit code at the address that verified this report, which is the
 * same proof the gate took, and lands them signed in on the dashboard.
 *
 * A plain link, with the address prefilled when the page knows it. It used to
 * be a button that asked the server to MAIL a one-time link — a second inbox
 * trip, and a "check your inbox" that people read as the report being emailed.
 */
export default function OpenDashboardButton({ email }: { email?: string | null }) {
  const clean = email?.trim().toLowerCase() ?? '';
  const href = clean ? `/free/open?email=${encodeURIComponent(clean)}` : '/free/open';

  return (
    <div className="flex flex-col items-center gap-2">
      <Link
        href={href}
        onClick={() => trackEvent('trial_dashboard_link_requested', { door: 'guest_report' })}
        className="cta-button px-7 py-3.5 text-[15px]"
      >
        Open your dashboard
        <ArrowRight className="h-4 w-4" aria-hidden="true" />
      </Link>
      <p className="text-[12.5px] text-muted">
        Your board, this consultation and four more stations.
      </p>
    </div>
  );
}
