import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { sessionId, stationId } = await req.json();

  if (!sessionId || !stationId) {
    return NextResponse.json({ error: 'sessionId and stationId are required' }, { status: 400 });
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

  // Create the session record
  const { error } = await supabase
    .from('clinical_sessions')
    .insert({
      id: sessionId,
      user_id: user.id,
      station_id: stationId,
      status: 'reading',
      started_at: new Date().toISOString(),
    });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ status: 'created', sessionId });
}
