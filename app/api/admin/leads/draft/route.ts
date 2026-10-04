import { NextResponse, type NextRequest } from 'next/server'
import { isAdmin } from '@/lib/admin/guard'
import { getSupabaseAdmin } from '@/lib/supabase/admin'
import { CallNotesUnavailableError, chatConfigFromEnv, draftCallNotes } from '@/lib/leads/callNotes'
import { asObject, parseEmail, parseNotes } from '@/lib/leads/requestParsing'
import { findLead, promptContext } from '@/lib/leads/service'
import type { CallDraft } from '@/lib/leads/types'

export const dynamic = 'force-dynamic'
export const maxDuration = 30

export interface AdminLeadDraftResponse {
  draft: CallDraft
}

/**
 * POST /api/admin/leads/draft { email, notes } — the AI's tidy of one call's
 * notes, for the caller to review. Writes nothing.
 */
export async function POST(request: NextRequest) {
  if (!(await isAdmin())) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const body = asObject(await request.json().catch(() => null))
  const email = parseEmail(body?.email)
  const notes = parseNotes(body?.notes, true)
  if (!email.ok) return NextResponse.json({ error: email.error }, { status: 400 })
  if (!notes.ok) return NextResponse.json({ error: notes.error }, { status: 400 })

  const config = chatConfigFromEnv()
  if (!config) {
    return NextResponse.json({ error: 'The AI tidy is not set up here. Pick the outcome and save the notes as written.' }, { status: 503 })
  }

  try {
    const now = new Date()
    const lookup = await findLead(getSupabaseAdmin(), now, email.value)
    if (!lookup) return NextResponse.json({ error: 'No lead with that email.' }, { status: 404 })
    const draft = await draftCallNotes({ notes: notes.value as string, lead: promptContext(lookup.lead), now }, config)
    const response: AdminLeadDraftResponse = { draft }
    return NextResponse.json(response, { headers: { 'Cache-Control': 'no-store' } })
  } catch (error: unknown) {
    if (error instanceof CallNotesUnavailableError) {
      return NextResponse.json({ error: error.message }, { status: 502 })
    }
    console.error('[admin-leads] draft failed', error)
    return NextResponse.json({ error: 'Could not tidy those notes.' }, { status: 500 })
  }
}
