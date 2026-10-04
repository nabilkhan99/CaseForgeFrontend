import 'server-only'

import type { SupabaseClient } from '@supabase/supabase-js'
import { assembleLeads, standingOf, type CallRow, type FollowupRow, type LeadSources, type LeadView } from './assemble'
import type { CallNotesLeadContext } from './callNotesPrompt'
import { decideNextAction } from './followUp'
import { loadLeadSources } from './load'
import type { CallDraft, CallRecord, NextAction } from './types'

/**
 * What the /api/admin/leads routes do, kept out of the route files so each
 * route is a guard, a parse and one call. Every write recomputes the lead from
 * the rows just written, so the page gets back exactly what a reload would show.
 */

export interface LeadLookup {
  sources: LeadSources
  lead: LeadView
}

/** The lead an email belongs to, as the primary address or a merged second sign-up. */
export async function findLead(supabase: SupabaseClient, now: Date, rawEmail: string): Promise<LeadLookup | null> {
  const email = rawEmail.trim().toLowerCase()
  const sources = await loadLeadSources(supabase, now)
  const lead = assembleLeads(sources).find((l) => l.email === email || l.aliases.includes(email))
  return lead ? { sources, lead } : null
}

function reassemble(lead: LeadView, sources: LeadSources): LeadView {
  const fresh = assembleLeads(sources).find((l) => l.email === lead.email)
  if (!fresh) throw new Error('[admin-leads] lead vanished after a write')
  return fresh
}

/** What the AI is told about the lead. No email or phone number: it does not need them. */
export function promptContext(lead: LeadView): CallNotesLeadContext {
  return {
    name: lead.nameKnown ? lead.name : null,
    examOnFile: lead.exam.cls === 'unknown' ? null : lead.exam.label.replace(/ · \d+d$/, ''),
    trial: lead.trial ? { endsAt: new Date(lead.trial.endsAt) } : null,
    consultations: lead.consultations,
    passes: lead.passes,
    earlierCalls: lead.calls.map((call) => ({
      at: new Date(call.at),
      outcome: call.outcome,
      summary: call.points.length ? call.points.map((p) => (p.label ? `${p.label}: ${p.text}` : p.text)).join(' ') : null,
    })),
  }
}

export interface ManualNext {
  label: string
  dueAt: string | null
}

export interface SaveCallInput {
  lookup: LeadLookup
  draft: CallDraft
  rawNotes: string | null
  source: 'prompt' | 'quick'
  /** The caller chose the next action themselves. */
  manualNext: ManualNext | null
  loggedBy: string
  now: Date
}

function manualAction(next: ManualNext): NextAction {
  return { label: next.label, kind: 'call', dueAt: next.dueAt, source: 'manual', status: 'open', closedReason: null, why: 'Set by hand' }
}

/** Log one call, decide the next action, and return the lead as it now stands. */
export async function saveCall(supabase: SupabaseClient, input: SaveCallInput): Promise<LeadView> {
  const { lookup, draft, now, loggedBy } = input
  const { lead, sources } = lookup
  const at = now.toISOString()
  const records: CallRecord[] = [...lead.calls.map((c) => ({ outcome: c.outcome, at: c.at })), { outcome: draft.outcome, at }]
  const next = input.manualNext
    ? manualAction(input.manualNext)
    : decideNextAction({ now, standing: standingOf(lead), calls: records, suggested: draft.suggestedNext })

  const callRow: Omit<CallRow, 'id' | 'created_at'> & { created_at: string } = {
    lead_email: lead.email,
    logged_by: loggedBy,
    created_at: at,
    source: input.source,
    outcome: draft.outcome,
    raw_notes: input.rawNotes,
    points: draft.points,
    facts: draft.facts,
    next_label: next.label,
    next_kind: next.kind,
    next_due: next.dueAt,
    next_source: next.source,
    model: draft.model,
  }
  const { data: inserted, error: callError } = await supabase.from('lead_calls').insert(callRow).select('*').single()
  if (callError || !inserted) throw new Error(`[admin-leads] could not save the call: ${callError?.message ?? 'no row'}`)

  const previous = sources.followups.find((f) => f.lead_email === lead.email)
  const exam = draft.facts.exam
  const followup: FollowupRow = {
    lead_email: lead.email,
    label: next.label,
    kind: next.kind,
    due_at: next.dueAt,
    source: next.source,
    status: next.status,
    closed_reason: next.closedReason,
    why: next.why,
    // A name learned on the call only fills a gap; it never renames someone.
    display_name: previous?.display_name ?? (!lead.nameKnown ? draft.facts.firstName : null),
    exam_note: exam ? exam.text : previous?.exam_note ?? null,
    exam_date: exam ? exam.date : previous?.exam_date ?? null,
    exam_month: exam ? exam.month ?? exam.date?.slice(0, 7) ?? null : previous?.exam_month ?? null,
    updated_at: at,
    updated_by: loggedBy,
  }
  const { error: followupError } = await supabase.from('lead_followups').upsert(followup, { onConflict: 'lead_email' })
  if (followupError) throw new Error(`[admin-leads] call saved but the next action was not: ${followupError.message}`)

  return reassemble(lead, {
    ...sources,
    calls: [...sources.calls, inserted as CallRow],
    followups: [...sources.followups.filter((f) => f.lead_email !== lead.email), followup],
  })
}

export interface SaveFollowupInput {
  lookup: LeadLookup
  label: string
  dueAt: string | null
  status: 'open' | 'closed'
  closedReason: string | null
  updatedBy: string
  now: Date
}

/** Change the next action by hand: a new date, a new task, or closing the lead. */
export async function saveFollowup(supabase: SupabaseClient, input: SaveFollowupInput): Promise<LeadView> {
  const { lead, sources } = input.lookup
  const previous = sources.followups.find((f) => f.lead_email === lead.email)
  const closed = input.status === 'closed'
  const followup: FollowupRow = {
    lead_email: lead.email,
    label: closed ? input.closedReason ?? 'Closed' : input.label,
    kind: closed ? 'none' : 'call',
    due_at: closed ? null : input.dueAt,
    source: 'manual',
    status: input.status,
    closed_reason: closed ? input.closedReason ?? 'Closed' : null,
    why: 'Set by hand',
    display_name: previous?.display_name ?? null,
    exam_note: previous?.exam_note ?? null,
    exam_date: previous?.exam_date ?? null,
    exam_month: previous?.exam_month ?? null,
    updated_at: input.now.toISOString(),
    updated_by: input.updatedBy,
  }
  const { error } = await supabase.from('lead_followups').upsert(followup, { onConflict: 'lead_email' })
  if (error) throw new Error(`[admin-leads] could not save the next action: ${error.message}`)
  return reassemble(lead, {
    ...sources,
    followups: [...sources.followups.filter((f) => f.lead_email !== lead.email), followup],
  })
}
