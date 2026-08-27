'use client';

import Link from 'next/link';
import { useMemo, useRef, useState, type KeyboardEvent } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import Tooltip from '@/components/ui/Tooltip';
import {
    groupStationsByDomain,
    stationStatus,
    type DomainBoardRow,
} from '@/lib/stations/librarySearch';
import type { Station } from '@/lib/supabase/queries/station-library';

type SquareStatus = ReturnType<typeof stationStatus>;

/**
 * Green for passed, amber for started, and a warm near-nothing for untouched —
 * the untouched fill is deliberately faint so a half-finished row reads as
 * progress against a background rather than as three competing colours.
 *
 * Colour is never the only channel: the same word is in every square's
 * accessible name and in its tooltip, and the legend spells the three out.
 */
const SQUARE: Record<SquareStatus, { fill: string; label: string }> = {
    passed: { fill: '#16A34A', label: 'passed' },
    attempted: { fill: '#D97706', label: 'attempted' },
    'not-started': { fill: 'rgba(28,25,23,0.08)', label: 'not started' },
};

const LEGEND: SquareStatus[] = ['passed', 'attempted', 'not-started'];

interface StationBoardProps {
    /** The whole bank. Grouped here; no second fetch. */
    stations: Station[];
}

/**
 * Two hundred cases as two hundred squares, one row per topic area.
 *
 * The roll-up underneath answers "what are the topics"; this answers "how much
 * of it have I actually done", which a list of twenty-eight folders reading
 * "0 attempted" cannot. Rules above and below rather than a card — the library
 * is a typographic list and a bordered panel here would be its only container.
 *
 * LAYOUT — two columns of fourteen at `lg`, one column below.
 * The dashboard measure is 900px (app/dashboard/layout.tsx), not the 1060 the
 * mock assumed, so the arithmetic is tight and worth writing down. A column at
 * `lg` is (900 - 32)/2 = 434px. The longest row is twelve squares: 12x14 plus
 * eleven 3px gaps = 201px. Add a 150px label, a 40px count and two 12px gaps
 * and a full row is 415px — 19px of slack. Fifteen-pixel squares would leave
 * five, sixteen would overflow, so the squares are 14px.
 * One column was the alternative and was rejected on height: twenty-eight rows
 * is ~500px of board sitting on top of a twenty-eight row list, and a 900px-wide
 * row whose content stops at 400px reads as a layout bug rather than a board.
 * Below `lg` there is no room for two, so the halves stack and read as one
 * continuous list — same order, same rows.
 *
 * MOBILE — hidden below `sm`.
 * A 14px target cannot honour this page's 44px touch minimum, and there is no
 * honest way to shrink it further: twelve squares plus a label does not fit
 * 360px. Tap-to-reveal was the other option and it is worse — it makes reading
 * a row a sequence of coin-flip taps on targets a third the size of a fingertip.
 * `hidden` rather than opacity, so phone screen readers get the touch-sized
 * roll-up below and not two hundred duplicate links they cannot use.
 *
 * KEYBOARD — the board is one tab stop, not two hundred.
 * Roving tabindex: one square is tabbable, arrows move between them, so Tab
 * still steps past the board in one press. Every square is a real link with an
 * accessible name, and the tooltip opens on focus as well as hover, so arrowing
 * across a row reads out the case titles.
 */
export default function StationBoard({ stations }: StationBoardProps) {
    const rows = useMemo(() => groupStationsByDomain(stations), [stations]);
    const shouldReduceMotion = useReducedMotion();

    const [active, setActive] = useState({ row: 0, col: 0 });
    const squares = useRef(new Map<string, HTMLAnchorElement>());
    const squareKey = (row: number, col: number) => `${row}:${col}`;

    const passedCount = useMemo(
        () => rows.reduce((total, row) => total + row.passedCount, 0),
        [rows],
    );

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
                {/* Text, not a link: the roll-up below already links all
                    twenty-eight domains, and a second set here would double the
                    page's tab stops to say the same thing twice.
                    Truncated at 150px — the longest name in the bank is 49
                    characters and the first ~24 are unique across all 28, so a
                    clipped label still identifies its row. CSS truncation does
                    not reach the accessibility tree, so screen readers keep the
                    whole name. */}
                <span className="w-[150px] flex-shrink-0 truncate text-[12px] text-body">
                    {row.domainName}
                </span>

                <div className="flex flex-wrap items-center gap-[3px]">
                    {row.stations.map((station, colIndex) => {
                        const square = SQUARE[stationStatus(station)];
                        // The name carries the status because a bare title
                        // would leave a screen reader with the colour and
                        // nothing else. The tooltip stays the title alone, so
                        // focus reads "…, passed" then repeats the title rather
                        // than the whole sentence twice.
                        const label = `${station.title} — ${square.label}`;
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
                                    className="block h-[14px] w-[14px] rounded-[3px] transition-transform duration-100 hover:scale-125 focus-visible-ring"
                                    style={{ backgroundColor: square.fill }}
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

    const split = Math.ceil(rows.length / 2);
    const columns = [rows.slice(0, split), rows.slice(split)].filter(column => column.length > 0);

    return (
        <motion.section
            aria-labelledby="station-board-heading"
            className="mb-8 hidden border-y border-hairline py-5 sm:block"
            initial={shouldReduceMotion ? false : { opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.2 }}
        >
            <div className="flex items-center justify-between gap-4">
                <h2
                    id="station-board-heading"
                    className="text-[11px] font-semibold uppercase tracking-[0.12em] text-primary"
                >
                    Station board
                </h2>

                {/* Decoration for a screen reader — every square already says its
                    own status in words. */}
                <div className="flex items-center gap-3 text-[10px] text-muted" aria-hidden="true">
                    {LEGEND.map(status => (
                        <span key={status} className="flex items-center gap-1.5">
                            <span
                                className="block h-[9px] w-[9px] rounded-[2px]"
                                style={{ backgroundColor: SQUARE[status].fill }}
                            />
                            {SQUARE[status].label}
                        </span>
                    ))}
                </div>
            </div>

            {/* The board's one-line summary, and the thing a screen reader hears
                before it reaches the rows. */}
            <p className="mt-1 text-[12px] text-muted">
                {passedCount} of {stations.length} passed across {rows.length} topic areas
            </p>

            {/* Two lists side by side rather than one grid: a grid flows
                left-to-right, so at `lg` the row below a given row would sit in
                the other column and the arrow keys would be lying about where
                focus goes. Splitting the array keeps DOM order and reading order
                the same thing. */}
            <div className="mt-4 space-y-1 lg:flex lg:gap-8 lg:space-y-0">
                {columns.map((column, columnIndex) => (
                    <ul key={columnIndex} className="space-y-1 lg:min-w-0 lg:flex-1">
                        {column.map((row, indexInColumn) =>
                            renderRow(row, columnIndex * split + indexInColumn),
                        )}
                    </ul>
                ))}
            </div>
        </motion.section>
    );
}
