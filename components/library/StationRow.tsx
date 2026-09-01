'use client';

import Link from 'next/link';
import { useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import LockGlyph from '@/components/ui/LockGlyph';
import ScoreBadge from '@/components/ui/ScoreBadge';
import VerdictPill from '@/components/ui/VerdictPill';
import { MAX_WEIGHTED_SCORE } from '@/lib/clinical-master/types';
import { formatAttemptDate } from '@/lib/stations/attemptDate';
import { difficultyLabel, difficultyStyle } from '@/lib/stations/difficulty';
import type { AttemptMark } from '@/lib/supabase/queries/passTracking';
import type { Station } from '@/lib/supabase/queries/station-library';

/**
 * `clinical_sessions.overall_score` carries two historical scales (old ~0-100,
 * new 0-10.5 weighted), so it can never be rendered as a percentage directly —
 * a raw 8.4 through ScoreBadge reads "8% REFER" beside "5 of 5 passed".
 *
 * Normalise against the weighted maximum, and return null for anything that
 * overshoots it: that row is old-scale and there is no way to recover what it
 * meant, so we show no badge rather than a fabricated one.
 */
export function weightedPercent(score: number | null | undefined): number | null {
    if (score == null || !Number.isFinite(score) || score <= 0) return null;
    if (score > MAX_WEIGHTED_SCORE) return null;
    return Math.round((score / MAX_WEIGHTED_SCORE) * 100);
}

/** That attempt's own score as a percentage of what it was marked out of. */
function markPercent(mark: AttemptMark): number | null {
    if (mark.weightedScore === null) return null;
    return Math.round((mark.weightedScore / (mark.maxScore ?? MAX_WEIGHTED_SCORE)) * 100);
}

interface StationRowProps {
    station: Station;
    /** False when every station in the surrounding list shares one difficulty. */
    showDifficulty?: boolean;
    /** True in flat search results, where the domain is no longer implied. */
    showDomain?: boolean;
    /**
     * Outside a cohort student's five assigned cases. Marks the row rather than
     * disabling it — the brief page behind it is where the upsell lives.
     */
    locked?: boolean;
}

/**
 * One case in the library.
 *
 * The row is a real `<Link>` to the case brief — it used to be a div with an
 * onClick, so cmd-click opened nothing, keyboard users could not reach it and
 * a long-press on a phone got no link menu. The past-attempts drawer is a
 * sibling `<button>` rather than nested inside the anchor, which keeps both
 * reachable and the markup valid.
 *
 * On a phone the title wraps to two lines and everything else moves beneath
 * it: the old single-row layout kept its desktop three-column shape at 360 px,
 * so titles truncated to about three words and three consecutive cases all
 * read "Woman with…".
 *
 * LOCKED ROWS STAY LINKS. A cohort student's library shows the whole bank with
 * everything outside their five cases marked — the row still opens its brief,
 * which is where the "unlock all 200" line sits. Greying it into a dead div
 * would hide the product from the person we are trying to sell it to, which is
 * the same reasoning the navbar's locked tabs are built on.
 *
 * HISTORY IS OPEN BY DEFAULT.
 * The library is taking over from the History tab, so a case's attempts are
 * part of what the page is for rather than a detail behind a disclosure — a
 * trainee who has to click every row to find out how they did is doing the
 * History tab's job by hand. The chevron still collapses a row, and cases with
 * no attempts have nothing to open and render no control at all.
 */
export default function StationRow({ station, showDifficulty = false, showDomain = false, locked = false }: StationRowProps) {
    const [expanded, setExpanded] = useState(true);
    const hasAttempts = station.attempts.length > 0;
    const latestAttempt = hasAttempts ? station.attempts[0] : null;
    const latestPercent = weightedPercent(latestAttempt?.score);

    const stationHref = `/clinical-master/station/${station.id}?from=${station.domain_id}`;
    const difficulty = showDifficulty ? difficultyLabel(station.difficulty) : null;
    const difficultyColours = difficulty ? difficultyStyle(station.difficulty) : null;

    return (
        <div className="border-b border-black/[0.06] last:border-b-0">
            <div className="flex items-start gap-2 py-4 sm:items-center sm:gap-4">
                <Link
                    href={stationHref}
                    className="group -mx-2 min-w-0 flex-1 rounded-lg px-2 py-1 transition-colors hover:bg-black/[0.02] focus-visible-ring"
                >
                    <div className="line-clamp-2 text-[15px] font-semibold leading-snug text-heading transition-colors group-hover:text-primary">
                        {station.title}
                        {locked && <LockGlyph label="Not in your assigned cases" />}
                    </div>
                    <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-[12px] text-muted">
                        <span>{station.patient_name}</span>
                        {showDomain && (
                            <>
                                <span aria-hidden="true" className="text-black/20">&middot;</span>
                                <span>{station.domain_name}</span>
                            </>
                        )}
                        {difficulty && difficultyColours && (
                            <span
                                className="rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide"
                                style={difficultyColours}
                            >
                                {difficulty}
                            </span>
                        )}
                        {hasAttempts && (
                            <span>
                                {station.attempts.length} attempt{station.attempts.length !== 1 ? 's' : ''}
                            </span>
                        )}
                        {station.bestScore !== null && (
                            <span className="font-mono">
                                best {station.bestScore.toFixed(1)}/{station.bestMaxScore ?? MAX_WEIGHTED_SCORE}
                            </span>
                        )}
                        {/* On a phone the verdict belongs under the title with the rest
                            of the metadata; the right-hand status column is a desktop
                            affordance and would push the title into a third line. */}
                        {station.bestVerdict && (
                            <span className="sm:hidden">
                                <VerdictPill verdict={station.bestVerdict} passed={station.passed} size="sm" />
                            </span>
                        )}
                    </div>
                </Link>

                <div className="flex flex-shrink-0 items-center gap-3">
                    {/* Verdict from the best attempt; otherwise the legacy score, but only
                        when it normalises onto the current scale (see weightedPercent). */}
                    {station.bestVerdict ? (
                        <motion.span
                            className="hidden sm:inline"
                            initial={{ opacity: 0, scale: 0.94 }}
                            animate={{ opacity: 1, scale: 1 }}
                        >
                            <VerdictPill verdict={station.bestVerdict} passed={station.passed} />
                        </motion.span>
                    ) : hasAttempts && latestPercent !== null ? (
                        <span className="hidden sm:inline">
                            <ScoreBadge score={latestPercent} showLabel />
                        </span>
                    ) : hasAttempts ? (
                        <span className="hidden text-[12px] text-muted sm:inline">Completed</span>
                    ) : (
                        // Redundant beside "Start", and it used to eat ~40% of a 360px row.
                        <span className="hidden text-[12px] text-muted sm:inline">Not started</span>
                    )}

                    {/* Muted and reading "Locked" rather than a primary-coloured
                        "Start" that goes to a page with no Start on it. Still the
                        same link: what is behind it is the upsell, not a refusal. */}
                    <Link
                        href={stationHref}
                        tabIndex={-1}
                        aria-hidden="true"
                        className={`hidden text-[12px] font-semibold hover:underline sm:inline ${
                            locked ? 'text-muted' : 'text-primary'
                        }`}
                    >
                        {locked ? 'Locked' : hasAttempts ? 'Try again' : 'Start'}
                    </Link>

                    {/* Phones get a chevron instead of the "Start" label: the whole row
                        is the link, and the label costs a line of height per case. */}
                    {!hasAttempts && (
                        <svg
                            className="mt-1 h-4 w-4 text-muted sm:hidden"
                            fill="none"
                            viewBox="0 0 24 24"
                            stroke="currentColor"
                            strokeWidth={2}
                            aria-hidden="true"
                        >
                            <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                        </svg>
                    )}

                    {hasAttempts && (
                        <button
                            type="button"
                            onClick={() => setExpanded(value => !value)}
                            aria-expanded={expanded}
                            aria-label={`${expanded ? 'Hide' : 'Show'} past attempts at ${station.title}`}
                            className="flex min-h-[44px] min-w-[44px] items-center justify-center rounded-lg text-muted transition-colors hover:bg-black/[0.03] hover:text-heading sm:min-h-[32px] sm:min-w-[32px] focus-visible-ring"
                        >
                            <motion.svg
                                className="h-4 w-4"
                                fill="none"
                                viewBox="0 0 24 24"
                                stroke="currentColor"
                                strokeWidth={2}
                                // Same reason as the drawer: the row arrives
                                // open, so the chevron has to arrive pointing
                                // down rather than animating there from a
                                // resting state that no longer matches.
                                initial={false}
                                animate={{ rotate: expanded ? 90 : 0 }}
                                transition={{ duration: 0.15 }}
                            >
                                <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                            </motion.svg>
                        </button>
                    )}
                </div>
            </div>

            {/* `initial={false}` because the drawer is open on arrival: an
                entrance animation on content that is already the default state
                buys nothing, and it costs the case where it cannot run — a
                background tab pauses requestAnimationFrame, which would leave
                the history collapsed at its `initial` height until the tab is
                focused. Toggling still animates. */}
            <AnimatePresence initial={false}>
                {expanded && hasAttempts && (
                    <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.2 }}
                        className="overflow-hidden"
                    >
                        {/* A hairline down the left, so a run of open rows reads
                            as history belonging to its case rather than as one
                            long undifferentiated list. */}
                        <ul className="ml-2 space-y-0.5 border-l-2 border-black/[0.05] pb-3 pl-4">
                            {station.attempts.map(attempt => {
                                const percent = markPercent(attempt.mark);
                                const when = formatAttemptDate(attempt.completedAt);

                                return (
                                    <li key={attempt.sessionId}>
                                        <Link
                                            href={`/clinical-master/feedback/${attempt.sessionId}?from=${station.domain_id}`}
                                            className="group -mx-2 flex min-h-[44px] flex-wrap items-center gap-x-3 gap-y-1 rounded-lg px-2 py-2 transition-colors hover:bg-black/[0.02] sm:min-h-[36px] sm:flex-nowrap focus-visible-ring"
                                        >
                                            <span className="w-[124px] flex-shrink-0 text-[13px] text-body transition-colors group-hover:text-primary">
                                                {when || 'Attempt'}
                                            </span>

                                            {/* The band this attempt reached, not
                                                the station's best: passed={false}
                                                keeps "Bare Pass" from being
                                                flattened to "Passed" on a line
                                                whose whole job is to say what
                                                happened that time. */}
                                            {attempt.mark.verdict ? (
                                                <>
                                                    <VerdictPill
                                                        verdict={attempt.mark.verdict}
                                                        passed={false}
                                                        size="sm"
                                                    />
                                                    {percent !== null && (
                                                        <span className="font-mono text-[11px] tabular-nums text-muted">
                                                            {percent}%
                                                        </span>
                                                    )}
                                                </>
                                            ) : (
                                                // Sat, never marked — the engine
                                                // failed or predates it. Saying so
                                                // beats an invented score.
                                                <span className="text-[12px] text-muted">
                                                    Not marked
                                                </span>
                                            )}

                                            <span className="ml-auto hidden flex-shrink-0 text-[12px] font-semibold text-primary group-hover:underline sm:inline">
                                                View feedback →
                                            </span>
                                        </Link>
                                    </li>
                                );
                            })}
                        </ul>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
}
