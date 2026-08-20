import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase/admin';
import { isAdmin } from '@/lib/admin/guard';
import {
  ALLOWED_LECTURE_EXTENSIONS,
  LECTURES_BUCKET,
  LECTURES_FOLDER,
  lectureStoragePath,
  normalizeLectureExtension,
} from '@/lib/lectures/media';
import { MAX_DURATION_SECONDS, MIN_OBJECT_BYTES } from '@/lib/lectures/limits';

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
 * Three phases, the first two the same pattern as that route:
 *   POST   — mint a signed upload URL. The lecture must exist and have no video.
 *   PUT    — after the upload, verify the object really landed and is plausibly
 *            a video, then stamp lectures.storage_path (and the duration the
 *            browser measured). Stamping only ever happens from a confirmed
 *            object, so a row can never point at nothing.
 *   DELETE — detach the video: unpublish, remove every object under this
 *            lecture's id, then null the pointer. This is both "replace a
 *            wrong upload" and the only recovery from a PUT that landed but
 *            whose confirm never did — createSignedUploadUrl defaults to
 *            upsert:false, so that key is un-remintable until it is cleared.
 *
 * The object key is always rebuilt here from the lecture id; a client-supplied
 * path is only ever compared against it, never used.
 */

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Distinguishes "not supplied" (null, fine) from "supplied and nonsense". */
const INVALID_DURATION = Symbol('invalid-duration');

/**
 * A whole number of seconds inside a plausible lecture length, or null when the
 * client did not send one. Anything else is a caller error.
 */
function normalizeDuration(raw: unknown): number | null | typeof INVALID_DURATION {
  if (raw === undefined || raw === null) return null;
  if (typeof raw !== 'number' || !Number.isFinite(raw)) return INVALID_DURATION;
  const seconds = Math.round(raw);
  if (seconds < 1 || seconds > MAX_DURATION_SECONDS) return INVALID_DURATION;
  return seconds;
}

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

  let body: { lectureId?: unknown; path?: unknown; durationSeconds?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Expected JSON' }, { status: 400 });
  }

  const lectureId = String(body.lectureId ?? '');
  if (!UUID_RE.test(lectureId)) {
    return NextResponse.json({ error: 'Invalid lectureId' }, { status: 400 });
  }

  // The browser measures the duration off the file it just uploaded; nothing
  // server-side ever demuxes a video, so this is the only source for it. It is
  // cosmetic (a "32 min" chip), which is why an unreadable one is dropped
  // rather than failing the upload — but a nonsense one is refused outright so
  // a bad metadata read cannot land in the column.
  const durationSeconds = normalizeDuration(body.durationSeconds);
  if (durationSeconds === INVALID_DURATION) {
    return NextResponse.json({ error: 'durationSeconds out of range' }, { status: 400 });
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
  // No `size &&` guard: a zero byte object, or one whose metadata never
  // populated, is exactly the aborted upload this floor exists to catch, so
  // absent metadata has to read as failure rather than as a pass.
  const size = Number((object.metadata as { size?: number } | null)?.size ?? 0);
  if (size < MIN_OBJECT_BYTES) {
    return NextResponse.json({ error: 'Video too small — upload looks incomplete' }, { status: 400 });
  }

  // `.is('storage_path', null)` makes the stamp single-shot; `.select('id')`
  // makes that visible. Two tabs can both mint (POST refuses only once a path
  // is stamped, which is after neither has confirmed), so the loser has to be
  // told its file is orphaned instead of being shown "saved".
  const { data: stamped, error: stampError } = await admin
    .from('lectures')
    .update({
      storage_path: path,
      ...(durationSeconds !== null ? { duration_seconds: durationSeconds } : {}),
      updated_at: new Date().toISOString(),
    })
    .eq('id', lectureId)
    .is('storage_path', null)
    .select('id');

  if (stampError) {
    console.error('[lecture-upload-url] stamp failed', stampError.message);
    return NextResponse.json({ error: 'Failed to record path' }, { status: 500 });
  }
  if (!stamped || stamped.length === 0) {
    return NextResponse.json(
      { error: 'Another upload already claimed this lecture' },
      { status: 409 },
    );
  }

  return NextResponse.json({ status: 'saved', path, bytes: size, durationSeconds });
}

/**
 * Phase 3 — detach the video so a new one can be uploaded.
 *
 * Order matters: unpublish BEFORE the object goes, so a published lecture never
 * spends a moment pointing at a file that is not there. Then remove every
 * candidate key for this lecture rather than just the stamped one — the case
 * this has to recover is precisely the one where the row was never stamped but
 * an object exists, and the extension is only knowable from the bucket.
 */
export async function DELETE(req: NextRequest) {
  if (!(await isAdmin())) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  let body: { lectureId?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Expected JSON' }, { status: 400 });
  }

  const lectureId = String(body.lectureId ?? '');
  if (!UUID_RE.test(lectureId)) {
    return NextResponse.json({ error: 'Invalid lectureId' }, { status: 400 });
  }

  const admin = getSupabaseAdmin();
  const { data: lecture, error: lookupError } = await admin
    .from('lectures')
    .select('id')
    .eq('id', lectureId)
    .maybeSingle();

  if (lookupError) {
    console.error('[lecture-upload-url] lookup failed', lookupError.message);
    return NextResponse.json({ error: 'Lookup failed' }, { status: 500 });
  }
  if (!lecture) {
    return NextResponse.json({ error: 'Lecture not found' }, { status: 404 });
  }

  const { error: unpublishError } = await admin
    .from('lectures')
    .update({ is_published: false, updated_at: new Date().toISOString() })
    .eq('id', lectureId);

  if (unpublishError) {
    console.error('[lecture-upload-url] unpublish failed', unpublishError.message);
    return NextResponse.json({ error: 'Could not unpublish the lecture' }, { status: 500 });
  }

  const { error: removeError } = await admin.storage
    .from(LECTURES_BUCKET)
    .remove(ALLOWED_LECTURE_EXTENSIONS.map((ext) => lectureStoragePath(lectureId, ext)));

  if (removeError) {
    console.error('[lecture-upload-url] remove failed', removeError.message);
    return NextResponse.json({ error: 'Could not delete the video' }, { status: 500 });
  }

  const { error: clearError } = await admin
    .from('lectures')
    .update({
      storage_path: null,
      duration_seconds: null,
      updated_at: new Date().toISOString(),
    })
    .eq('id', lectureId);

  if (clearError) {
    // The object is gone but the pointer survived: the row now claims a video
    // that does not exist. It is unpublished, so nobody can reach it, and a
    // retry clears it — but it must not read as success.
    console.error('[lecture-upload-url] clear failed', clearError.message);
    return NextResponse.json({ error: 'Failed to clear the video' }, { status: 500 });
  }

  return NextResponse.json({ status: 'cleared' });
}
