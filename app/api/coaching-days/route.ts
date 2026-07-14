import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import type { CoachingDayAvailability } from '@/lib/commerce/plans';

export const revalidate = 0;

function getSupabaseAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
  return createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } });
}

/**
 * Live availability per coaching day, for the day picker. Sold-out days stay
 * visible; days whose date has passed drop off the list.
 */
export async function GET() {
  try {
    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase
      .from('coaching_day_availability')
      .select('day, label, capacity, places_left, cutoff_at, status, past')
      .eq('past', false)
      .order('day', { ascending: true });

    if (error) {
      console.error('[coaching-days] availability query failed', error);
      return NextResponse.json({ error: 'Failed to load coaching days' }, { status: 500 });
    }

    const days = (data ?? []).map(({ past: _past, ...day }) => day) as CoachingDayAvailability[];
    return NextResponse.json(
      { days },
      { headers: { 'Cache-Control': 'public, s-maxage=15, stale-while-revalidate=30' } },
    );
  } catch (error: unknown) {
    console.error('[coaching-days] unexpected error', error);
    return NextResponse.json({ error: 'Failed to load coaching days' }, { status: 500 });
  }
}
