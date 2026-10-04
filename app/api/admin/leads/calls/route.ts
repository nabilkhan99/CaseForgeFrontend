import { NextResponse, type NextRequest } from 'next/server'
import { getAdminEmail } from '@/lib/admin/guard'
import { getSupabaseAdmin } from '@/lib/supabase/admin'
import type { LeadView } from '@/lib/leads/assemble'
import { manualDraft, parseClientDraft } from '@/lib/leads/callNotesParse'
import { asObject, parseDueAt, parseEmail, parseLabel, parseNotes } from '@/lib/leads/requestParsing'
import { findLead, saveCall, type ManualNext } from '@/lib/leads/service'
import type { CallDraft, CallOutcome } from '@/lib/leads/types'

export const dynamic = 'force-dynamic'

export interface AdminLeadCallResponse {
  lead: LeadView
}

/** The one-tap outcomes: nothing to write, so no notes and no AI. */
const QUICK_OUTCOMES: ReadonlySet<CallOutcome> = new Set(['no_answer', 'voicemail', 'wrong_number'])

type Body =
  | { ok: true; draft: CallDraft; source: 'prompt' | 'quick'; notes: string | null; next: ManualNext | null; email: string }
  | { ok: false; error: string }

function parseBody(raw: unknown, now: Date): Body {
  const body = asObject(raw)
  const email = parseEmail(body?.email)
  if (!email.ok) return email

  const quick = typeof body?.quick === 'string' ? (body.quick as CallOutcome) : null
  if (quick !== null && !QUICK_OUTCOMES.has(quick)) return { ok: false, error: 'Unknown quick outcome.' }

  const notes = parseNotes(body?.notes, false)
  if (!notes.ok) return notes

  let next: ManualNext | null = null
  const rawNext = asObject(body?.next)
  if (rawNext) {
    const label = parseLabel(rawNext.label)
    const dueAt = parseDueAt(rawNext.dueAt)
    if (!label.ok) return label
    if (!dueAt.ok) return dueAt
    next = { label: label.value, dueAt: dueAt.value }
  }

  if (quick) return { ok: true, email: email.value, draft: manualDraft('', quick), source: 'quick', notes: null, next }
  const draft = parseClientDraft(body?.draft, now)
  if (!draft) return { ok: false, error: 'Pick what happened on the call.' }
  return { ok: true, email: email.value, draft, source: 'prompt', notes: notes.value, next }
}

/**
 * POST /api/admin/leads/calls — log one call against a lead.
 *   { email, quick: 'no_answer' }                     one tap, no notes
 *   { email, notes, draft, next? }                     a reviewed draft, optionally with the next action set by hand
 * Returns the lead as it now stands, next action included.
 */
export async function POST(request: NextRequest) {
  const adminEmail = await getAdminEmail()
  if (!adminEmail) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const now = new Date()
  const body = parseBody(await request.json().catch(() => null), now)
  if (!body.ok) return NextResponse.json({ error: body.error }, { status: 400 })

  try {
    const supabase = getSupabaseAdmin()
    const lookup = await findLead(supabase, now, body.email)
    if (!lookup) return NextResponse.json({ error: 'No lead with that email.' }, { status: 404 })
    const lead = await saveCall(supabase, {
      lookup,
      draft: body.draft,
      rawNotes: body.notes,
      source: body.source,
      manualNext: body.next,
      loggedBy: adminEmail,
      now,
    })
    const response: AdminLeadCallResponse = { lead }
    return NextResponse.json(response)
  } catch (error: unknown) {
    console.error('[admin-leads] save call failed', error)
    return NextResponse.json({ error: 'Could not save the call. Refresh and check before trying again.' }, { status: 500 })
  }
}
