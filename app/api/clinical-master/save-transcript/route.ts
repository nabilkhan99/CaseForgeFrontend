import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase/admin';
import { triggerMarking } from '@/lib/clinical-master/triggerMarking';

/**
 * Hobby-plan ceiling: Vercel rejects anything above 60 at deploy time. The
 * after() callback inside triggerMarking awaits the ~65-90s mark-consultation
 * round trip, so it is severed at 60s — Azure still finishes the run and writes
 * session_results; the stale-claim TTL covers a late failure we cannot see.
 */
export const maxDuration = 60;

/**
 * Persist a consultation transcript. Used by both authenticated and guest flows
 * (service-role; keyed by session id). Only touches a 'live' session so a
 * completed one can never be clobbered.
 *
 * `final` (default true) ends the consultation: the transcript is written, the
 * session advances to 'processing', AND marking is started. Marking used to be
 * requested only by the feedback report's poll, which made it a side effect of
 * someone reaching that page: a tab closed on the way there left the session in
 * 'processing' forever — ten rows in production had been sitting there for
 * days. Starting it here means the mark is being made while the trainee is
 * still deciding whether to look at it.
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

  // Start marking. Guarded by the shared claim, so the report's first poll
  // racing this save produces one run and one result row, whichever arrives
  // first. An empty transcript is skipped rather than marked: there is nothing
  // to grade, and generate-feedback reports that case as 'no_transcript'.
  //
  // Never allowed to fail the save. The transcript is the irreplaceable thing
  // here — marking can be retaken from the feedback page, a lost transcript
  // cannot be recovered at all.
  if (final && transcript.length > 0) {
    try {
      await triggerMarking({ admin, sessionId });
    } catch (err) {
      console.error('[save-transcript] failed to start marking', { sessionId, err });
    }
  }

  return NextResponse.json({ status: 'processing' });
}
