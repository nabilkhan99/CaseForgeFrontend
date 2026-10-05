import { NextResponse } from 'next/server'
import { isAdmin } from '@/lib/admin/guard'
import { getSupabaseAdmin } from '@/lib/supabase/admin'
import type { CaseReviewListResponse } from '@/components/admin/case-review/types'
import { listDrafts } from './caseReviewData'

export const dynamic = 'force-dynamic'

/**
 * GET /api/admin/case-review — every draft case (lifecycle = 'draft'), newest
 * first, with the old case each replaces and its keeper count. Guarded
 * (fail-closed) by ADMIN_EMAILS before any data access; drafts are readable
 * only with the service role.
 */
export async function GET() {
  if (!(await isAdmin())) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  try {
    const drafts = await listDrafts(getSupabaseAdmin())
    const response: CaseReviewListResponse = { drafts }
    return NextResponse.json(response)
  } catch (error: unknown) {
    console.error('[admin-case-review] list failed', error)
    return NextResponse.json({ error: 'Could not load the draft cases.' }, { status: 500 })
  }
}
