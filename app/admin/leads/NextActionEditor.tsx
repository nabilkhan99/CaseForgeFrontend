'use client'

import { useId, useState } from 'react'
import type { LeadView } from '@/lib/leads/assemble'
import { dueLabel } from '@/lib/leads/board'
import { londonTime, londonToday, londonWallTimeToUtc } from '@/lib/leads/time'
import type { AdminLeadFollowupResponse } from '@/app/api/admin/leads/followup/route'
import { ACTION, DueText, INPUT, LABEL, QUIET_ACTION } from './ui'

const CLOSE_REASONS = ['Not interested', 'Sitting much later', 'Using something else', 'Not reachable', 'Not a GP trainee']

interface NextActionEditorProps {
  lead: LeadView
  onSaved: (lead: LeadView, message: string) => void
}

type Mode = 'view' | 'change' | 'close'

/**
 * The next action, and the two hand overrides: move it (a new task or time),
 * or close the lead. A bought lead closes itself and has nothing to edit.
 */
export default function NextActionEditor({ lead, onSaved }: NextActionEditorProps) {
  const id = useId()
  const { next } = lead
  const at = next.dueAt ? new Date(next.dueAt) : null
  const [mode, setMode] = useState<Mode>('view')
  const [label, setLabel] = useState(next.status === 'open' ? next.label : 'Call')
  const [date, setDate] = useState(at ? londonToday(at) : londonToday())
  const [time, setTime] = useState(at ? londonTime(at) : '18:00')
  const [reason, setReason] = useState(CLOSE_REASONS[0])
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function patch(body: Record<string, unknown>) {
    setSaving(true)
    setError(null)
    try {
      const response = await fetch('/api/admin/leads/followup', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: lead.email, ...body }),
      })
      const data = await response.json().catch(() => ({}))
      if (!response.ok) {
        setError((data as { error?: string }).error ?? 'Could not save.')
        return
      }
      const saved = (data as AdminLeadFollowupResponse).lead
      setMode('view')
      onSaved(saved, saved.next.status === 'closed' ? `Closed: ${saved.next.closedReason}.` : `Next: ${saved.next.label} · ${dueLabel(saved.next.dueAt, new Date()).text}.`)
    } catch {
      setError('Could not reach the server.')
    } finally {
      setSaving(false)
    }
  }

  const due = dueLabel(next.dueAt, new Date())

  return (
    <div>
      <p className={LABEL}>Next action</p>
      {mode === 'view' && (
        <>
          <p className="text-sm text-heading">
            <span className="font-semibold">{next.label}</span>
            {next.status === 'open' && (
              <>
                {' · '}
                <DueText text={due.text} tone={due.tone} />
              </>
            )}
          </p>
          <p className="mt-0.5 text-xs text-muted">
            {next.why}
            {next.source === 'manual' ? ' · set by hand' : next.source === 'call' ? ' · from the call' : ''}
          </p>
          {!lead.bought && (
            <div className="mt-2 flex flex-wrap gap-x-5 gap-y-2 text-xs">
              <button type="button" className={QUIET_ACTION} onClick={() => setMode('change')}>
                {next.status === 'open' ? 'Change' : 'Reopen'}
              </button>
              {next.status === 'open' && (
                <button type="button" className={QUIET_ACTION} onClick={() => setMode('close')}>
                  Close lead
                </button>
              )}
            </div>
          )}
        </>
      )}

      {mode === 'change' && (
        <form
          className="grid grid-cols-1 gap-3 sm:grid-cols-[1.6fr_1fr_0.7fr]"
          onSubmit={(event) => {
            event.preventDefault()
            if (!label.trim()) {
              setError('Say what the next action is.')
              return
            }
            void patch({ status: 'open', label, dueAt: date ? londonWallTimeToUtc(date, time || '10:00').toISOString() : null })
          }}
        >
          <input className={INPUT} aria-label="Next action" value={label} onChange={(e) => setLabel(e.target.value)} />
          <input id={`${id}-date`} className={INPUT} aria-label="Date" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          <input className={INPUT} aria-label="Time" type="time" value={time} onChange={(e) => setTime(e.target.value)} />
          <div className="sm:col-span-3 flex gap-6 text-sm">
            <button type="submit" disabled={saving} className={ACTION}>
              {saving ? 'Saving…' : 'Save'}
            </button>
            <button type="button" disabled={saving} className={QUIET_ACTION} onClick={() => setMode('view')}>
              Cancel
            </button>
          </div>
        </form>
      )}

      {mode === 'close' && (
        <form
          className="flex flex-wrap items-center gap-x-6 gap-y-3"
          onSubmit={(event) => {
            event.preventDefault()
            void patch({ status: 'closed', closedReason: reason })
          }}
        >
          <select aria-label="Why close it" className={`${INPUT} w-auto`} value={reason} onChange={(e) => setReason(e.target.value)}>
            {CLOSE_REASONS.map((r) => (
              <option key={r}>{r}</option>
            ))}
          </select>
          <button type="submit" disabled={saving} className={`${ACTION} text-sm`}>
            {saving ? 'Saving…' : 'Close lead'}
          </button>
          <button type="button" disabled={saving} className={`${QUIET_ACTION} text-sm`} onClick={() => setMode('view')}>
            Cancel
          </button>
        </form>
      )}
      <div aria-live="polite">{error && <p className="mt-2 text-xs text-danger">{error}</p>}</div>
    </div>
  )
}
