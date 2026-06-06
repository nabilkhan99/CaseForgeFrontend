import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase/admin';

/**
 * Persist a finished consultation transcript and move the session to
 * 'processing' so the feedback pipeline can pick it up. Mirrors the former
 * Python agent's save_transcript + update_session_status('processing').
 *
 * Used by both authenticated and guest flows (service-role; keyed by session id).
 * Only advances a 'live' session so completed sessions can't be clobbered.
 */
export async function POST(req: NextRequest) {
  const { sessionId, transcript } = await req.json();

  if (!sessionId || !Array.isArray(transcript)) {
    return NextResponse.json(
      { error: 'sessionId and transcript[] are required' },
      { status: 400 }
    );
  }

  const admin = getSupabaseAdmin();
  const { error } = await admin
    .from('clinical_sessions')
    .update({ transcript, status: 'processing' })
    .eq('id', sessionId)
    .eq('status', 'live');

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ status: 'processing' });
}
