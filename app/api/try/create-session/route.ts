import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase/admin';
import { rejectIfSignedIn } from '@/lib/trial/guestOnly';

export async function POST(req: NextRequest) {
  // Guests only. A signed-in caller would otherwise create a consultation
  // owned by nobody, outside their own entitlement and invisible from their
  // dashboard.
  const signedIn = await rejectIfSignedIn();
  if (signedIn) return signedIn;

  const { sessionId, stationId, knownEmail } = await req.json();

  if (!sessionId || !stationId) {
    return NextResponse.json({ error: 'sessionId and stationId are required' }, { status: 400 });
  }

  const supabase = getSupabaseAdmin();

  // One free station per person: if this browser has already been through the
  // email gate, refuse a second run for that email. (First runs are anonymous,
  // so this is honest-user enforcement, not a hard wall.)
  if (typeof knownEmail === 'string' && knownEmail.trim()) {
    const { data: existingLead } = await supabase
      .from('trial_leads')
      .select('id')
      .ilike('email', knownEmail.trim())
      .maybeSingle();

    if (existingLead) {
      return NextResponse.json(
        {
          error: 'You have already used your free mock station',
          code: 'free_station_used',
        },
        { status: 409 },
      );
    }
  }

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
