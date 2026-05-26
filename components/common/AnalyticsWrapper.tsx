'use client';

import { useEffect } from 'react';
import { initAnalytics } from '@/lib/analytics';

export default function AnalyticsWrapper() {
    useEffect(() => {
        initAnalytics();
    }, []);

    return null;
}
