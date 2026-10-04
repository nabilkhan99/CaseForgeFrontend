'use client'

import { useId, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { standingOf, type LeadView } from '@/lib/leads/assemble'
import { dueLabel, outcomeLabel } from '@/lib/leads/board'
import { manualDraft } from '@/lib/leads/callNotesParse'
import { decideNextAction } from '@/lib/leads/followUp'
import { londonTime, londonToday, londonWallTimeToUtc } from '@/lib/leads/time'
import { CALL_OUTCOMES, type CallDraft, type CallOutcome, type NextAction } from '@/lib/leads/types'
import type { AdminLeadDraftResponse } from '@/app/api/admin/leads/draft/route'
import type { AdminLeadCallResponse } from '@/app/api/admin/leads/calls/route'
import { ACTION, DueText, INPUT, LABEL, Point, QUIET_ACTION } from './ui'

/** Outcomes with nothing to write: one tap logs them. */
const QUICK: readonly CallOutcome[] = ['no_answer', 'voicemail', 'wrong_number']

interface Override {
  label: string
  date: string
  time: string
}

interface CallLoggerProps {
  lead: LeadView
  aiAvailable: boolean
  onSaved: (lead: LeadView, message: string) => void
}

/** What the rules will do with this draft, worked out the same way the server will. */
function previewNext(lead: LeadView, draft: CallDraft): NextAction {
  const now = new Date()
  return decideNextAction({
    now,
    standing: standingOf(lead),
    calls: [...lead.calls.map((c) => ({ outcome: c.outcome, at: c.at })), { outcome: draft.outcome, at: now.toISOString() }],
    suggested: draft.suggestedNext,
  })
}

function savedMessage(lead: LeadView): string {
  const { next } = lead
  if (next.status === 'closed') return `Saved. ${lead.name} is closed: ${next.closedReason ?? next.label}.`
  return `Saved. Next: ${next.label} · ${dueLabel(next.dueAt, new Date()).text}.`
}

async function postJson<T>(url: string, body: unknown): Promise<{ ok: true; data: T } | { ok: false; status: number; error: string }> {
  try {
    const response = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
    const data = await response.json().catch(() => ({}))
    if (!response.ok) return { ok: false, status: response.status, error: (data as { error?: string }).error ?? 'Something went wrong.' }
    return { ok: true, data: data as T }
  } catch {
    return { ok: false, status: 0, error: 'Could not reach the server.' }
  }
}

/**
 * Log one call against one lead. Type or dictate what happened; the AI turns
 * it into points, an outcome and any timing the call set; the caller checks
 * it, can change the next action, and saves. Nothing typed is ever thrown
 * away on an error.
 */
export default function CallLogger({ lead, aiAvailable, onSaved }: CallLoggerProps) {
  const id = useId()
  const [notes, setNotes] = useState('')
  const [draft, setDraft] = useState<CallDraft | null>(null)
  const [override, setOverride] = useState<Override | null>(null)
  const [busy, setBusy] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  function reset() {
    setNotes('')
    setDraft(null)
    setOverride(null)
    setError(null)
  }

  async function tidy() {
    if (!notes.trim()) {
      setError('Write or dictate what happened first.')
      return
    }
    setError(null)
    if (!aiAvailable) {
      setDraft(manualDraft(notes, 'spoke'))
      return
    }
    setBusy('tidy')
    const result = await postJson<AdminLeadDraftResponse>('/api/admin/leads/draft', { email: lead.email, notes })
    setBusy(null)
    if (result.ok) {
      setDraft(result.data.draft)
      return
    }
    // The AI failing must not cost the caller their notes: fall back to saving them as written.
    setError(`${result.error} You can still save the notes as written: pick what happened below.`)
    setDraft(manualDraft(notes, 'spoke'))
  }

  async function save(body: Record<string, unknown>, label: string) {
    setBusy(label)
    setError(null)
    const result = await postJson<AdminLeadCallResponse>('/api/admin/leads/calls', { email: lead.email, ...body })
    setBusy(null)
    if (!result.ok) {
      setError(result.error)
      return
    }
    reset()
    onSaved(result.data.lead, savedMessage(result.data.lead))
  }

  function saveDraft() {
    if (!draft) return
    let next: { label: string; dueAt: string | null } | undefined
    if (override) {
      if (!override.label.trim()) {
        setError('Say what the next action is.')
        return
      }
      next = { label: override.label, dueAt: override.date ? londonWallTimeToUtc(override.date, override.time || '10:00').toISOString() : null }
    }
    void save({ notes, draft, next }, 'save')
  }

  const preview = draft ? previewNext(lead, draft) : null
  const due = preview ? dueLabel(preview.dueAt, new Date()) : null

  return (
    <div>
      <AnimatePresence mode="wait" initial={false}>
        {!draft ? (
          <motion.div key="notes" initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -4 }} transition={{ duration: 0.2 }}>
            <label htmlFor={`${id}-notes`} className={LABEL}>
              What happened on the call
            </label>
            <textarea
              id={`${id}-notes`}
              rows={4}
              className={`${INPUT} resize-y leading-relaxed`}
              value={notes}
              placeholder="Type or dictate it as it comes. Spelling does not matter."
              onChange={(event) => {
                setNotes(event.target.value)
                if (error) setError(null)
              }}
            />
            <p className="mt-1.5 text-[11px] text-muted">On a phone, tap the microphone on the keyboard to dictate.</p>
            <div className="mt-4 flex flex-wrap items-center gap-x-6 gap-y-3 text-sm">
              <button type="button" onClick={tidy} disabled={busy !== null} className={`${ACTION} font-semibold`}>
                {busy === 'tidy' ? 'Tidying…' : aiAvailable ? 'Tidy with AI' : 'Review and save'}
              </button>
              <span className="text-xs text-muted">or log in one tap:</span>
              {QUICK.map((outcome) => (
                <button key={outcome} type="button" disabled={busy !== null} onClick={() => save({ quick: outcome }, outcome)} className={QUIET_ACTION}>
                  {busy === outcome ? 'Saving…' : outcomeLabel(outcome)}
                </button>
              ))}
            </div>
          </motion.div>
        ) : (
          <motion.div key="review" initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -4 }} transition={{ duration: 0.2 }}>
            <p className={LABEL}>What happened</p>
            <div className="flex flex-wrap gap-2">
              {CALL_OUTCOMES.map((outcome) => (
                <button
                  key={outcome}
                  type="button"
                  aria-pressed={draft.outcome === outcome}
                  onClick={() => setDraft({ ...draft, outcome })}
                  className={`text-xs px-2.5 py-1 rounded-full border transition-colors ${
                    draft.outcome === outcome ? 'border-primary bg-primary/10 text-primary font-semibold' : 'border-border text-muted hover:text-heading'
                  }`}
                >
                  {outcomeLabel(outcome)}
                </button>
              ))}
            </div>

            {draft.points.length > 0 && (
              <ul className="mt-4 space-y-1.5 border-l-2 border-primary/30 pl-4">
                {draft.points.map((point, i) => (
                  <Point key={i} label={point.label} text={point.text} />
                ))}
              </ul>
            )}
            {draft.model === null && aiAvailable && <p className="mt-2 text-[11px] text-muted">Saved as written, without the AI.</p>}

            <div className="mt-5">
              <p className={LABEL}>Next action after this call</p>
              {override ? (
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-[1.6fr_1fr_0.7fr]">
                  <input className={INPUT} aria-label="Next action" value={override.label} onChange={(e) => setOverride({ ...override, label: e.target.value })} />
                  <input className={INPUT} aria-label="Date" type="date" value={override.date} onChange={(e) => setOverride({ ...override, date: e.target.value })} />
                  <input className={INPUT} aria-label="Time" type="time" value={override.time} onChange={(e) => setOverride({ ...override, time: e.target.value })} />
                </div>
              ) : preview && due ? (
                <p className="text-sm text-heading">
                  <span className="font-semibold">{preview.label}</span>
                  {preview.status === 'open' ? (
                    <>
                      {' · '}
                      <DueText text={due.text} tone={due.tone} />
                    </>
                  ) : null}
                  <span className="text-muted"> · {preview.why}</span>
                </p>
              ) : null}
              {!override && preview && (
                <button
                  type="button"
                  className={`${QUIET_ACTION} mt-1 text-xs`}
                  onClick={() => {
                    const at = preview.dueAt ? new Date(preview.dueAt) : null
                    setOverride({ label: preview.label, date: at ? londonToday(at) : '', time: at ? londonTime(at) : '10:00' })
                  }}
                >
                  Change
                </button>
              )}
            </div>

            <div className="mt-5 flex flex-wrap items-center gap-x-6 gap-y-3 text-sm">
              <button type="button" onClick={saveDraft} disabled={busy !== null} className={`${ACTION} font-semibold`}>
                {busy === 'save' ? 'Saving…' : 'Save call'}
              </button>
              <button
                type="button"
                disabled={busy !== null}
                onClick={() => {
                  setDraft(null)
                  setOverride(null)
                }}
                className={QUIET_ACTION}
              >
                Back to notes
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
      <div aria-live="polite">{error && <p className="mt-3 text-xs text-danger">{error}</p>}</div>
    </div>
  )
}
