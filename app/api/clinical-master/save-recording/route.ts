import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase/admin';

/**
 * Store the mixed audio of a finished consultation in the private
 * `consultation-recordings` bucket and stamp `clinical_sessions.recording_path`.
 *
 * Used by both the authenticated and guest flows (service-role, keyed by
 * session id — same trust model as save-transcript). Abuse of that model is
 * bounded by three rules:
 *   - the session must exist and be mid-flight ('live' or 'processing'), so a
 *     finished consultation can never have its audio replaced;
 *   - `recording_path` must still be null, making this single-shot per session;
 *   - the body must be audio, under MAX_UPLOAD_BYTES.
 */

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const BUCKET = 'consultation-recordings';
/** A 12-minute Opus mix is ~4MB; 30MB leaves room for fatter containers. */
const MAX_UPLOAD_BYTES = 30 * 1024 * 1024;
const MIN_UPLOAD_BYTES = 2048;
const ALLOWED_EXTENSIONS = new Set(['webm', 'm4a', 'mp4', 'ogg']);
/** Statuses a recording may still arrive for. */
const UPLOADABLE_STATUSES = new Set(['live', 'processing']);

/** Extension from the client filename, constrained to the known containers. */
function safeExtension(filename: string): string | null {
  const ext = filename.split('.').pop()?.toLowerCase() ?? '';
  return ALLOWED_EXTENSIONS.has(ext) ? ext : null;
}

export async function POST(req: NextRequest) {
  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return NextResponse.json({ error: 'Expected multipart form data' }, { status: 400 });
  }

  const sessionId = String(form.get('sessionId') ?? '');
  if (!UUID_RE.test(sessionId)) {
    return NextResponse.json({ error: 'Invalid sessionId' }, { status: 400 });
  }

  const file = form.get('file');
  if (!(file instanceof File)) {
    return NextResponse.json({ error: 'file is required' }, { status: 400 });
  }
  if (file.size > MAX_UPLOAD_BYTES) {
    return NextResponse.json({ error: 'Recording too large' }, { status: 413 });
  }
  if (file.size < MIN_UPLOAD_BYTES) {
    return NextResponse.json({ error: 'Recording too small' }, { status: 400 });
  }
  if (!file.type.startsWith('audio/')) {
    return NextResponse.json({ error: 'Expected an audio file' }, { status: 415 });
  }
  const extension = safeExtension(file.name);
  if (!extension) {
    return NextResponse.json({ error: 'Unsupported audio container' }, { status: 415 });
  }

  const admin = getSupabaseAdmin();

  const { data: session, error: lookupError } = await admin
    .from('clinical_sessions')
    .select('id, status, recording_path')
    .eq('id', sessionId)
    .maybeSingle();

  if (lookupError) {
    console.error('[save-recording] session lookup failed', lookupError.message);
    return NextResponse.json({ error: 'Lookup failed' }, { status: 500 });
  }
  if (!session) {
    return NextResponse.json({ error: 'Session not found' }, { status: 404 });
  }
  if (session.recording_path) {
    // Already recorded — the first upload wins.
    return NextResponse.json({ status: 'exists' }, { status: 200 });
  }
  if (!UPLOADABLE_STATUSES.has(String(session.status))) {
    return NextResponse.json({ error: 'Session is not accepting audio' }, { status: 409 });
  }

  const path = `recordings/${sessionId}.${extension}`;
  const { error: uploadError } = await admin.storage
    .from(BUCKET)
    .upload(path, file, { contentType: file.type, upsert: false });

  if (uploadError) {
    console.error('[save-recording] upload failed', uploadError.message);
    return NextResponse.json({ error: 'Upload failed' }, { status: 500 });
  }

  const { error: stampError } = await admin
    .from('clinical_sessions')
    .update({ recording_path: path })
    .eq('id', sessionId)
    .is('recording_path', null);

  if (stampError) {
    console.error('[save-recording] stamping recording_path failed', stampError.message);
    return NextResponse.json({ error: 'Failed to record path' }, { status: 500 });
  }

  return NextResponse.json({ status: 'saved', path, bytes: file.size });
}
