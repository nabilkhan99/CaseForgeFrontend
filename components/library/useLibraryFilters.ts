'use client';

import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';
import { parseStatus, type LibraryStatus } from '@/lib/stations/librarySearch';

export interface LibraryFilterState {
    query: string;
    status: LibraryStatus;
    domainId: string;
}

/**
 * Library search state, mirrored into `?q=&status=&domain=`.
 *
 * Two-way rather than URL-only on purpose: rendering off the URL would put a
 * router navigation between every keystroke and the list updating, which is
 * exactly the wrong place to spend a frame on a phone. So local state drives
 * the list immediately and the URL catches up ~250 ms later — which is all the
 * URL is for here. Someone who searches "chest", opens a case and comes back
 * lands on their results rather than on the 29-folder wall they had to get
 * past to find it.
 *
 * The library routes carry no other query parameters, so the mirror writes the
 * whole search string rather than merging.
 */
export function useLibraryFilters(): {
    filters: LibraryFilterState;
    setQuery: (value: string) => void;
    setStatus: (value: LibraryStatus) => void;
    setDomainId: (value: string) => void;
    clear: () => void;
} {
    const router = useRouter();
    const pathname = usePathname();
    const searchParams = useSearchParams();

    const [filters, setFilters] = useState<LibraryFilterState>(() => ({
        query: searchParams.get('q') ?? '',
        status: parseStatus(searchParams.get('status')),
        domainId: searchParams.get('domain') ?? '',
    }));

    useEffect(() => {
        const timer = setTimeout(() => {
            const params = new URLSearchParams();
            if (filters.query.trim()) params.set('q', filters.query.trim());
            if (filters.status !== 'all') params.set('status', filters.status);
            if (filters.domainId) params.set('domain', filters.domainId);

            const search = params.toString();
            // Guard the no-op: the first run always matches, and replacing the
            // history entry with itself would fight the browser's scroll
            // restoration on a back-navigation.
            if (search === window.location.search.replace(/^\?/, '')) return;
            router.replace(search ? `${pathname}?${search}` : pathname, { scroll: false });
        }, 250);

        return () => clearTimeout(timer);
    }, [filters, pathname, router]);

    const setQuery = useCallback((query: string) => {
        setFilters(current => ({ ...current, query }));
    }, []);

    const setStatus = useCallback((status: LibraryStatus) => {
        setFilters(current => ({ ...current, status }));
    }, []);

    const setDomainId = useCallback((domainId: string) => {
        setFilters(current => ({ ...current, domainId }));
    }, []);

    const clear = useCallback(() => {
        setFilters({ query: '', status: 'all', domainId: '' });
    }, []);

    return { filters, setQuery, setStatus, setDomainId, clear };
}
