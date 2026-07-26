import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase/admin';
import { isAdmin } from '@/lib/admin/guard';
import { computeOrderStats, type OrderRow } from '@/lib/commerce/orderStats';

/** One purchase as the admin orders view needs it (a `preorders` row). */
export interface AdminOrder {
  id: string;
  email: string;
  full_name: string | null;
  plan: string;
  coaching_day: string | null;
  amount: number;
  currency: string;
  status: string;
  referral_code: string | null;
  created_at: string;
}

/** One coaching day from the availability view, with capacity context. */
export interface AdminCoachingDay {
  day: string;
  label: string;
  capacity: number;
  places_left: number;
  status: 'open' | 'closed' | 'sold_out';
  past: boolean;
}

/**
 * Admin orders API. Guarded (fail-closed) by the ADMIN_EMAILS allowlist — the
 * check runs before any data access. Returns 403 JSON when not authorized.
 *
 * GET — every preorder (newest first), the pure rollup over them, and live
 * coaching-day availability. Unlike /api/admin/referrals this shows ALL buyers,
 * including the majority who arrive without a referral link.
 */
export async function GET() {
  if (!(await isAdmin())) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const supabase = getSupabaseAdmin();

  const { data, error } = await supabase
    .from('preorders')
    .select(
      'id, email, full_name, plan, coaching_day, amount, currency, status, referral_code, created_at',
    )
    .order('created_at', { ascending: false });

  if (error) {
    console.error('[admin-orders] list query failed', error);
    return NextResponse.json({ error: 'Failed to load orders' }, { status: 500 });
  }

  const orders = (data ?? []) as AdminOrder[];
  const stats = computeOrderStats(orders as OrderRow[]);

  // ── Coaching-day availability ──
  // Secondary context, not the point of the page: a failure here degrades
  // gracefully to an empty list so the orders table still renders.
  let coachingDays: AdminCoachingDay[] = [];
  const { data: dayData, error: daysError } = await supabase
    .from('coaching_day_availability')
    .select('day, label, capacity, places_left, status, past')
    .order('day', { ascending: true });

  if (daysError) {
    console.error('[admin-orders] coaching day query failed', daysError);
  } else {
    coachingDays = (dayData ?? []) as AdminCoachingDay[];
  }

  return NextResponse.json({ orders, stats, coachingDays });
}
