'use client';

import { motion, useReducedMotion } from 'framer-motion';
import Tooltip from '@/components/ui/Tooltip';
import { matchesStatus, stationStatus, type LibraryStatus } from '@/lib/stations/librarySearch';
import type { Station } from '@/lib/supabase/queries/station-library';

/** Same three fills as the station board — one case, one square, one colour. */
const SQUARE_FILL: Record<ReturnType<typeof stationStatus>, string> = {
    passed: '#16A34A',
    attempted: '#D97706',
    'not-started': 'rgba(28,25,23,0.08)',
};

/** See the board: the resting grey is too close to the dim to read as selected. */
const NOT_STARTED_SELECTED_FILL = 'rgba(28,25,23,0.26)';
const DIMMED_OPACITY = 0.13;

interface DomainProgressStripProps {
    stations: Station[];
    passedCount: number;
    /** Attempts across the whole domain, not cases touched. */
    attemptCount: number;
    /** Dims in step with the case list below, so one filter moves both. */
    status: LibraryStatus;
}

/**
 * This domain's own row from the station board, carried onto its topic page.
 *
 * It is the thread back to where you clicked: the row you pressed on the board
 * reappears at the top of the page it opened, so the page and the board are
 * visibly the same object at two zoom levels — and the filter chips move both
 * in step.
 *
 * THE SQUARES ARE DECORATIVE (`aria-hidden`), THE COUNT IS NOT.
 * On the board a square is the only way to reach its case, so it must be a
 * link. Here the full case list sits directly beneath with the same links and
 * far more to say — titles, patients, verdicts, attempt history — so making
 * these squares links too would give a screen reader every case twice and add
 * up to twelve tab stops that lead where the next element already leads.
 *
 * The count beside them used to be hidden on the same reasoning, because the
 * page header repeated it. The header no longer does: "0 of 4 passed · 3
 * attempts · Best-attempt average: 19%" was a run-on line saying what the
 * squares and the score badge already said, so it went and this row inherited
 * the figures. That makes this the sole carrier, so the count is exposed and
 * survives the `sm:` breakpoint even though the squares do not.
 */
export default function DomainProgressStrip({
    stations,
    passedCount,
    attemptCount,
    status,
}: DomainProgressStripProps) {
    const shouldReduceMotion = useReducedMotion();

    if (stations.length === 0) return null;

    return (
        <motion.div
            className="mb-6 flex items-center gap-1"
            initial={shouldReduceMotion ? false : { opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.25 }}
        >
            {/* Below `sm` the squares would wrap into a second row and stop
                reading as one strip, so they drop out and the count carries the
                domain on its own. */}
            <span aria-hidden="true" className="hidden items-center gap-1 sm:flex">
            {stations.map(station => {
                const squareStatus = stationStatus(station);
                const selectedNotStarted =
                    status === 'not-started' && squareStatus === 'not-started';

                return (
                    <Tooltip key={station.id} content={station.title}>
                        <span
                            className="block h-[18px] w-[18px] flex-shrink-0 rounded-[4px]"
                            style={{
                                backgroundColor: selectedNotStarted
                                    ? NOT_STARTED_SELECTED_FILL
                                    : SQUARE_FILL[squareStatus],
                                opacity: matchesStatus(station, status) ? 1 : DIMMED_OPACITY,
                                transition: 'opacity 250ms ease, background-color 250ms ease',
                            }}
                        />
                    </Tooltip>
                );
            })}
            </span>

            {/* Nothing to report before the first attempt, and "0/4 passed · 0
                attempts" is precisely the greeting this page refuses to open
                with — the header's plain case count says it better. */}
            {attemptCount > 0 && (
                <span className="font-mono text-[11px] tabular-nums text-muted sm:ml-3">
                    {passedCount}/{stations.length} passed &middot; {attemptCount} attempt
                    {attemptCount !== 1 ? 's' : ''}
                </span>
            )}
        </motion.div>
    );
}
