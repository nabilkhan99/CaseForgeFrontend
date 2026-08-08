'use client';

import { useEffect, useRef } from 'react';
import { usePathname } from 'next/navigation';
import { initAnalytics, capturePageview } from '@/lib/analytics';

export default function AnalyticsWrapper() {
    const pathname = usePathname();
    const isFirstLoad = useRef(true);

    useEffect(() => {
        initAnalytics();
    }, []);

    // PostHog captures the initial load itself; capture every client-side
    // navigation after that so in-app journeys (try flow, dashboard, coaching
    // day) show up as pageviews instead of vanishing.
    useEffect(() => {
        if (isFirstLoad.current) {
            isFirstLoad.current = false;
            return;
        }
        capturePageview();
    }, [pathname]);

    return null;
}
