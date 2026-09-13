'use client';

import { useEffect } from 'react';
import { trackEvent } from '@/lib/analytics';

interface PurchaseTrackerProps {
  stripeSessionId: string;
  plan: string;
  /** ISO date of the booked coaching session. Complete only. */
  coachingDate: string | null;
  /** 'morning' | 'afternoon'. Complete only; null for a booking made before slots existed. */
  coachingSlot: string | null;
}

/**
 * Fires the purchase event once per Stripe session on the /thanks page.
 * The sessionStorage guard stops refreshes double-counting a sale.
 */
export default function PurchaseTracker({
  stripeSessionId,
  plan,
  coachingDate,
  coachingSlot,
}: PurchaseTrackerProps) {
  useEffect(() => {
    const key = `ff_purchase_${stripeSessionId}`;
    try {
      if (window.sessionStorage.getItem(key)) return;
      window.sessionStorage.setItem(key, '1');
    } catch {
      // Storage unavailable: still record the event. Worst case a refresh double-counts.
    }
    trackEvent('purchase', {
      plan,
      coaching_date: coachingDate ?? '',
      coaching_slot: coachingSlot ?? '',
      stripe_session: stripeSessionId,
    });
  }, [stripeSessionId, plan, coachingDate, coachingSlot]);

  return null;
}
