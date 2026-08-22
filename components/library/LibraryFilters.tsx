'use client';

import { motion } from 'framer-motion';
import { LIBRARY_STATUSES, type LibraryStatus } from '@/lib/stations/librarySearch';

interface DomainOption {
    id: string;
    name: string;
    station_count: number;
}

interface LibraryFiltersProps {
    query: string;
    onQueryChange: (value: string) => void;
    status: LibraryStatus;
    onStatusChange: (value: LibraryStatus) => void;
    /** Omitted on a domain page, where the domain is already the page. */
    domains?: DomainOption[];
    domainId?: string;
    onDomainChange?: (value: string) => void;
    placeholder?: string;
    /** Right-aligned count, e.g. "12 cases". Hidden when nothing is filtered. */
    resultLabel?: string;
}

/**
 * One quiet search field over a rule, with the filters as pills beneath it.
 *
 * Deliberately not a boxed toolbar: the library is a list of rows between
 * rules, and a bordered control panel on top of it would be the first card in
 * a page that has none.
 */
export default function LibraryFilters({
    query,
    onQueryChange,
    status,
    onStatusChange,
    domains,
    domainId = '',
    onDomainChange,
    placeholder = 'Search cases, patients or symptoms',
    resultLabel,
}: LibraryFiltersProps) {
    return (
        <motion.div
            className="mb-6"
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.25 }}
        >
            <div className="flex items-center gap-3 border-b border-black/[0.08] pb-2 transition-colors focus-within:border-primary/60">
                <svg
                    className="h-4 w-4 flex-shrink-0 text-muted"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    strokeWidth={2}
                    aria-hidden="true"
                >
                    <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-4.35-4.35M17 11a6 6 0 11-12 0 6 6 0 0112 0z" />
                </svg>
                <input
                    type="text"
                    value={query}
                    onChange={event => onQueryChange(event.target.value)}
                    aria-label="Search cases"
                    enterKeyHint="search"
                    autoComplete="off"
                    placeholder={placeholder}
                    // 16px on mobile: anything smaller makes iOS Safari zoom the
                    // page in on focus and never zoom back out.
                    className="min-w-0 flex-1 border-0 bg-transparent py-1.5 text-base text-heading outline-none placeholder:text-muted sm:text-[15px]"
                />
                {query && (
                    <button
                        type="button"
                        onClick={() => onQueryChange('')}
                        aria-label="Clear search"
                        className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full text-muted transition-colors hover:bg-black/[0.04] hover:text-heading focus-visible-ring"
                    >
                        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                        </svg>
                    </button>
                )}
            </div>

            <div className="mt-3 flex flex-wrap items-center gap-x-1.5 gap-y-2">
                <div className="flex flex-wrap items-center gap-1.5" role="group" aria-label="Filter by progress">
                    {LIBRARY_STATUSES.map(option => {
                        const active = option.value === status;
                        return (
                            <button
                                key={option.value}
                                type="button"
                                onClick={() => onStatusChange(option.value)}
                                aria-pressed={active}
                                className={`rounded-full px-3.5 text-[12px] font-semibold transition-colors min-h-[44px] sm:min-h-[32px] focus-visible-ring ${
                                    active
                                        ? 'bg-primary/10 text-primary'
                                        : 'text-muted hover:bg-black/[0.03] hover:text-heading'
                                }`}
                            >
                                {option.label}
                            </button>
                        );
                    })}
                </div>

                {domains && onDomainChange && (
                    <div className="relative">
                        <select
                            value={domainId}
                            onChange={event => onDomainChange(event.target.value)}
                            aria-label="Filter by domain"
                            className={`appearance-none rounded-full border border-black/[0.08] bg-transparent py-0 pl-3.5 pr-8 text-[12px] font-semibold transition-colors min-h-[44px] sm:min-h-[32px] focus-visible-ring ${
                                domainId ? 'text-primary' : 'text-muted hover:text-heading'
                            }`}
                        >
                            <option value="">All domains</option>
                            {domains.map(domain => (
                                <option key={domain.id} value={domain.id}>
                                    {domain.name} ({domain.station_count})
                                </option>
                            ))}
                        </select>
                        <svg
                            className="pointer-events-none absolute right-3 top-1/2 h-3 w-3 -translate-y-1/2 text-muted"
                            fill="none"
                            viewBox="0 0 24 24"
                            stroke="currentColor"
                            strokeWidth={2}
                            aria-hidden="true"
                        >
                            <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                        </svg>
                    </div>
                )}

                {resultLabel && (
                    <span
                        className="ml-auto text-[12px] tabular-nums text-muted"
                        aria-live="polite"
                    >
                        {resultLabel}
                    </span>
                )}
            </div>
        </motion.div>
    );
}
