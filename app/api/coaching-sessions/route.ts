import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase/admin';
import {
  isCoachingSlotKey,
  isIsoDate,
  type CoachingSlotAvailability,
} from '@/lib/commerce/coachingSlots';

// Slot state changes with every hold and every booking, so nothing about this
// response may be cached, by Next or by anyone downstream.
export const dynamic = 'force-dynamic';

/**
 * Never cache. Each slot takes exactly one booking, so a cached "open" is not
 * a slightly stale count, it is a slot that is already gone being offered.
 */
const NO_STORE = { 'Cache-Control': 'no-store' } as const;

const SLOT_STATUSES: ReadonlySet<string> = new Set(['open', 'booked', 'closed']);

/** One row of `coaching_slot_availability` as selected here. */
interface SlotRow {
  day: unknown;
  slot: unknown;
  cutoff_at: unknown;
  status: unknown;
}

/**
 * Narrow a view row to the public shape, or null when it is not one. The view
 * is ours, but a row the booking UI cannot render correctly is better dropped
 * (and logged) than offered.
 */
function toAvailability(row: SlotRow): CoachingSlotAvailability | null {
  if (
    !isIsoDate(row.day) ||
    !isCoachingSlotKey(row.slot) ||
    typeof row.cutoff_at !== 'string' ||
    typeof row.status !== 'string' ||
    !SLOT_STATUSES.has(row.status)
  ) {
    console.error('[coaching-sessions] dropping an unrecognised availability row', { row });
    return null;
  }
  return {
    day: row.day,
    slot: row.slot,
    cutoff_at: row.cutoff_at,
    status: row.status as CoachingSlotAvailability['status'],
  };
}

/**
 * Live availability per coaching session slot, for the booking picker.
 *
 * Every configured coaching date appears as two slots (morning, afternoon), in
 * date then slot order. Booked and closed slots stay in the list so the picker
 * can show them as sold out; dates that have passed drop off.
 *
 * GET /api/coaching-sessions -> 200 { slots: CoachingSlotAvailability[] }
 */
export async function GET() {
  try {
    const { data, error } = await getSupabaseAdmin()
      .from('coaching_slot_availability')
      .select('day, slot, cutoff_at, status')
      .eq('past', false)
      .order('day', { ascending: true })
      .order('slot_order', { ascending: true });

    if (error) {
      console.error('[coaching-sessions] availability query failed', error);
      return NextResponse.json(
        { error: 'Failed to load coaching sessions' },
        { status: 500, headers: NO_STORE },
      );
    }

    const slots = ((data ?? []) as SlotRow[])
      .map(toAvailability)
      .filter((slot): slot is CoachingSlotAvailability => slot !== null);

    return NextResponse.json({ slots }, { headers: NO_STORE });
  } catch (error: unknown) {
    console.error('[coaching-sessions] unexpected error', error);
    return NextResponse.json(
      { error: 'Failed to load coaching sessions' },
      { status: 500, headers: NO_STORE },
    );
  }
}
