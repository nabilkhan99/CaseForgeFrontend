import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase/admin';

/**
 * Flight-recorder sink for Clinical Master voice sessions. The client
 * uploads its in-memory event ring periodically, on errors, and via
 * sendBeacon when the tab closes — so a session that dies mid-call
 * leaves its event trail in voice_session_logs instead of vanishing
 * (a tester's session died at ~8 min and left zero evidence).
 *
 * Accepts both fetch(keepalive) and navigator.sendBeacon payloads.
 */

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const MAX_EVENTS = 2000;
const MAX_BODY_BYTES = 512 * 1024;

interface VoiceLogPayload {
  sessionId?: string;
  reason?: string;
  build?: string;
  ua?: string;
  events?: unknown[];
  transcriptTurns?: number;
  transcriptTail?: unknown[];
}

export async function POST(req: NextRequest) {
  let payload: VoiceLogPayload;
  try {
    const raw = await req.text();
    if (raw.length > MAX_BODY_BYTES) {
      return NextResponse.json({ error: 'Payload too large' }, { status: 413 });
    }
    payload = JSON.parse(raw) as VoiceLogPayload;
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const sessionId = String(payload.sessionId ?? '');
  if (!UUID_RE.test(sessionId)) {
    return NextResponse.json({ error: 'Invalid sessionId' }, { status: 400 });
  }
  const events = Array.isArray(payload.events) ? payload.events.slice(0, MAX_EVENTS) : [];

  const admin = getSupabaseAdmin();
  const { error } = await admin.from('voice_session_logs').insert({
    session_id: sessionId,
    reason: String(payload.reason ?? 'unknown').slice(0, 60),
    build: String(payload.build ?? 'unknown').slice(0, 40),
    ua: String(payload.ua ?? '').slice(0, 400),
    events,
    transcript_turns:
      typeof payload.transcriptTurns === 'number' ? payload.transcriptTurns : null,
    transcript_tail: Array.isArray(payload.transcriptTail)
      ? payload.transcriptTail.slice(0, 8)
      : null,
  });

  if (error) {
    console.error('voice-log insert failed:', error.message);
    return NextResponse.json({ error: 'Insert failed' }, { status: 500 });
  }
  return new NextResponse(null, { status: 204 });
}
