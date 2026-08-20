import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase/admin';
import { getServerEntitlement } from '@/lib/commerce/serverEntitlement';

/**
 * The lecture list for the dashboard.
 *
 * Lectures are a Complete-tier extra, so this answers 200 either way rather
 * than 403: a Self-Study user should see that the course exists and what is in
 * it — that is the upgrade prompt — they just get titles and nothing else.
 * Never returns a URL or a storage path in either shape; playback is minted
 * per-lecture by /api/lectures/[id]/play after the same check.
 *
 * Unlocked is `allowed && (hasLectures || bypass)`: the same gate the
 * middleware applies to practising, plus the Complete-only extra, with the
 * staged-deployment / ADMIN_EMAILS bypass that getServerEntitlement already
 * decides so testers and founders are never locked out of their own content.
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
  const { user, entitlement, bypass, allowed } = await getServerEntitlement();

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const unlocked = allowed && (entitlement.hasLectures || bypass);

  const { data, error } = await getSupabaseAdmin()
    .from('lectures')
    .select('id, title, description, sort_order, duration_seconds')
    .eq('is_published', true)
    .order('sort_order', { ascending: true });

  if (error) {
    console.error('[lectures] list query failed', error.message);
    return NextResponse.json({ error: 'Failed to load lectures' }, { status: 500 });
  }

  const rows = (data ?? []) as LectureRow[];
  const body: LecturesResponse = {
    locked: !unlocked,
    lectures: rows.map((row) => ({
      id: row.id,
      title: row.title,
      description: unlocked ? row.description : null,
      sortOrder: row.sort_order,
      durationSeconds: unlocked ? row.duration_seconds : null,
    })),
  };

  return NextResponse.json(body);
}
