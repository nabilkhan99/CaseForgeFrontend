'use client';

import Link from 'next/link';
import { useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import ScoreBadge from '@/components/ui/ScoreBadge';
import VerdictPill from '@/components/ui/VerdictPill';
import { MAX_WEIGHTED_SCORE } from '@/lib/clinical-master/types';
import { difficultyLabel, difficultyStyle } from '@/lib/stations/difficulty';
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

function formatDate(dateStr?: string): string {
    if (!dateStr) return '';
    const date = new Date(dateStr);
    const now = new Date();
    const diffDays = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24));
    if (diffDays === 0) return 'Today';
    if (diffDays === 1) return 'Yesterday';
    if (diffDays < 7) return `${diffDays}d ago`;
    if (diffDays < 30) return `${Math.floor(diffDays / 7)}w ago`;
    return `${Math.floor(diffDays / 30)}mo ago`;
}

interface StationRowProps {
    station: Station;
    /** False when every station in the surrounding list shares one difficulty. */
    showDifficulty?: boolean;
    /** True in flat search results, where the domain is no longer implied. */
    showDomain?: boolean;
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
 */
export default function StationRow({ station, showDifficulty = false, showDomain = false }: StationRowProps) {
    const [expanded, setExpanded] = useState(false);
    const hasAttempts = station.attempts.length > 0;
    const latestAttempt = hasAttempts ? station.attempts[0] : null;
    const latestPercent = weightedPercent(latestAttempt?.score);

    const stationHref = `/clinical-master/station/${station.id}?from=${station.domain_id}`;
    const difficulty = showDifficulty ? difficultyLabel(station.difficulty) : null;
    const difficultyColours = difficulty ? difficultyStyle(station.difficulty) : null;

    return (
        <div className="border-b border-black/[0.06] last:border-b-0">
            <div className="flex flex-col gap-2 py-4 sm:flex-row sm:items-center sm:gap-4">
                <Link
                    href={stationHref}
                    className="group -mx-2 min-w-0 flex-1 rounded-lg px-2 py-1 transition-colors hover:bg-black/[0.02] focus-visible-ring"
                >
                    <div className="line-clamp-2 text-[15px] font-semibold leading-snug text-heading transition-colors group-hover:text-primary">
                        {station.title}
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
                    </div>
                </Link>

                <div className="flex items-center gap-3 sm:flex-shrink-0">
                    {/* Verdict from the best attempt; otherwise the legacy score, but only
                        when it normalises onto the current scale (see weightedPercent). */}
                    {station.bestVerdict ? (
                        <motion.span initial={{ opacity: 0, scale: 0.94 }} animate={{ opacity: 1, scale: 1 }}>
                            <VerdictPill verdict={station.bestVerdict} passed={station.passed} />
                        </motion.span>
                    ) : hasAttempts && latestPercent !== null ? (
                        <ScoreBadge score={latestPercent} showLabel />
                    ) : hasAttempts ? (
                        <span className="text-[12px] text-muted">Completed</span>
                    ) : (
                        // Redundant beside "Start" once the row wraps, and it used to
                        // eat ~40% of a 360px row.
                        <span className="hidden text-[12px] text-muted sm:inline">Not started</span>
                    )}

                    <Link
                        href={stationHref}
                        tabIndex={-1}
                        aria-hidden="true"
                        className="flex min-h-[44px] items-center text-[12px] font-semibold text-primary hover:underline sm:min-h-0"
                    >
                        {hasAttempts ? 'Try again' : 'Start'}
                    </Link>

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
                                animate={{ rotate: expanded ? 90 : 0 }}
                                transition={{ duration: 0.15 }}
                            >
                                <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                            </motion.svg>
                        </button>
                    )}
                </div>
            </div>

            <AnimatePresence>
                {expanded && hasAttempts && (
                    <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.2 }}
                        className="overflow-hidden"
                    >
                        <div className="space-y-1 pb-3 pl-6">
                            {station.attempts.map((attempt, i) => {
                                const percent = weightedPercent(attempt.score);
                                return (
                                    <Link
                                        key={attempt.sessionId}
                                        href={`/clinical-master/feedback/${attempt.sessionId}?from=${station.domain_id}`}
                                        className="-mx-2 flex min-h-[44px] items-center gap-3 rounded-lg px-2 py-2 transition-colors hover:bg-black/[0.02] focus-visible-ring"
                                    >
                                        <span className="w-5 font-mono text-[11px] text-muted">
                                            #{station.attempts.length - i}
                                        </span>
                                        <span className="flex-1 text-[13px] text-body">
                                            {formatDate(attempt.completedAt)}
                                        </span>
                                        {percent !== null && <ScoreBadge score={percent} size="sm" />}
                                    </Link>
                                );
                            })}
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
}
