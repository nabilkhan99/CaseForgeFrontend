'use client';

import Link from 'next/link';
import { useMemo, useRef, useState, type KeyboardEvent } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import Tooltip from '@/components/ui/Tooltip';
import StatusChips from '@/components/library/StatusChips';
import { isStationLocked } from '@/hooks/useCohortAllowlist';
import {
    groupStationsByDomain,
    matchesStatus,
    stationStatus,
    type DomainBoardRow,
    type LibraryStatus,
} from '@/lib/stations/librarySearch';
import type { Station } from '@/lib/supabase/queries/station-library';

type SquareStatus = ReturnType<typeof stationStatus>;

/**
 * Green for passed, amber for started, and a warm near-nothing for untouched —
 * the untouched fill is deliberately faint so a half-finished row reads as
 * progress against a background rather than as three competing colours.
 *
 * Colour is never the only channel: the same word is in every square's
 * accessible name and in its tooltip, and the filter chips spell the three out.
 */
const SQUARE: Record<SquareStatus, { fill: string; label: string }> = {
    passed: { fill: '#16A34A', label: 'passed' },
    attempted: { fill: '#D97706', label: 'attempted' },
    'not-started': { fill: 'rgba(28,25,23,0.08)', label: 'not started' },
};

/**
 * Untouched squares under the "Not started" filter, where the resting 0.08 is
 * within a hair of the 0.13 dimming applied to everything else and the filter
 * reads as though it did nothing. Only the grey moves — green and amber are
 * already unmistakable at any opacity, and re-tinting them would make the same
 * square a different colour depending on which chip is pressed.
 */
const NOT_STARTED_SELECTED_FILL = 'rgba(28,25,23,0.26)';

/** Enough to push a square behind its neighbours without erasing it. */
const DIMMED_OPACITY = 0.13;

/**
 * A case a cohort student was not assigned.
 *
 * Its own fill rather than the filter's opacity, because the two mean different
 * things and can be true at once: dimming says "not what you asked to see",
 * this says "not yours to open". A hollow square — the board's own outline
 * weight, no fill — reads as an absence next to the solid greys, and keeps the
 * five assigned cases the only marks with any weight in a row.
 */
const LOCKED_SQUARE = {
    fill: 'transparent',
    border: '1px dashed rgba(28,25,23,0.16)',
} as const;

interface StationBoardProps {
    /** The whole bank. Grouped here; no second fetch. */
    stations: Station[];
    /** The progress filter, owned by the page so `?status=` survives a reload. */
    status: LibraryStatus;
    onStatusChange: (value: LibraryStatus) => void;
    /**
     * A cohort student's assigned cases; null for everyone else and until the
     * answer lands. Squares outside it draw as locked — still links, because
     * their brief pages carry the upsell.
     */
    allowlist?: Set<string> | null;
}

/**
 * Two hundred cases as two hundred squares, one row per topic area — and, above
 * `sm`, essentially the whole page.
 *
 * A list of twenty-eight folders reading "0 attempted" cannot answer "how much
 * of this have I actually done"; two hundred marks can. Rules above and below
 * rather than a card — the library is a typographic list and a bordered panel
 * here would be its only container.
 *
 * LAYOUT — one column of twenty-eight rows.
 * The dashboard measure is 900px (app/dashboard/layout.tsx) and one row spends
 * well under it: a 340px label (the longest domain name in the bank sets that
 * width, unclipped, at 13px), twelve 18px squares with eleven 4px gaps for
 * 260px, a 44px count, and three 12px gaps between them — 668px, with room to
 * spare. The board used to split into two columns of fourteen at `lg` to earn
 * back the slack a 150px truncated label left; now that the label is a full
 * name and a link, and the roll-up it once sat above is gone from desktop, one
 * column is both wider and the entire page.
 *
 * FILTERING — the board dims, it does not re-render.
 * The chips filter in place: non-matching squares drop to near-nothing and stay
 * where they are, so "show me what I haven't started" answers the question
 * without the row lengths, the counts or the shape of the board changing under
 * the cursor. Dimmed squares are still links; a filter is a way of looking, not
 * a gate.
 *
 * MOBILE — hidden below `sm`.
 * An 18px target cannot honour this page's 44px touch minimum, and there is no
 * honest way to shrink it: twelve squares plus a label does not fit 360px.
 * Tap-to-reveal was the other option and it is worse — it makes reading a row a
 * sequence of coin-flip taps on targets a third the size of a fingertip.
 * `hidden` rather than opacity, so phone screen readers get the touch-sized
 * domain roll-up the page keeps for them and not two hundred duplicate links
 * they cannot use.
 *
 * KEYBOARD — the board is one tab stop, not two hundred.
 * Roving tabindex: one square is tabbable, arrows move between them, so Tab
 * still steps past the board in one press. Every square is a real link with an
 * accessible name, and the tooltip opens on focus as well as hover, so arrowing
 * across a row reads out the case titles.
 */
export default function StationBoard({
    stations,
    status,
    onStatusChange,
    allowlist = null,
}: StationBoardProps) {
    const rows = useMemo(() => groupStationsByDomain(stations), [stations]);
    const shouldReduceMotion = useReducedMotion();

    const [active, setActive] = useState({ row: 0, col: 0 });
    const squares = useRef(new Map<string, HTMLAnchorElement>());
    const squareKey = (row: number, col: number) => `${row}:${col}`;

    if (rows.length === 0) return null;

    // Clamped on render rather than in state: the bank reloads when auth
    // resolves, and a stale coordinate must never point at a square that has
    // stopped existing.
    const activeRow = Math.min(active.row, rows.length - 1);
    const activeCol = Math.min(active.col, rows[activeRow].stations.length - 1);

    function focusSquare(row: number, col: number) {
        setActive({ row, col });
        squares.current.get(squareKey(row, col))?.focus();
    }

    function handleKeyDown(event: KeyboardEvent<HTMLAnchorElement>, row: number, col: number) {
        const lengthOf = (index: number) => rows[index].stations.length;
        let next: [number, number] | null = null;

        switch (event.key) {
            case 'ArrowRight':
                if (col < lengthOf(row) - 1) next = [row, col + 1];
                break;
            case 'ArrowLeft':
                if (col > 0) next = [row, col - 1];
                break;
            case 'ArrowDown':
                if (row < rows.length - 1) next = [row + 1, Math.min(col, lengthOf(row + 1) - 1)];
                break;
            case 'ArrowUp':
                if (row > 0) next = [row - 1, Math.min(col, lengthOf(row - 1) - 1)];
                break;
            case 'Home':
                next = [row, 0];
                break;
            case 'End':
                next = [row, lengthOf(row) - 1];
                break;
            default:
                return;
        }

        // Swallowed even when the move is a no-op at an edge, so ArrowDown on
        // the last row scrolls nothing out from under the cursor.
        event.preventDefault();
        if (next) focusSquare(next[0], next[1]);
    }

    function renderRow(row: DomainBoardRow<Station>, rowIndex: number) {
        return (
            <motion.li
                key={row.domainId}
                className="flex items-center gap-3"
                // Per row, not per square: two hundred staggered elements is a
                // dropped frame budget for an effect nobody can follow.
                initial={shouldReduceMotion ? false : { opacity: 0, y: 4 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{
                    delay: shouldReduceMotion ? 0 : Math.min(rowIndex, 12) * 0.04,
                    duration: 0.3,
                    ease: 'easeOut',
                }}
            >
                {/* The way into a topic area now that the roll-up is mobile-only.
                    Full name, no truncation: the longest in the bank ("People
                    with Long-term Conditions Including Cancer") fits 340px at
                    13px, and a clipped label on the page's only navigation
                    would be a worse trade than the width it saves. */}
                <Link
                    href={`/dashboard/library/${row.domainId}`}
                    className="w-[340px] flex-shrink-0 whitespace-nowrap rounded text-[13px] font-medium text-heading underline decoration-transparent underline-offset-[3px] transition-colors hover:text-primary hover:decoration-primary/40 focus-visible-ring"
                >
                    {row.domainName}
                </Link>

                <div className="flex flex-wrap items-center gap-1">
                    {row.stations.map((station, colIndex) => {
                        const squareStatus = stationStatus(station);
                        const square = SQUARE[squareStatus];
                        const matches = matchesStatus(station, status);
                        const selectedNotStarted =
                            status === 'not-started' && squareStatus === 'not-started';
                        // The name carries the status because a bare title
                        // would leave a screen reader with the colour and
                        // nothing else. The tooltip stays the title alone, so
                        // focus reads "…, passed" then repeats the title rather
                        // than the whole sentence twice.
                        const locked = isStationLocked(allowlist, station.id);
                        // "locked" replaces the progress word rather than
                        // joining it: a case you cannot open has no meaningful
                        // progress to report, and "not started, locked" invites
                        // the reader to wonder which one the colour means.
                        const label = `${station.title} — ${locked ? 'locked' : square.label}`;
                        const isActive = rowIndex === activeRow && colIndex === activeCol;

                        return (
                            <Tooltip key={station.id} content={station.title}>
                                <Link
                                    href={`/clinical-master/station/${station.id}?from=${station.domain_id}`}
                                    ref={node => {
                                        const key = squareKey(rowIndex, colIndex);
                                        if (node) squares.current.set(key, node);
                                        else squares.current.delete(key);
                                    }}
                                    tabIndex={isActive ? 0 : -1}
                                    onFocus={() => setActive({ row: rowIndex, col: colIndex })}
                                    onKeyDown={event => handleKeyDown(event, rowIndex, colIndex)}
                                    aria-label={label}
                                    className="block h-[18px] w-[18px] rounded-[4px] hover:scale-125 focus-visible-ring"
                                    style={{
                                        backgroundColor: locked
                                            ? LOCKED_SQUARE.fill
                                            : selectedNotStarted
                                              ? NOT_STARTED_SELECTED_FILL
                                              : square.fill,
                                        border: locked ? LOCKED_SQUARE.border : undefined,
                                        opacity: matches ? 1 : DIMMED_OPACITY,
                                        transition:
                                            'opacity 250ms ease, background-color 250ms ease, transform 100ms ease',
                                    }}
                                />
                            </Tooltip>
                        );
                    })}
                </div>

                {/* Right-aligned so the counts form their own column across rows
                    of wildly different lengths. */}
                <span className="ml-auto flex-shrink-0 font-mono text-[10px] tabular-nums text-muted">
                    {row.passedCount}/{row.total}
                </span>
            </motion.li>
        );
    }

    return (
        <motion.section
            aria-label="Station board"
            className="mb-8 hidden border-y border-hairline py-5 sm:block"
            initial={shouldReduceMotion ? false : { opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.2 }}
        >
            <div className="flex items-center justify-between gap-4">
                <StatusChips status={status} onStatusChange={onStatusChange} />

                {/* Dropped below `lg`, where the chips have taken the width and
                    a wrapped instruction reads as a layout accident. */}
                <p className="hidden flex-shrink-0 text-[11px] text-stone-400 lg:block">
                    one row per topic area · hover a square for the case · click the name to open the
                    topic
                </p>
            </div>

            <ul className="mt-4 space-y-1">{rows.map(renderRow)}</ul>
        </motion.section>
    );
}
