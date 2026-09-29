import { NextResponse } from 'next/server';
import { isAdmin } from '@/lib/admin/guard';
import { getSupabaseAdmin } from '@/lib/supabase/admin';
import {
  COACHING_ORDER_COLUMNS,
  coachingListCutoff,
  deriveBookings,
  sortBookings,
  type AdminCoachingBooking,
  type CoachingOrderRow,
} from '@/lib/commerce/adminCoaching';

export interface AdminCoachingListResponse {
  bookings: AdminCoachingBooking[];
}

/**
 * Admin coaching API. Guarded (fail-closed) by the ADMIN_EMAILS allowlist
 * before any data access.
 *
 * GET: every paid Complete booking from a week ago onwards, soonest first, with
 * the coach, the joining link, when the confirmation went out, and whether the
 * coach can already see the student on their Students tab.
 */
export async function GET() {
  if (!(await isAdmin())) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  try {
    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase
      .from('preorders')
      .select(COACHING_ORDER_COLUMNS)
      .eq('plan', 'complete')
      .eq('status', 'paid')
      .gte('coaching_day', coachingListCutoff());
    if (error) throw error;

    const bookings = await deriveBookings(supabase, (data ?? []) as CoachingOrderRow[]);
    const body: AdminCoachingListResponse = { bookings: sortBookings(bookings) };
    return NextResponse.json(body, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error: unknown) {
    console.error('[admin-coaching] list failed', error);
    return NextResponse.json({ error: 'Failed to load coaching bookings' }, { status: 500 });
  }
}
