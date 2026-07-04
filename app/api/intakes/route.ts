import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import type { IntakeAvailability } from '@/lib/commerce/plans';

export const revalidate = 0;

function getSupabaseAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
  return createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } });
}

/** Live seat availability per intake month, for the pricing UI. */
export async function GET() {
  try {
    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase
      .from('intake_availability')
      .select('month, label, capacity, seats_left, enrol_deadline, status, sort_order')
      .order('sort_order', { ascending: true });

    if (error) {
      console.error('[intakes] availability query failed', error);
      return NextResponse.json({ error: 'Failed to load intakes' }, { status: 500 });
    }

    const intakes = (data ?? []) as IntakeAvailability[];
    return NextResponse.json(
      { intakes },
      { headers: { 'Cache-Control': 'public, s-maxage=30, stale-while-revalidate=60' } },
    );
  } catch (error: unknown) {
    console.error('[intakes] unexpected error', error);
    return NextResponse.json({ error: 'Failed to load intakes' }, { status: 500 });
  }
}
