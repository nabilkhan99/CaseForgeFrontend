import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase/admin';
import { isAdmin } from '@/lib/admin/guard';
import {
  computeOrderStats,
  computeSessionBookings,
  type OrderRow,
  type SessionDateBookings,
  type SlotAvailabilityRow,
} from '@/lib/commerce/orderStats';

/** One purchase as the admin orders view needs it (a `preorders` row). */
export interface AdminOrder {
  id: string;
  email: string;
  full_name: string | null;
  plan: string;
  /** Date of the booked coaching session (ISO), Complete only. */
  coaching_day: string | null;
  /** Slot of the booked coaching session; null on a booking made before slots existed. */
  coaching_slot: string | null;
  amount: number;
  currency: string;
  status: string;
  referral_code: string | null;
  created_at: string;
}

/**
 * Admin orders API. Guarded (fail-closed) by the ADMIN_EMAILS allowlist: the
 * check runs before any data access. Returns 403 JSON when not authorized.
 *
 * GET: every preorder (newest first), the pure rollup over them, and the
 * coaching session bookings per slot (each slot takes one booking). Unlike
 * /api/admin/referrals this shows ALL buyers, including the majority who arrive
 * without a referral link.
 */
export async function GET() {
  if (!(await isAdmin())) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const supabase = getSupabaseAdmin();

  const { data, error } = await supabase
    .from('preorders')
    .select(
      'id, email, full_name, plan, coaching_day, coaching_slot, amount, currency, status, referral_code, created_at',
    )
    .order('created_at', { ascending: false });

  if (error) {
    console.error('[admin-orders] list query failed', error);
    return NextResponse.json({ error: 'Failed to load orders' }, { status: 500 });
  }

  const orders = (data ?? []) as AdminOrder[];
  const stats = computeOrderStats(orders as OrderRow[]);

  // ── Coaching session bookings ──
  // Secondary context, not the point of the page: a failure here degrades
  // gracefully to an empty list so the orders table still renders.
  let sessionBookings: SessionDateBookings[] = [];
  const { data: slotData, error: slotsError } = await supabase
    .from('coaching_slot_availability')
    .select('day, slot, status, past')
    .order('day', { ascending: true })
    .order('slot_order', { ascending: true });

  if (slotsError) {
    console.error('[admin-orders] coaching slot query failed', slotsError);
  } else {
    sessionBookings = computeSessionBookings((slotData ?? []) as SlotAvailabilityRow[], orders);
  }

  return NextResponse.json({ orders, stats, sessionBookings });
}
