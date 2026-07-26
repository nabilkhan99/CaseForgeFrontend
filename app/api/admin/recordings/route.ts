import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase/admin';
import { isAdmin } from '@/lib/admin/guard';

/**
 * Admin recordings API. Guarded (fail-closed) by the ADMIN_EMAILS allowlist —
 * the check runs before any data access. Returns 403 JSON when not authorized.
 *
 * GET — every consultation that has audio (newest first) with a signed
 * playback URL, the station, who sat it, and what it scored. This is how a
 * founder listens to real users' consultations; the per-session endpoint at
 * /api/clinical-master/recording/[sessionId] only serves one at a time.
 *
 * Guest sessions (the /try funnel) have no profile, so the sitter is resolved
 * from trial_leads instead.
 */

const BUCKET = 'consultation-recordings';
const SIGNED_URL_TTL_SECONDS = 60 * 60 * 4;
const MAX_ROWS = 200;

export interface AdminRecording {
  sessionId: string;
  startedAt: string;
  status: string;
  station: string | null;
  email: string | null;
  guest: boolean;
  overallScore: number | null;
  url: string | null;
}

interface SessionRow {
  id: string;
  user_id: string | null;
  station_id: string | null;
  status: string;
  started_at: string;
  overall_score: number | null;
  recording_path: string;
  stations: { title: string | null } | null;
}

export async function GET() {
  if (!(await isAdmin())) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const supabase = getSupabaseAdmin();

  const { data, error } = await supabase
    .from('clinical_sessions')
    .select(
      'id, user_id, station_id, status, started_at, overall_score, recording_path, stations(title)',
    )
    .not('recording_path', 'is', null)
    .order('started_at', { ascending: false })
    .limit(MAX_ROWS);

  if (error) {
    console.error('[admin-recordings] list query failed', error);
    return NextResponse.json({ error: 'Failed to load recordings' }, { status: 500 });
  }

  const sessions = (data ?? []) as unknown as SessionRow[];
  if (sessions.length === 0) {
    return NextResponse.json({ recordings: [] });
  }

  // ── Who sat each one ──
  // Secondary context: a failure here degrades to a null email rather than
  // failing the page.
  const userIds = [...new Set(sessions.map((s) => s.user_id).filter(Boolean))] as string[];
  const emailByUserId = new Map<string, string>();
  if (userIds.length > 0) {
    const { data: profiles, error: profileError } = await supabase
      .from('profiles')
      .select('id, email')
      .in('id', userIds);
    if (profileError) console.error('[admin-recordings] profile lookup failed', profileError);
    for (const row of profiles ?? []) {
      if (row.email) emailByUserId.set(row.id, row.email);
    }
  }

  const guestSessionIds = sessions.filter((s) => !s.user_id).map((s) => s.id);
  const emailBySessionId = new Map<string, string>();
  if (guestSessionIds.length > 0) {
    const { data: leads, error: leadError } = await supabase
      .from('trial_leads')
      .select('session_id, email')
      .in('session_id', guestSessionIds);
    if (leadError) console.error('[admin-recordings] trial lead lookup failed', leadError);
    for (const row of leads ?? []) {
      if (row.session_id && row.email) emailBySessionId.set(row.session_id, row.email);
    }
  }

  // ── Playback URLs ──
  const paths = sessions.map((s) => s.recording_path);
  const urlByPath = new Map<string, string>();
  const { data: signed, error: signError } = await supabase.storage
    .from(BUCKET)
    .createSignedUrls(paths, SIGNED_URL_TTL_SECONDS);
  if (signError) {
    console.error('[admin-recordings] signing failed', signError);
  }
  for (const entry of signed ?? []) {
    if (entry.path && entry.signedUrl) urlByPath.set(entry.path, entry.signedUrl);
  }

  const recordings: AdminRecording[] = sessions.map((session) => ({
    sessionId: session.id,
    startedAt: session.started_at,
    status: session.status,
    station: session.stations?.title ?? null,
    email: session.user_id
      ? (emailByUserId.get(session.user_id) ?? null)
      : (emailBySessionId.get(session.id) ?? null),
    guest: !session.user_id,
    overallScore: session.overall_score,
    url: urlByPath.get(session.recording_path) ?? null,
  }));

  return NextResponse.json({ recordings });
}
