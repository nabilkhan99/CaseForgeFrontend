'use client';

import Link from 'next/link';
import { motion } from 'framer-motion';

interface AdminDestination {
  href: string;
  title: string;
  blurb: string;
}

/** The admin surfaces, in the order you'd reach for them on a launch day. */
const DESTINATIONS: readonly AdminDestination[] = [
  {
    href: '/admin/orders',
    title: 'Orders',
    blurb: 'Every purchase — revenue, refunds, plan split, coaching-day capacity.',
  },
  {
    href: '/admin/referrals',
    title: 'Referrals',
    blurb: 'Advocates and their links, conversions, what you owe, and marking payouts.',
  },
  {
    href: '/admin/progress',
    title: 'Progress',
    blurb: 'Who is passing stations — best attempt counts, per user, with the titles.',
  },
  {
    href: '/admin/recordings',
    title: 'Recordings',
    blurb: 'Listen back to real consultations — who sat what, and how it actually sounded.',
  },
  {
    href: '/admin/lectures',
    title: 'Lectures',
    blurb: 'The Complete-tier course — add a lecture, upload its video, publish it.',
  },
] as const;

/**
 * Front door for the admin area: a plain index of the gated surfaces so neither
 * founder has to remember URLs. Rendered only after the server-side ADMIN_EMAILS
 * gate in page.tsx has passed.
 */
export default function AdminHome({ email }: { email: string }) {
  return (
    <div className="min-h-[100dvh] bg-surface text-body font-sans">
      <div className="max-w-[1100px] mx-auto px-6 sm:px-10 py-12 sm:py-16">
        <header className="flex items-end justify-between gap-6 flex-wrap">
          <div>
            <h1 className="text-4xl sm:text-5xl font-bold tracking-tight text-heading">Admin</h1>
            <p className="mt-2 text-sm text-muted">Fourteen Fisherman — internal</p>
          </div>
          <p className="text-xs text-muted">
            Signed in as <span className="font-mono">{email}</span>
          </p>
        </header>

        <div className="mt-12 border-t border-border">
          {DESTINATIONS.map((d, i) => (
            <motion.div
              key={d.href}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, delay: i * 0.08, ease: 'easeOut' }}
            >
              <Link
                href={d.href}
                className="group flex items-baseline justify-between gap-6 border-b border-border py-8 transition-colors hover:bg-surface-raised/60"
              >
                <div className="min-w-0">
                  <h2 className="text-2xl sm:text-3xl font-semibold tracking-tight text-heading">
                    {d.title}
                  </h2>
                  <p className="mt-1.5 text-sm text-muted">{d.blurb}</p>
                </div>
                <span
                  aria-hidden="true"
                  className="shrink-0 text-primary transition-transform group-hover:translate-x-1"
                >
                  →
                </span>
              </Link>
            </motion.div>
          ))}
        </div>

        <p className="mt-10 text-xs text-muted">
          Pages are restricted to the <span className="font-mono">ADMIN_EMAILS</span> allowlist.
        </p>
      </div>
    </div>
  );
}
