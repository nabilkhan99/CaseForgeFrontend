import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase/admin';

/**
 * Mark a session the user walked away from as 'abandoned'.
 *
 * Nothing used to write this state: Exit → Leave just tore down the WebRTC
 * connection, so every pre-mic visit and every mid-consultation exit stayed
 * 'reading'/'live' forever, and the dashboard surfaced each one as an
 * "Unfinished case" on accounts with zero consultations. Same shape as
 * save-transcript: service role, keyed by session id, and only ever moves a
 * session that has not finished — a completed or processing row can never be
 * demoted. Accepts sendBeacon bodies (text/plain) for the pagehide path.
 */
export async function POST(req: NextRequest) {
  let sessionId: unknown;
  try {
    const raw = await req.text();
    sessionId = raw ? (JSON.parse(raw) as { sessionId?: unknown }).sessionId : undefined;
  } catch {
    return NextResponse.json({ error: 'Invalid body' }, { status: 400 });
  }
  if (typeof sessionId !== 'string' || sessionId.length === 0) {
    return NextResponse.json({ error: 'sessionId is required' }, { status: 400 });
  }

  const admin = getSupabaseAdmin();
  const { error } = await admin
    .from('clinical_sessions')
    .update({ status: 'abandoned' })
    .eq('id', sessionId)
    .in('status', ['reading', 'live']);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ status: 'abandoned' });
}
