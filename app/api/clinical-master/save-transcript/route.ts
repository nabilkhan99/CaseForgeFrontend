import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase/admin';

/**
 * Persist a consultation transcript. Used by both authenticated and guest flows
 * (service-role; keyed by session id). Only touches a 'live' session so a
 * completed one can never be clobbered.
 *
 * `final` (default true) ends the consultation: the transcript is written AND the
 * session advances to 'processing' so the feedback pipeline picks it up.
 *
 * `final: false` is an interim checkpoint — transcript only, status untouched, so
 * the marking pipeline is not triggered mid-consultation. Interim saves exist
 * because the transcript used to be written exactly once, at the end: three
 * sessions on 26 Jul were abandoned mid-consultation and lost everything, with
 * the patient having spoken 6, 8 and 14 times. Roughly 5% of all sessions. Same
 * failure shape as the recording 413 — one moment at the end carrying the whole
 * consultation.
 */
export async function POST(req: NextRequest) {
  const { sessionId, transcript, final = true } = await req.json();

  if (!sessionId || !Array.isArray(transcript)) {
    return NextResponse.json(
      { error: 'sessionId and transcript[] are required' },
      { status: 400 }
    );
  }
  // An interim save with nothing in it would blank a transcript that a later
  // beacon had already delivered. Never write an empty array except on a final.
  if (!final && transcript.length === 0) {
    return NextResponse.json({ status: 'skipped-empty' });
  }

  const admin = getSupabaseAdmin();
  const { error } = await admin
    .from('clinical_sessions')
    .update(final ? { transcript, status: 'processing' } : { transcript })
    .eq('id', sessionId)
    .eq('status', 'live');

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ status: 'processing' });
}
