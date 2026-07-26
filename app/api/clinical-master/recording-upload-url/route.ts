import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase/admin';

/**
 * Signed-URL upload for consultation audio.
 *
 * The original flow POSTed the blob through /api/clinical-master/save-recording,
 * which meant the whole file crossed a serverless function. Vercel caps a
 * request body at ~4.5MB, so that route 413'd before its own 30MB limit was
 * ever consulted — and it failed for exactly the sessions that matter:
 *
 *   52s  ->  saved        3m55s ->  saved
 *   11m  ->  413, 10.3MB lost   (a real full-length consultation)
 *
 * Every test recording was short, so this went unnoticed until a reviewer ran a
 * full station. Here the browser PUTs straight to Supabase Storage and the file
 * never touches the function, removing the ceiling rather than raising it.
 *
 * Two phases, same trust model as save-recording (service-role, keyed by
 * session id, same as save-transcript):
 *   POST — mint a signed upload URL. Session must exist, be mid-flight, and
 *          have no recording yet.
 *   PUT  — after the upload, verify the object really landed and stamp
 *          clinical_sessions.recording_path. Stamping only ever happens from a
 *          confirmed object, so a client cannot point the row at nothing.
 */

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const BUCKET = 'consultation-recordings';
const ALLOWED_EXTENSIONS = new Set(['webm', 'm4a', 'mp4', 'ogg']);
const UPLOADABLE_STATUSES = new Set(['live', 'processing']);
/** Guards against a stamped path for an object that is obviously not audio. */
const MIN_OBJECT_BYTES = 2048;

function pathFor(sessionId: string, extension: string): string {
  return `recordings/${sessionId}.${extension}`;
}

/** Phase 1 — mint a signed upload URL for this session's recording. */
export async function POST(req: NextRequest) {
  let body: { sessionId?: string; extension?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Expected JSON' }, { status: 400 });
  }

  const sessionId = String(body.sessionId ?? '');
  if (!UUID_RE.test(sessionId)) {
    return NextResponse.json({ error: 'Invalid sessionId' }, { status: 400 });
  }
  const extension = String(body.extension ?? '').toLowerCase();
  if (!ALLOWED_EXTENSIONS.has(extension)) {
    return NextResponse.json({ error: 'Unsupported audio container' }, { status: 415 });
  }

  const admin = getSupabaseAdmin();
  const { data: session, error: lookupError } = await admin
    .from('clinical_sessions')
    .select('id, status, recording_path')
    .eq('id', sessionId)
    .maybeSingle();

  if (lookupError) {
    console.error('[recording-upload-url] lookup failed', lookupError.message);
    return NextResponse.json({ error: 'Lookup failed' }, { status: 500 });
  }
  if (!session) {
    return NextResponse.json({ error: 'Session not found' }, { status: 404 });
  }
  if (session.recording_path) {
    return NextResponse.json({ status: 'exists' }, { status: 200 });
  }
  if (!UPLOADABLE_STATUSES.has(String(session.status))) {
    return NextResponse.json({ error: 'Session is not accepting audio' }, { status: 409 });
  }

  const path = pathFor(sessionId, extension);
  const { data, error } = await admin.storage.from(BUCKET).createSignedUploadUrl(path);

  if (error || !data) {
    console.error('[recording-upload-url] could not sign', error?.message);
    return NextResponse.json({ error: 'Could not sign upload' }, { status: 500 });
  }

  return NextResponse.json({
    status: 'signed',
    path,
    token: data.token,
    signedUrl: data.signedUrl,
  });
}

/** Phase 2 — confirm the object exists, then stamp the row. */
export async function PUT(req: NextRequest) {
  let body: { sessionId?: string; path?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Expected JSON' }, { status: 400 });
  }

  const sessionId = String(body.sessionId ?? '');
  if (!UUID_RE.test(sessionId)) {
    return NextResponse.json({ error: 'Invalid sessionId' }, { status: 400 });
  }
  const path = String(body.path ?? '');
  // Never trust a client-supplied path — rebuild it and compare.
  const extension = path.split('.').pop()?.toLowerCase() ?? '';
  if (!ALLOWED_EXTENSIONS.has(extension) || path !== pathFor(sessionId, extension)) {
    return NextResponse.json({ error: 'Path does not belong to this session' }, { status: 400 });
  }

  const admin = getSupabaseAdmin();

  // The object must actually be there, and be big enough to be audio.
  const { data: listed, error: listError } = await admin.storage
    .from(BUCKET)
    .list('recordings', { search: `${sessionId}.${extension}` });

  if (listError) {
    console.error('[recording-upload-url] list failed', listError.message);
    return NextResponse.json({ error: 'Could not verify upload' }, { status: 500 });
  }
  const object = listed?.find((o) => o.name === `${sessionId}.${extension}`);
  if (!object) {
    return NextResponse.json({ error: 'Upload not found in storage' }, { status: 404 });
  }
  const size = Number(
    (object.metadata as { size?: number } | null)?.size ?? 0
  );
  if (size && size < MIN_OBJECT_BYTES) {
    return NextResponse.json({ error: 'Recording too small' }, { status: 400 });
  }

  const { error: stampError } = await admin
    .from('clinical_sessions')
    .update({ recording_path: path })
    .eq('id', sessionId)
    .is('recording_path', null);

  if (stampError) {
    console.error('[recording-upload-url] stamp failed', stampError.message);
    return NextResponse.json({ error: 'Failed to record path' }, { status: 500 });
  }

  return NextResponse.json({ status: 'saved', path, bytes: size || null });
}
