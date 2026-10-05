import { NextResponse, type NextRequest } from 'next/server'
import { isAdmin } from '@/lib/admin/guard'
import { getSupabaseAdmin } from '@/lib/supabase/admin'
import { UUID_RE, loadDraftReview } from '../caseReviewData'

export const dynamic = 'force-dynamic'

/**
 * GET /api/admin/case-review/{id} — one draft in full (brief, script, mark
 * scheme, learning points, SEO line, checklist counts) next to the old case it
 * replaces. 404 for anything that is not a draft. Admin only.
 */
export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!(await isAdmin())) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { id } = await params
  if (!UUID_RE.test(id)) {
    return NextResponse.json({ error: 'That is not a case id.' }, { status: 400 })
  }

  try {
    const review = await loadDraftReview(getSupabaseAdmin(), id)
    if (!review) return NextResponse.json({ error: 'No draft case with that id.' }, { status: 404 })
    return NextResponse.json(review)
  } catch (error: unknown) {
    console.error('[admin-case-review] detail failed', error)
    return NextResponse.json({ error: 'Could not load this case.' }, { status: 500 })
  }
}
