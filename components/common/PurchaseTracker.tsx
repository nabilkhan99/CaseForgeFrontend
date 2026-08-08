'use client';

import { useEffect } from 'react';
import { trackEvent } from '@/lib/analytics';

interface PurchaseTrackerProps {
  sessionId: string;
  plan: string;
  coachingDay: string | null;
}

/**
 * Fires the `purchase` event once per Stripe session when the /thanks page
 * confirms a paid order. The sessionStorage guard stops refreshes of the
 * thanks page from double-counting the sale.
 */
export default function PurchaseTracker({ sessionId, plan, coachingDay }: PurchaseTrackerProps) {
  useEffect(() => {
    const guardKey = `ff_purchase_${sessionId}`;
    try {
      if (sessionStorage.getItem(guardKey)) return;
      sessionStorage.setItem(guardKey, '1');
    } catch {
      // sessionStorage unavailable (private mode) — still capture, accepting
      // a possible duplicate on refresh over losing the event entirely.
    }
    trackEvent('purchase', {
      plan,
      coaching_day: coachingDay ?? '',
      stripe_session: sessionId,
    });
  }, [sessionId, plan, coachingDay]);

  return null;
}
