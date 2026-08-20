import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase/admin';
import { getServerEntitlement } from '@/lib/commerce/serverEntitlement';
import { LECTURES_BUCKET } from '@/lib/lectures/media';

/**
 * Mint a short-lived signed URL for one lecture video. The `lectures` bucket is
 * private, so playback always goes through here.
 *
 * Same gate as the list endpoint — Complete tier, active access, or the
 * staged/admin bypass — but the failure mode is different: 404, never 403, and
 * never a distinction between "no such lecture", "not published" and "not your
 * tier". A 403 here would confirm to any signed-in account exactly which
 * lecture ids exist, which is the shape of the paid course.
 *
 * Mirrors app/api/clinical-master/recording/[sessionId] deliberately: same
 * uuid guard, same fail-closed auth handling, same TTL.
 */

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const SIGNED_URL_TTL_SECONDS = 60 * 60;

const NOT_FOUND = { error: 'No such lecture' };

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  if (!UUID_RE.test(id)) {
    return NextResponse.json({ error: 'Invalid lecture id' }, { status: 400 });
  }

  let unlocked = false;
  try {
    const { user, entitlement, bypass, allowed } = await getServerEntitlement();
    unlocked = Boolean(user) && allowed && (entitlement.hasLectures || bypass);
  } catch (authError: unknown) {
    // Fail closed — an unreadable session is not an entitled one.
    console.error('[lecture-play] entitlement check failed', authError);
    return NextResponse.json(NOT_FOUND, { status: 404 });
  }

  if (!unlocked) {
    return NextResponse.json(NOT_FOUND, { status: 404 });
  }

  const admin = getSupabaseAdmin();
  const { data: lecture, error } = await admin
    .from('lectures')
    .select('id, storage_path, is_published')
    .eq('id', id)
    .maybeSingle();

  if (error) {
    console.error('[lecture-play] lookup failed', error.message);
    return NextResponse.json({ error: 'Lookup failed' }, { status: 500 });
  }
  if (!lecture?.is_published || !lecture.storage_path) {
    return NextResponse.json(NOT_FOUND, { status: 404 });
  }

  const { data: signed, error: signError } = await admin.storage
    .from(LECTURES_BUCKET)
    .createSignedUrl(lecture.storage_path, SIGNED_URL_TTL_SECONDS);

  if (signError || !signed?.signedUrl) {
    console.error('[lecture-play] signing failed', signError?.message);
    return NextResponse.json({ error: 'Could not prepare playback' }, { status: 500 });
  }

  return NextResponse.json({ url: signed.signedUrl, expiresIn: SIGNED_URL_TTL_SECONDS });
}
