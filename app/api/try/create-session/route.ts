import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

function getSupabaseAdmin() {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
    return createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } });
}

export async function POST(req: NextRequest) {
  const { sessionId, stationId } = await req.json();

  if (!sessionId || !stationId) {
    return NextResponse.json({ error: 'sessionId and stationId are required' }, { status: 400 });
  }

  const supabase = getSupabaseAdmin();

  // Verify station is a free trial station
  const { data: station } = await supabase
    .from('stations')
    .select('id, is_free_trial, is_active')
    .eq('id', stationId)
    .single();

  if (!station || !station.is_free_trial || !station.is_active) {
    return NextResponse.json({ error: 'Invalid free trial station' }, { status: 400 });
  }

  // Check if session already exists (idempotent)
  const { data: existing } = await supabase
    .from('clinical_sessions')
    .select('id')
    .eq('id', sessionId)
    .single();

  if (existing) {
    return NextResponse.json({ status: 'exists', sessionId });
  }

  // Create guest session (user_id is null)
  const { error } = await supabase
    .from('clinical_sessions')
    .insert({
      id: sessionId,
      user_id: null,
      station_id: stationId,
      status: 'reading',
      started_at: new Date().toISOString(),
    });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ status: 'created', sessionId });
}
