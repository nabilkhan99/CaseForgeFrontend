'use client';

import { LIBRARY_STATUSES, type LibraryStatus } from '@/lib/stations/librarySearch';

/**
 * The chips double as the legend, so their dots have to be visible at 10px
 * against white. Untouched sits at 0.2 here rather than the square's 0.08: a
 * swatch has no neighbours to be faint against.
 */
const CHIP_DOT: Record<Exclude<LibraryStatus, 'all'>, string> = {
    passed: '#16A34A',
    attempted: '#D97706',
    'not-started': 'rgba(28,25,23,0.2)',
};

interface StatusChipsProps {
    status: LibraryStatus;
    onStatusChange: (value: LibraryStatus) => void;
    /** Names the group for screen readers when more than one filter is on a page. */
    label?: string;
}

/**
 * Filter and legend in one control: chips that each say what their colour means
 * and switch the view to it. A separate read-only key beside them would be the
 * same three words twice.
 *
 * Shared by the station board and the topic page so the two can't drift into
 * describing the same four states differently — they filter the same station
 * array through the same `matchesStatus`, and they should look like it.
 */
export default function StatusChips({
    status,
    onStatusChange,
    label = 'Filter by progress',
}: StatusChipsProps) {
    return (
        <div className="flex flex-wrap items-center gap-1.5" role="group" aria-label={label}>
            {LIBRARY_STATUSES.map(option => {
                const isActive = option.value === status;
                const dot = option.value === 'all' ? null : CHIP_DOT[option.value];

                return (
                    <button
                        key={option.value}
                        type="button"
                        onClick={() => onStatusChange(option.value)}
                        aria-pressed={isActive}
                        className={`flex items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 text-[12px] font-semibold transition-colors min-h-[44px] sm:min-h-[32px] sm:px-3.5 focus-visible-ring ${
                            isActive
                                ? 'bg-primary/10 text-primary'
                                : 'text-muted hover:bg-black/[0.03] hover:text-heading'
                        }`}
                    >
                        {dot && (
                            <span
                                className="block h-[10px] w-[10px] flex-shrink-0 rounded-[2px]"
                                style={{ backgroundColor: dot }}
                                aria-hidden="true"
                            />
                        )}
                        {option.label}
                    </button>
                );
            })}
        </div>
    );
}
