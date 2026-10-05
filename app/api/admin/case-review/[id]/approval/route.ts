import { NextResponse, type NextRequest } from 'next/server'
import { getAdminEmail } from '@/lib/admin/guard'
import { getSupabaseAdmin } from '@/lib/supabase/admin'
import type { ApprovalAction } from '@/components/admin/case-review/types'
import { UUID_RE, setApproval } from '../../caseReviewData'

export const dynamic = 'force-dynamic'

const ACTIONS: readonly ApprovalAction[] = ['approve', 'withdraw']

function isApprovalAction(value: unknown): value is ApprovalAction {
  return typeof value === 'string' && (ACTIONS as readonly string[]).includes(value)
}

/**
 * POST /api/admin/case-review/{id}/approval
 *   { action: 'approve' }   approved_at = now, approved_by = the admin's email
 *   { action: 'withdraw' }  both back to null
 *
 * Draft rows only: anything else is refused with 409, and nothing else on the
 * row is written. In particular this never switches a case on: lifecycle and
 * is_active are untouched (see caseReviewData.ts).
 */
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const adminEmail = await getAdminEmail()
  if (!adminEmail) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { id } = await params
  if (!UUID_RE.test(id)) {
    return NextResponse.json({ error: 'That is not a case id.' }, { status: 400 })
  }

  const body: unknown = await request.json().catch(() => null)
  const action = body && typeof body === 'object' ? (body as { action?: unknown }).action : undefined
  if (!isApprovalAction(action)) {
    return NextResponse.json({ error: "Say 'approve' or 'withdraw'." }, { status: 400 })
  }

  try {
    const result = await setApproval(getSupabaseAdmin(), id, action, adminEmail, new Date())
    if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.status })
    return NextResponse.json(result.approval)
  } catch (error: unknown) {
    console.error('[admin-case-review] approval failed', error)
    return NextResponse.json({ error: 'Could not save the sign-off.' }, { status: 500 })
  }
}
