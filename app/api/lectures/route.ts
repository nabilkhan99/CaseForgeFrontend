import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase/admin';
import { getServerEntitlement } from '@/lib/commerce/serverEntitlement';
import type { EntitlementState } from '@/lib/commerce/entitlements';
import { MAX_LECTURE_ROWS } from '@/lib/lectures/limits';

/**
 * The lecture list for the dashboard.
 *
 * Lectures are a Complete-tier extra, so this answers 200 either way rather
 * than 403: a Self-Study user should see that the course exists and what is in
 * it — that is the upgrade prompt — they just get titles and nothing else.
 * Never returns a URL or a storage path in either shape; playback is minted
 * per-lecture by /api/lectures/[id]/play after the same check.
 *
 * Unlocked is `!failedOpen && allowed && (hasLectures || bypass)`: the same
 * gate the middleware applies to practising, plus the Complete-only extra, with
 * the staged-deployment / ADMIN_EMAILS bypass that getServerEntitlement already
 * decides so testers and founders are never locked out of their own content.
 *
 * ⚠️ Lectures fail CLOSED where practice fails open. getServerEntitlement()
 * grants access when the purchase lookup breaks, because locking paying users
 * out of a consultation over a DB blip is worse than letting one through — a
 * consultation is transient. A lecture is not: the signed URL outlives the
 * incident and the file can be kept. So `failedOpen` denies here, and the
 * caller is told the difference (`unavailable`) so it can say "try again"
 * rather than "upgrade".
 */

export interface LectureSummary {
  id: string;
  title: string;
  /** Null when locked — the tease is the running order and the titles. */
  description: string | null;
  sortOrder: number;
  durationSeconds: number | null;
}

export interface LecturesResponse {
  locked: boolean;
  /** Why it is locked, so the banner can offer renew rather than upgrade. */
  state: EntitlementState;
  /** Locked because the entitlement lookup broke, not because of the tier. */
  unavailable: boolean;
  lectures: LectureSummary[];
}

interface LectureRow {
  id: string;
  title: string;
  description: string | null;
  sort_order: number;
  duration_seconds: number | null;
}

export async function GET() {
  const { user, entitlement, bypass, allowed, failedOpen } = await getServerEntitlement();

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const unlocked = !failedOpen && allowed && (entitlement.hasLectures || bypass);

  const { data, error } = await getSupabaseAdmin()
    .from('lectures')
    .select('id, title, description, sort_order, duration_seconds')
    .eq('is_published', true)
    .order('sort_order', { ascending: true })
    .limit(MAX_LECTURE_ROWS);

  if (error) {
    console.error('[lectures] list query failed', error.message);
    return NextResponse.json({ error: 'Failed to load lectures' }, { status: 500 });
  }

  const rows = (data ?? []) as LectureRow[];
  const body: LecturesResponse = {
    locked: !unlocked,
    state: entitlement.state,
    unavailable: failedOpen,
    lectures: rows.map((row) => ({
      id: row.id,
      title: row.title,
      description: unlocked ? row.description : null,
      sortOrder: row.sort_order,
      // Durations stay visible when locked: titles don't convey how much
      // teaching Complete adds, minutes do, and they leak nothing.
      durationSeconds: row.duration_seconds,
    })),
  };

  return NextResponse.json(body);
}
