'use client';

import { useState } from 'react';
import Link from 'next/link';
import { ArrowRight } from 'lucide-react';
import { trackEvent } from '@/lib/analytics';

/**
 * A slim line above the portfolio tool: the other thing we make.
 *
 * The portfolio tool has active users who arrived for CCRs and have no idea the
 * SCA product exists. This is the cheapest possible introduction — one line, one
 * link, and an OPTIONAL address.
 *
 * ## Nothing here gates anything
 *
 * The tool below is untouched and works exactly as it did whether or not this
 * is read, filled in, or dismissed. That is Ishaq's call and it is the whole
 * design constraint: a hard email gate on the portfolio tool is explicitly out
 * of scope. There is no dismissal state to persist and no modal.
 *
 * ## Where the address goes
 *
 * Straight to /api/try/send-code's sign-up path, which writes the `trial_leads`
 * row and mails a 6-digit code — the same machinery /free uses. So the address
 * IS stored (in the leads table this product already has, rather than a new one
 * needing a migration), and the person arrives on /free already on the code
 * step with their address filled in, rather than being asked for it twice.
 *
 * A failure is swallowed on purpose. The worst case is that they land on /free
 * and type their address again, which is the page's normal first step.
 */
export default function FreeStationsBanner() {
    const [email, setEmail] = useState('');
    const [submitting, setSubmitting] = useState(false);

    async function handOver() {
        const clean = email.trim().toLowerCase();
        if (submitting || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(clean)) return;
        setSubmitting(true);
        void trackEvent('portfolio_free_stations_email', {});
        try {
            await fetch('/api/try/send-code', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                // No first name: this is one field, not a form. The verification
                // email greets an unnamed lead as "there".
                body: JSON.stringify({ mode: 'signup', email: clean }),
            });
            window.location.assign(`/free?email=${encodeURIComponent(clean)}&code=sent`);
        } catch {
            // Land them on /free anyway — the address is typed again there,
            // which is that page's normal first step.
            window.location.assign(`/free?email=${encodeURIComponent(clean)}`);
        }
    }

    return (
        <div className="border-b border-hairline bg-surface-warm/70">
            <div className="mx-auto flex max-w-5xl flex-col gap-3 px-5 py-3 sm:flex-row sm:items-center sm:justify-between sm:gap-6 sm:px-8">
                <p className="text-[13.5px] leading-snug text-body">
                    <span className="font-semibold text-heading">New:</span> five free SCA stations
                    with an AI patient.{' '}
                    <Link
                        href="/free"
                        onClick={() => trackEvent('portfolio_free_stations_click', {})}
                        className="inline-flex items-center gap-1 font-semibold text-primary underline-offset-4 hover:underline"
                    >
                        See what you get
                        <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
                    </Link>
                </p>

                <form
                    className="flex w-full items-center gap-2 sm:w-auto"
                    onSubmit={(event) => {
                        event.preventDefault();
                        void handOver();
                    }}
                >
                    <label htmlFor="portfolio-free-email" className="sr-only">
                        Email (optional)
                    </label>
                    <input
                        id="portfolio-free-email"
                        type="email"
                        inputMode="email"
                        autoComplete="email"
                        placeholder="Email (optional)"
                        value={email}
                        onChange={(event) => setEmail(event.target.value)}
                        className="min-w-0 flex-1 rounded-lg border border-defined bg-white px-3 py-2 text-[13.5px] text-heading outline-none transition placeholder:text-muted focus:border-primary sm:w-56 sm:flex-none"
                    />
                    <button
                        type="submit"
                        disabled={submitting}
                        className="shrink-0 rounded-lg border border-defined bg-white px-3.5 py-2 text-[13.5px] font-semibold text-heading transition-colors hover:bg-white/60 disabled:opacity-60"
                    >
                        {submitting ? 'Sending…' : 'Send my code'}
                    </button>
                </form>
            </div>
        </div>
    );
}
