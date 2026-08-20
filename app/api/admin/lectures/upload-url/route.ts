import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase/admin';
import { isAdmin } from '@/lib/admin/guard';
import {
  LECTURES_BUCKET,
  LECTURES_FOLDER,
  lectureStoragePath,
  normalizeLectureExtension,
} from '@/lib/lectures/media';

/**
 * Signed-URL upload for a lecture video. ADMIN_EMAILS-guarded, fail-closed:
 * the check runs before any lookup, so a non-admin cannot even probe whether a
 * lecture id exists.
 *
 * ⚠️ The file must go browser → Storage. A Vercel function caps its request
 * body at ~4.5MB, which a lecture video clears by two orders of magnitude, so
 * there is deliberately no multipart route for video anywhere in this app —
 * the same lesson that cost us full-length consultation recordings (see
 * app/api/clinical-master/recording-upload-url).
 *
 * Two phases, same pattern as that route:
 *   POST — mint a signed upload URL. The lecture must exist and have no video.
 *   PUT  — after the upload, verify the object really landed and is plausibly a
 *          video, then stamp lectures.storage_path. Stamping only ever happens
 *          from a confirmed object, so a row can never point at nothing.
 *
 * The object key is always rebuilt here from the lecture id; a client-supplied
 * path is only ever compared against it, never used.
 */

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
/** A lecture is a talk, not a clip: anything under this is a failed upload. */
const MIN_OBJECT_BYTES = 1024 * 1024;

/** Phase 1 — mint a signed upload URL for this lecture's video. */
export async function POST(req: NextRequest) {
  if (!(await isAdmin())) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  let body: { lectureId?: unknown; extension?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Expected JSON' }, { status: 400 });
  }

  const lectureId = String(body.lectureId ?? '');
  if (!UUID_RE.test(lectureId)) {
    return NextResponse.json({ error: 'Invalid lectureId' }, { status: 400 });
  }
  const extension = normalizeLectureExtension(body.extension);
  if (!extension) {
    return NextResponse.json({ error: 'Unsupported video container' }, { status: 415 });
  }

  const admin = getSupabaseAdmin();
  const { data: lecture, error: lookupError } = await admin
    .from('lectures')
    .select('id, storage_path')
    .eq('id', lectureId)
    .maybeSingle();

  if (lookupError) {
    console.error('[lecture-upload-url] lookup failed', lookupError.message);
    return NextResponse.json({ error: 'Lookup failed' }, { status: 500 });
  }
  if (!lecture) {
    return NextResponse.json({ error: 'Lecture not found' }, { status: 404 });
  }
  // Refuse rather than silently overwrite: replacing a published video is a
  // deliberate act, and a signed PUT handed out here would clobber the file
  // students are already watching.
  if (lecture.storage_path) {
    return NextResponse.json({ error: 'Lecture already has a video' }, { status: 409 });
  }

  const path = lectureStoragePath(lectureId, extension);
  const { data, error } = await admin.storage.from(LECTURES_BUCKET).createSignedUploadUrl(path);

  if (error || !data) {
    console.error('[lecture-upload-url] could not sign', error?.message);
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
  if (!(await isAdmin())) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  let body: { lectureId?: unknown; path?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Expected JSON' }, { status: 400 });
  }

  const lectureId = String(body.lectureId ?? '');
  if (!UUID_RE.test(lectureId)) {
    return NextResponse.json({ error: 'Invalid lectureId' }, { status: 400 });
  }

  const claimedPath = String(body.path ?? '');
  const extension = normalizeLectureExtension(claimedPath.split('.').pop());
  const path = extension ? lectureStoragePath(lectureId, extension) : null;
  if (!path || path !== claimedPath) {
    return NextResponse.json({ error: 'Path does not belong to this lecture' }, { status: 400 });
  }

  const admin = getSupabaseAdmin();
  const name = `${lectureId}.${extension}`;

  const { data: listed, error: listError } = await admin.storage
    .from(LECTURES_BUCKET)
    .list(LECTURES_FOLDER, { search: name });

  if (listError) {
    console.error('[lecture-upload-url] list failed', listError.message);
    return NextResponse.json({ error: 'Could not verify upload' }, { status: 500 });
  }
  const object = listed?.find((o) => o.name === name);
  if (!object) {
    return NextResponse.json({ error: 'Upload not found in storage' }, { status: 404 });
  }
  const size = Number((object.metadata as { size?: number } | null)?.size ?? 0);
  if (size && size < MIN_OBJECT_BYTES) {
    return NextResponse.json({ error: 'Video too small — upload looks incomplete' }, { status: 400 });
  }

  const { error: stampError } = await admin
    .from('lectures')
    .update({ storage_path: path, updated_at: new Date().toISOString() })
    .eq('id', lectureId)
    .is('storage_path', null);

  if (stampError) {
    console.error('[lecture-upload-url] stamp failed', stampError.message);
    return NextResponse.json({ error: 'Failed to record path' }, { status: 500 });
  }

  return NextResponse.json({ status: 'saved', path, bytes: size || null });
}
