import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase/admin';
import { createClient } from '@/lib/supabase/server';
import { parseAdminEmails } from '@/lib/admin/guard';
import { getTrainerCohort } from '@/lib/trainer/guard';

/**
 * Mint a short-lived signed URL for a consultation recording. The
 * `consultation-recordings` bucket is private, so playback always goes
 * through here.
 *
 * Access mirrors who may read the feedback for that session:
 *   - a session with a user_id -> only that user, an ADMIN_EMAILS admin, or
 *     the trainer whose cohort that user is a student in;
 *   - a guest session (user_id null, the /try funnel) -> anyone holding the
 *     session id, exactly as the trial feedback page already works.
 *
 * 404 (not 403) when a signed-in user asks for someone else's session, so the
 * endpoint never confirms that a given session id exists.
 */

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const BUCKET = 'consultation-recordings';
const SIGNED_URL_TTL_SECONDS = 60 * 60;

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ sessionId: string }> }
) {
  const { sessionId } = await params;
  if (!UUID_RE.test(sessionId)) {
    return NextResponse.json({ error: 'Invalid sessionId' }, { status: 400 });
  }

  const admin = getSupabaseAdmin();
  const { data: session, error } = await admin
    .from('clinical_sessions')
    .select('id, user_id, recording_path')
    .eq('id', sessionId)
    .maybeSingle();

  if (error) {
    console.error('[recording] session lookup failed', error.message);
    return NextResponse.json({ error: 'Lookup failed' }, { status: 500 });
  }
  if (!session?.recording_path) {
    return NextResponse.json({ error: 'No recording for this session' }, { status: 404 });
  }

  if (session.user_id) {
    let viewerId: string | null = null;
    let viewerEmail: string | null = null;
    try {
      const supabase = await createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      viewerId = user?.id ?? null;
      viewerEmail = user?.email?.trim().toLowerCase() ?? null;
    } catch (authError: unknown) {
      // Fail closed — an unreadable session is not an authorized one.
      console.error('[recording] auth check failed', authError);
      return NextResponse.json({ error: 'No recording for this session' }, { status: 404 });
    }

    const isOwner = viewerId === session.user_id;
    const isAdminViewer =
      Boolean(viewerEmail) && parseAdminEmails(process.env.ADMIN_EMAILS).has(viewerEmail!);

    // Third branch: a trainer listening to their own student. Checked last
    // because it is the only one that costs a round trip, and fail-closed by
    // construction — `getTrainerCohort` returns null on any error, and the
    // student list it returns has the trainer's own id removed, so this can
    // only ever widen access to accounts that were deliberately put in the
    // cohort.
    let isCohortTrainer = false;
    if (!isOwner && !isAdminViewer) {
      const cohort = await getTrainerCohort();
      isCohortTrainer = Boolean(cohort?.studentIds.includes(session.user_id));
    }

    if (!isOwner && !isAdminViewer && !isCohortTrainer) {
      return NextResponse.json({ error: 'No recording for this session' }, { status: 404 });
    }
  }

  const { data: signed, error: signError } = await admin.storage
    .from(BUCKET)
    .createSignedUrl(session.recording_path, SIGNED_URL_TTL_SECONDS);

  if (signError || !signed?.signedUrl) {
    console.error('[recording] signing failed', signError?.message);
    return NextResponse.json({ error: 'Could not prepare playback' }, { status: 500 });
  }

  return NextResponse.json({ url: signed.signedUrl, expiresIn: SIGNED_URL_TTL_SECONDS });
}
