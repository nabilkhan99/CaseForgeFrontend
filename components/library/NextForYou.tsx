'use client';

import Link from 'next/link';
import { motion } from 'framer-motion';
import type { Station } from '@/lib/supabase/queries/station-library';

interface NextForYouProps {
    station: Station;
    /** Keeps the dashboard's "pick a random case" habit alive inside the library. */
    onSurpriseMe: () => void;
}

/**
 * One case to open on, above the list.
 *
 * Day one of a three-month course used to begin with 29 alphabetical folders
 * and no opinion about any of them, which is a decision to make before you
 * have any basis for making it. This is that decision made for you: a case you
 * have not attempted, fixed for the day so it doesn't reshuffle while you think
 * about it, and skippable in one click.
 *
 * Rules rather than a card — the library is a typographic list, and a boxed
 * hero here would be the only container on the page.
 */
export default function NextForYou({ station, onSurpriseMe }: NextForYouProps) {
    const href = `/clinical-master/station/${station.id}?from=${station.domain_id}`;

    return (
        <motion.section
            aria-labelledby="next-for-you-heading"
            className="mb-8 border-y border-black/[0.06] py-5"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ type: 'spring', stiffness: 80, damping: 20 }}
        >
            <h2
                id="next-for-you-heading"
                className="text-[11px] font-semibold uppercase tracking-[0.12em] text-primary"
            >
                Next for you
            </h2>

            <Link href={href} className="group -mx-2 mt-2 block rounded-lg px-2 py-1 focus-visible-ring">
                <p className="line-clamp-2 text-[17px] font-bold leading-snug tracking-[-0.01em] text-heading transition-colors group-hover:text-primary sm:text-[19px]">
                    {station.title}
                </p>
                <p className="mt-1 text-[13px] text-muted">
                    {station.domain_name} &middot; {station.patient_name}
                </p>
                {station.presenting_complaint && (
                    <p className="mt-2 line-clamp-2 text-[13px] leading-relaxed text-body">
                        &ldquo;{station.presenting_complaint}&rdquo;
                    </p>
                )}
            </Link>

            <div className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-2">
                <Link
                    href={href}
                    className="flex min-h-[44px] items-center text-[13px] font-semibold text-primary hover:underline sm:min-h-0"
                >
                    Start this case &rarr;
                </Link>
                <button
                    type="button"
                    onClick={onSurpriseMe}
                    className="flex min-h-[44px] items-center text-[13px] text-muted transition-colors hover:text-heading sm:min-h-0 focus-visible-ring"
                >
                    or pick a random case
                </button>
            </div>
        </motion.section>
    );
}
