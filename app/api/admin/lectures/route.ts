import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase/admin';
import { isAdmin } from '@/lib/admin/guard';

/**
 * Content ops for lectures: list, create, publish. ADMIN_EMAILS-guarded
 * (fail-closed) exactly like /api/admin/recordings — the check runs before any
 * data access and answers 403 JSON.
 *
 * Creating a row is deliberately separate from uploading the video: the row's
 * id IS the object key (see lib/lectures/media), so it has to exist before a
 * signed upload URL can be minted for it. A lecture therefore lives briefly as
 * a titled placeholder with no video, which is why the list reports
 * `hasVideo` and why is_published starts false.
 */

const MAX_TITLE_LENGTH = 200;
const MAX_ROWS = 200;

export interface AdminLecture {
  id: string;
  title: string;
  description: string | null;
  sortOrder: number;
  durationSeconds: number | null;
  isPublished: boolean;
  hasVideo: boolean;
  createdAt: string;
}

interface AdminLectureRow {
  id: string;
  title: string;
  description: string | null;
  sort_order: number;
  duration_seconds: number | null;
  is_published: boolean;
  storage_path: string | null;
  created_at: string;
}

function toAdminLecture(row: AdminLectureRow): AdminLecture {
  return {
    id: row.id,
    title: row.title,
    description: row.description,
    sortOrder: row.sort_order,
    durationSeconds: row.duration_seconds,
    isPublished: row.is_published,
    hasVideo: Boolean(row.storage_path),
    createdAt: row.created_at,
  };
}

const SELECT =
  'id, title, description, sort_order, duration_seconds, is_published, storage_path, created_at';

/** Every lecture, published or not, in running order. */
export async function GET() {
  if (!(await isAdmin())) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const { data, error } = await getSupabaseAdmin()
    .from('lectures')
    .select(SELECT)
    .order('sort_order', { ascending: true })
    .limit(MAX_ROWS);

  if (error) {
    console.error('[admin-lectures] list failed', error.message);
    return NextResponse.json({ error: 'Failed to load lectures' }, { status: 500 });
  }

  return NextResponse.json({
    lectures: ((data ?? []) as AdminLectureRow[]).map(toAdminLecture),
  });
}

/** Create a placeholder row so a video has somewhere to be uploaded to. */
export async function POST(req: NextRequest) {
  if (!(await isAdmin())) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  let body: { title?: unknown; description?: unknown; sortOrder?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Expected JSON' }, { status: 400 });
  }

  const title = typeof body.title === 'string' ? body.title.trim() : '';
  if (!title || title.length > MAX_TITLE_LENGTH) {
    return NextResponse.json({ error: 'A title is required' }, { status: 400 });
  }

  const description =
    typeof body.description === 'string' && body.description.trim()
      ? body.description.trim()
      : null;

  const sortOrder = Number(body.sortOrder ?? 0);
  if (!Number.isFinite(sortOrder) || !Number.isInteger(sortOrder)) {
    return NextResponse.json({ error: 'sortOrder must be a whole number' }, { status: 400 });
  }

  const { data, error } = await getSupabaseAdmin()
    .from('lectures')
    .insert({ title, description, sort_order: sortOrder })
    .select(SELECT)
    .single();

  if (error || !data) {
    console.error('[admin-lectures] create failed', error?.message);
    return NextResponse.json({ error: 'Failed to create lecture' }, { status: 500 });
  }

  return NextResponse.json({ lecture: toAdminLecture(data as AdminLectureRow) }, { status: 201 });
}

/** Toggle publication. Publishing without a video would list a dead row. */
export async function PATCH(req: NextRequest) {
  if (!(await isAdmin())) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  let body: { id?: unknown; isPublished?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Expected JSON' }, { status: 400 });
  }

  const id = typeof body.id === 'string' ? body.id : '';
  if (!id) {
    return NextResponse.json({ error: 'Invalid id' }, { status: 400 });
  }
  if (typeof body.isPublished !== 'boolean') {
    return NextResponse.json({ error: 'isPublished must be a boolean' }, { status: 400 });
  }
  const isPublished = body.isPublished;

  const admin = getSupabaseAdmin();
  const { data: existing, error: lookupError } = await admin
    .from('lectures')
    .select('id, storage_path')
    .eq('id', id)
    .maybeSingle();

  if (lookupError) {
    console.error('[admin-lectures] lookup failed', lookupError.message);
    return NextResponse.json({ error: 'Lookup failed' }, { status: 500 });
  }
  if (!existing) {
    return NextResponse.json({ error: 'Lecture not found' }, { status: 404 });
  }
  if (isPublished && !existing.storage_path) {
    return NextResponse.json({ error: 'Upload a video before publishing' }, { status: 409 });
  }

  const { data, error } = await admin
    .from('lectures')
    .update({ is_published: isPublished, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select(SELECT)
    .single();

  if (error || !data) {
    console.error('[admin-lectures] publish toggle failed', error?.message);
    return NextResponse.json({ error: 'Failed to update lecture' }, { status: 500 });
  }

  return NextResponse.json({ lecture: toAdminLecture(data as AdminLectureRow) });
}
