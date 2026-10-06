'use client'

import { useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import type { ApprovalAction, CaseApprovalResponse } from './types'
import { fmtDay } from './format'

/**
 * Approve / withdraw for one draft. Optimistic: the state flips on click and
 * flips back, with the server's reason shown plainly, if the save fails.
 *
 * Approving records the sign-off only. It does not put the case live.
 */

interface ApprovalControlProps {
  stationId: string
  approvedAt: string | null
  approvedBy: string | null
  onChange: (approval: CaseApprovalResponse) => void
}

export default function ApprovalControl({ stationId, approvedAt, approvedBy, onChange }: ApprovalControlProps) {
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const approved = Boolean(approvedAt)

  async function submit(action: ApprovalAction) {
    const previous: CaseApprovalResponse = { id: stationId, approvedAt, approvedBy }
    setSaving(true)
    setError(null)
    onChange(
      action === 'approve'
        ? { id: stationId, approvedAt: new Date().toISOString(), approvedBy: null }
        : { id: stationId, approvedAt: null, approvedBy: null },
    )
    try {
      const res = await fetch(`/api/admin/case-review/${stationId}/approval`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action }),
      })
      const body = (await res.json().catch(() => null)) as (CaseApprovalResponse & { error?: string }) | null
      if (!res.ok || !body) {
        onChange(previous)
        setError(body?.error ?? 'Could not save the sign-off. Nothing changed.')
        return
      }
      onChange({ id: body.id, approvedAt: body.approvedAt, approvedBy: body.approvedBy })
    } catch {
      onChange(previous)
      setError('Could not reach the server. Nothing changed.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="flex flex-col gap-1">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5">
        <AnimatePresence mode="wait" initial={false}>
          {approved ? (
            <motion.p
              key="approved"
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -4 }}
              transition={{ duration: 0.2 }}
              className="text-sm text-success font-semibold"
            >
              Approved{approvedBy ? <span className="font-normal text-body"> by {approvedBy}</span> : null}
              <span className="font-normal text-muted"> on {fmtDay(approvedAt)}</span>
            </motion.p>
          ) : (
            <motion.p
              key="waiting"
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -4 }}
              transition={{ duration: 0.2 }}
              className="text-sm text-primary font-semibold"
            >
              Waiting for sign-off
            </motion.p>
          )}
        </AnimatePresence>

        {approved ? (
          <button
            type="button"
            onClick={() => submit('withdraw')}
            disabled={saving}
            className="text-xs text-muted hover:text-heading underline underline-offset-4 disabled:opacity-40"
          >
            Withdraw approval
          </button>
        ) : (
          <button
            type="button"
            onClick={() => submit('approve')}
            disabled={saving}
            className="rounded-full bg-primary px-4 py-1.5 text-xs font-semibold text-white shadow-elevation-1 transition-colors hover:bg-primary-light disabled:opacity-50"
          >
            Approve this case
          </button>
        )}
      </div>
      {error ? (
        <p role="alert" className="text-xs text-danger">
          {error}
        </p>
      ) : null}
    </div>
  )
}
