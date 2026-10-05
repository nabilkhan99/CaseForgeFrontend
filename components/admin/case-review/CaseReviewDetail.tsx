'use client'

import { useCallback, useEffect, useState, type ReactNode } from 'react'
import Link from 'next/link'
import { motion } from 'framer-motion'
import { LearningPointsDisplay, MarkdownContent } from '@/components/cases/LearningPoints'
import { MarkSchemeDomains } from '@/components/cases/MarkScheme'
import ApprovalControl from './ApprovalControl'
import { CHECKLIST_LABELS } from './checklist'
import type { CaseApprovalResponse, CaseContent, CaseReviewDetailResponse, ChecklistCounts } from './types'
import { EMPTY, fmtKeepers, fmtPatient, metaLine } from './format'

/**
 * One draft case next to the old case it replaces.
 *
 * Laid out section by section (brief, patient script, mark scheme, learning
 * points), each a row with the new case on the left and the old on the right,
 * so the reviewer compares like with like without scrolling two long columns
 * against each other. On a phone each row stacks, new case first.
 *
 * Every section renders through the same components the public case page and
 * the feedback report use (components/cases), so the reviewer sees the case as
 * trainees will.
 */

interface Section {
  key: string
  title: string
  render: (c: CaseContent) => ReactNode
}

const SECTIONS: readonly Section[] = [
  {
    key: 'brief',
    title: 'Candidate brief',
    render: (c) => <MarkdownContent content={c.candidateInstructions} />,
  },
  {
    key: 'script',
    title: 'Patient script',
    render: (c) => <MarkdownContent content={c.stationScript} />,
  },
  {
    key: 'marks',
    title: 'Mark scheme',
    render: (c) => (
      <MarkSchemeDomains
        dataGathering={c.dataGathering}
        clinicalManagement={c.clinicalManagement}
        relatingToOthers={c.relatingToOthers}
      />
    ),
  },
  {
    key: 'learning',
    title: 'Learning points',
    render: (c) => <LearningPointsDisplay content={c.learningPoints} />,
  },
]

const SUBHEAD = 'text-[11px] font-semibold uppercase tracking-[0.14em] text-muted'

function ChecklistLine({ checklist }: { checklist: ChecklistCounts | null }) {
  if (!checklist) {
    return <p className="text-sm text-danger">No structured checklist. The marker needs one before this case goes live.</p>
  }
  const keys = Object.keys(CHECKLIST_LABELS) as (keyof ChecklistCounts)[]
  return (
    <dl className="flex flex-wrap gap-x-10 gap-y-3">
      {keys.map((k) => (
        <div key={k}>
          <dt className="text-xs text-muted">{CHECKLIST_LABELS[k]}</dt>
          <dd className={`text-2xl font-semibold tracking-tight ${checklist[k] === 0 ? 'text-danger' : 'text-heading'}`}>
            {checklist[k]}
          </dd>
        </div>
      ))}
    </dl>
  )
}

function ColumnLabel({ label, tone }: { label: string; tone: 'new' | 'old' }) {
  return (
    <p className={`mb-3 text-xs font-semibold ${tone === 'new' ? 'text-primary' : 'text-muted'}`}>{label}</p>
  )
}

export default function CaseReviewDetail({ id }: { id: string }) {
  const [review, setReview] = useState<CaseReviewDetailResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/admin/case-review/${id}`, { cache: 'no-store' })
      if (!res.ok) {
        setError(
          res.status === 403
            ? 'Not authorized.'
            : res.status === 404
              ? 'This is not a draft case. It may already have been switched on.'
              : 'Could not load this case.',
        )
        setReview(null)
        return
      }
      setReview((await res.json()) as CaseReviewDetailResponse)
    } catch {
      setError('Could not load this case.')
    } finally {
      setLoading(false)
    }
  }, [id])

  useEffect(() => {
    load()
  }, [load])

  const onApprovalChange = useCallback((approval: CaseApprovalResponse) => {
    setReview((prev) =>
      prev ? { ...prev, draft: { ...prev.draft, approvedAt: approval.approvedAt, approvedBy: approval.approvedBy } } : prev,
    )
  }, [])

  return (
    <div className="min-h-[100dvh] bg-surface text-body font-sans">
      <div className="max-w-[1400px] mx-auto px-4 sm:px-10 py-12 sm:py-16">
        <Link href="/admin/case-review" className="text-xs text-muted hover:text-heading">
          ← All draft cases
        </Link>

        {loading && !review ? <p className="mt-10 text-sm text-muted">Loading the case</p> : null}
        {error ? (
          <p role="alert" className="mt-10 text-sm text-danger">
            {error}
          </p>
        ) : null}

        {review ? <ReviewBody review={review} onApprovalChange={onApprovalChange} /> : null}
      </div>
    </div>
  )
}

function ReviewBody({
  review,
  onApprovalChange,
}: {
  review: CaseReviewDetailResponse
  onApprovalChange: (approval: CaseApprovalResponse) => void
}) {
  const { draft, old } = review
  const missingOld = Boolean(draft.replacesStationId) && !old

  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4, ease: 'easeOut' }}>
      {/* ── Header: what this is, and the two things you can do with it ── */}
      <header className="mt-4">
        <p className={SUBHEAD}>Draft case</p>
        <h1 className="mt-2 text-3xl sm:text-5xl font-bold tracking-tight text-heading break-words">{draft.title}</h1>
        <p className="mt-2 text-sm text-muted">
          {metaLine([draft.domain, draft.consultationType, fmtPatient(draft.patientName, draft.patientAge)])}
        </p>

        <div className="mt-8 flex flex-col sm:flex-row sm:items-center gap-4 sm:gap-8">
          <ApprovalControl
            stationId={draft.id}
            approvedAt={draft.approvedAt}
            approvedBy={draft.approvedBy}
            onChange={onApprovalChange}
          />
          <a
            href={`/clinical-master/station/${draft.id}`}
            target="_blank"
            rel="noopener noreferrer"
            className="text-sm text-primary hover:text-primary-light underline underline-offset-4"
          >
            Try this case ↗
          </a>
        </div>
      </header>

      {/* ── What the replacement changes ── */}
      <section className="mt-12 border-t border-border pt-8 grid gap-8 lg:grid-cols-2">
        <div>
          <p className={SUBHEAD}>Replaces</p>
          {old ? (
            <>
              <p className="mt-2 text-xl font-semibold tracking-tight text-heading">{old.title}</p>
              <p className="mt-1 text-sm text-muted">
                {metaLine([old.lifecycle, fmtKeepers(old.keeperCount), old.domain, old.consultationType])}
              </p>
            </>
          ) : missingOld ? (
            <p className="mt-2 text-sm text-danger">Points at a case that could not be found.</p>
          ) : (
            <p className="mt-2 text-sm text-body">Nothing. This is a new case in its own slot.</p>
          )}
        </div>
        <div>
          <p className={SUBHEAD}>Public page description</p>
          <p className="mt-2 text-sm text-body leading-relaxed">
            {draft.seoDescription?.trim() || (
              <span className="text-muted">{EMPTY} None written. The page will use the standard description.</span>
            )}
          </p>
        </div>
        <div className="lg:col-span-2">
          <p className={`${SUBHEAD} mb-3`}>Marking checklist (indicators per domain)</p>
          <ChecklistLine checklist={draft.checklist} />
        </div>
      </section>

      {/* ── Side by side, section by section ── */}
      {SECTIONS.map((section, i) => (
        <motion.section
          key={section.key}
          initial={{ opacity: 0, y: 8 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-40px' }}
          transition={{ duration: 0.35, delay: i * 0.03, ease: 'easeOut' }}
          className="mt-14 border-t border-border pt-8"
        >
          <h2 className="text-2xl sm:text-3xl font-semibold tracking-tight text-heading">{section.title}</h2>
          <div className={`mt-6 grid gap-10 ${old ? 'lg:grid-cols-2 lg:gap-12' : ''}`}>
            <div className="min-w-0">
              <ColumnLabel label="New case" tone="new" />
              {section.render(draft)}
            </div>
            {old ? (
              <div className="min-w-0 lg:border-l lg:border-border lg:pl-12">
                <ColumnLabel label="Old case" tone="old" />
                {section.render(old)}
              </div>
            ) : null}
          </div>
        </motion.section>
      ))}
    </motion.div>
  )
}
