import { NextResponse, type NextRequest } from 'next/server'
import { getAdminEmail } from '@/lib/admin/guard'
import { getSupabaseAdmin } from '@/lib/supabase/admin'
import type { LeadView } from '@/lib/leads/assemble'
import { asObject, parseDueAt, parseEmail, parseLabel } from '@/lib/leads/requestParsing'
import { findLead, saveFollowup } from '@/lib/leads/service'

export const dynamic = 'force-dynamic'

export interface AdminLeadFollowupResponse {
  lead: LeadView
}

/**
 * PATCH /api/admin/leads/followup — set a lead's next action by hand.
 *   { email, status: 'open', label, dueAt }        a new task or date (dueAt may be null)
 *   { email, status: 'closed', closedReason? }     stop following up
 */
export async function PATCH(request: NextRequest) {
  const adminEmail = await getAdminEmail()
  if (!adminEmail) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const body = asObject(await request.json().catch(() => null))
  const email = parseEmail(body?.email)
  if (!email.ok) return NextResponse.json({ error: email.error }, { status: 400 })
  const status = body?.status
  if (status !== 'open' && status !== 'closed') {
    return NextResponse.json({ error: 'Say whether the lead is open or closed.' }, { status: 400 })
  }

  let label = ''
  let dueAt: string | null = null
  if (status === 'open') {
    const parsedLabel = parseLabel(body?.label)
    const parsedDue = parseDueAt(body?.dueAt)
    if (!parsedLabel.ok) return NextResponse.json({ error: parsedLabel.error }, { status: 400 })
    if (!parsedDue.ok) return NextResponse.json({ error: parsedDue.error }, { status: 400 })
    label = parsedLabel.value
    dueAt = parsedDue.value
  }
  const closedReason = status === 'closed' && typeof body?.closedReason === 'string' && body.closedReason.trim()
    ? body.closedReason.trim().slice(0, 80)
    : null

  try {
    const now = new Date()
    const supabase = getSupabaseAdmin()
    const lookup = await findLead(supabase, now, email.value)
    if (!lookup) return NextResponse.json({ error: 'No lead with that email.' }, { status: 404 })
    const lead = await saveFollowup(supabase, { lookup, label, dueAt, status, closedReason, updatedBy: adminEmail, now })
    const response: AdminLeadFollowupResponse = { lead }
    return NextResponse.json(response)
  } catch (error: unknown) {
    console.error('[admin-leads] save next action failed', error)
    return NextResponse.json({ error: 'Could not save the next action.' }, { status: 500 })
  }
}
