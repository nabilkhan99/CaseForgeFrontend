'use client';

import Link from 'next/link';
import { ArrowRight } from 'lucide-react';
import { trackEvent } from '@/lib/analytics';

/**
 * A slim line above the portfolio tool: the other thing we make.
 *
 * The portfolio tool has active users who arrived for CCRs and have no idea the
 * SCA product exists. This is the cheapest possible introduction: one line and
 * one link to the five free cases.
 *
 * ## Nothing here gates anything
 *
 * The tool below is untouched and works exactly as it did whether or not this
 * is read or clicked. That is Ishaq's call and it is the whole design
 * constraint: a hard email gate on the portfolio tool is explicitly out of
 * scope. There is no dismissal state to persist, no modal, and no form.
 *
 * It used to take an address and hand it to the account-first form in the
 * query. That form is retired (one door: /free), and an address in a URL ends
 * up in history, logs and analytics, so the banner is a plain link now.
 */
export default function FreeStationsBanner() {
    return (
        <div className="border-b border-hairline bg-surface-warm/70">
            <div className="mx-auto flex max-w-5xl flex-col gap-2 px-5 py-3 sm:flex-row sm:items-center sm:justify-between sm:gap-6 sm:px-8">
                <p className="text-[13.5px] leading-snug text-body">
                    <span className="font-semibold text-heading">New:</span> five free SCA cases
                    with an AI patient.
                </p>
                <Link
                    href="/free"
                    onClick={() => void trackEvent('portfolio_free_stations_click', {})}
                    className="inline-flex items-center gap-1 text-[13.5px] font-semibold text-primary underline-offset-4 hover:underline"
                >
                    Try 5 free cases
                    <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
                </Link>
            </div>
        </div>
    );
}
