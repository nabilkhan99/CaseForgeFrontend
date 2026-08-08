'use client';

import { useEffect } from 'react';
import { trackEvent } from '@/lib/analytics';

interface PurchaseTrackerProps {
  stripeSessionId: string;
  plan: string;
  coachingDay: string | null;
}

/**
 * Fires the purchase event once per Stripe session on the /thanks page.
 * The sessionStorage guard stops refreshes double-counting a sale.
 */
export default function PurchaseTracker({ stripeSessionId, plan, coachingDay }: PurchaseTrackerProps) {
  useEffect(() => {
    const key = `ff_purchase_${stripeSessionId}`;
    try {
      if (window.sessionStorage.getItem(key)) return;
      window.sessionStorage.setItem(key, '1');
    } catch {
      // Storage unavailable — still record the event; worst case a refresh double-counts.
    }
    trackEvent('purchase', {
      plan,
      coaching_day: coachingDay ?? '',
      stripe_session: stripeSessionId,
    });
  }, [stripeSessionId, plan, coachingDay]);

  return null;
}
