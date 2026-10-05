'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { motion } from 'framer-motion'
import type { CaseReviewListResponse, DraftSummary } from './types'
import { fmtDay, fmtKeepers, fmtPatient, metaLine } from './format'

/**
 * Every draft case, split into "waiting for sign-off" and "approved", newest
 * first inside each. A row opens the side by side review, where the sign-off
 * lives: approving means having read the case, so it is not offered from the
 * list.
 */

function ReplacesLine({ draft }: { draft: DraftSummary }) {
  if (!draft.replacesStationId) {
    return <span>New case, replaces nothing</span>
  }
  if (!draft.replaces) {
    return <span className="text-danger">Replaces a case that could not be found</span>
  }
  return (
    <span>
      Replaces <span className="text-heading">{draft.replaces.title}</span>{' '}
      <span className="text-muted">
        ({draft.replaces.lifecycle}, {fmtKeepers(draft.replaces.keeperCount)})
      </span>
    </span>
  )
}

function DraftRow({ draft, index }: { draft: DraftSummary; index: number }) {
  const approved = Boolean(draft.approvedAt)
  return (
    <motion.li
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, delay: Math.min(index, 12) * 0.04, ease: 'easeOut' }}
    >
      <Link
        href={`/admin/case-review/${draft.id}`}
        className="group flex flex-col sm:flex-row sm:items-baseline sm:justify-between gap-2 sm:gap-6 border-b border-border py-6 transition-colors hover:bg-surface-raised/60"
      >
        <div className="min-w-0">
          <h3 className="text-xl sm:text-2xl font-semibold tracking-tight text-heading break-words">{draft.title}</h3>
          <p className="mt-1 text-sm text-muted">
            {metaLine([draft.domain, draft.consultationType, fmtPatient(draft.patientName, draft.patientAge)])}
          </p>
          <p className="mt-1.5 text-sm text-body">
            <ReplacesLine draft={draft} />
          </p>
        </div>
        <div className="shrink-0 flex items-baseline gap-3 text-xs">
          {approved ? (
            <span className="text-success">
              Approved {fmtDay(draft.approvedAt)}
              {draft.approvedBy ? <span className="text-muted"> by {draft.approvedBy}</span> : null}
            </span>
          ) : (
            <span className="text-primary">Waiting for sign-off</span>
          )}
          <span aria-hidden="true" className="text-primary transition-transform group-hover:translate-x-1">
            →
          </span>
        </div>
      </Link>
    </motion.li>
  )
}

function Group({ title, drafts, offset }: { title: string; drafts: DraftSummary[]; offset: number }) {
  if (drafts.length === 0) return null
  return (
    <section className="mt-12">
      <h2 className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted">
        {title} <span className="ml-1 text-heading">{drafts.length}</span>
      </h2>
      <ul className="mt-3 border-t border-border">
        {drafts.map((d, i) => (
          <DraftRow key={d.id} draft={d} index={offset + i} />
        ))}
      </ul>
    </section>
  )
}

export default function CaseReviewList() {
  const [drafts, setDrafts] = useState<DraftSummary[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/admin/case-review', { cache: 'no-store' })
      if (!res.ok) {
        setError(res.status === 403 ? 'Not authorized.' : 'Could not load the draft cases.')
        setDrafts([])
        return
      }
      const data = (await res.json()) as CaseReviewListResponse
      setDrafts(data.drafts ?? [])
    } catch {
      setError('Could not load the draft cases.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

  const { waiting, approved } = useMemo(
    () => ({
      waiting: drafts.filter((d) => !d.approvedAt),
      approved: drafts.filter((d) => Boolean(d.approvedAt)),
    }),
    [drafts],
  )

  return (
    <div className="min-h-[100dvh] bg-surface text-body font-sans">
      <div className="max-w-[1100px] mx-auto px-4 sm:px-10 py-12 sm:py-16">
        <Link href="/admin" className="text-xs text-muted hover:text-heading">
          ← Admin
        </Link>
        <header className="mt-4 flex items-end justify-between gap-6 flex-wrap">
          <div>
            <h1 className="text-4xl sm:text-5xl font-bold tracking-tight text-heading">Case review</h1>
            <p className="mt-2 text-sm text-muted max-w-xl">
              New cases waiting to go live. Read each one next to the case it replaces, then approve it.
              Approving does not switch a case on; that is a separate step.
            </p>
          </div>
          <button
            type="button"
            onClick={load}
            disabled={loading}
            className="text-xs text-primary hover:text-primary-light underline underline-offset-4 disabled:opacity-40"
          >
            {loading ? 'Loading' : 'Refresh'}
          </button>
        </header>

        {error ? (
          <p role="alert" className="mt-12 text-sm text-danger">
            {error}
          </p>
        ) : null}

        {!loading && !error && drafts.length === 0 ? (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, ease: 'easeOut' }}
            className="mt-16 border-t border-border pt-10"
          >
            <p className="text-2xl sm:text-3xl font-semibold tracking-tight text-heading">Nothing to review</p>
            <p className="mt-2 text-sm text-muted max-w-lg">
              There are no draft cases right now. New cases appear here as soon as they are loaded, before
              anyone else can see them.
            </p>
          </motion.div>
        ) : null}

        <Group title="Waiting for sign-off" drafts={waiting} offset={0} />
        <Group title="Approved" drafts={approved} offset={waiting.length} />
      </div>
    </div>
  )
}
