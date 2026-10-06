'use client'

import Link from 'next/link'
import { AnimatePresence, motion } from 'framer-motion'
import { caseMetaDescription, type SeoCase } from '@/lib/seo/cases'
import ApprovalControl from './ApprovalControl'
import { CHECKLIST_LABELS } from './checklist'
import { fmtKeepers } from './format'
import type { CaseApprovalResponse, ChecklistCounts, DraftReviewMeta } from './types'

/**
 * The one admin-only strip on /admin/case-review/[id]. Everything under it is
 * the public case page, unchanged, so this bar is the only place that says
 * "you are reviewing": which case is on screen, the sign-off, a way to sit the
 * case, the toggle to the old case, and the two things the public page does
 * not show (the line Google shows, and the marker's checklist size).
 *
 * In the old-case view the sign-off and "Try this case" step aside: both act
 * on the draft, and the page on screen is not the draft.
 */

export type ReviewView = 'new' | 'old'

interface CaseReviewBarProps {
  meta: DraftReviewMeta
  draft: SeoCase
  old: SeoCase | null
  /** Which case the page below is showing. 'old' only when there is one. */
  view: ReviewView
  onToggleView: () => void
  onApprovalChange: (approval: CaseApprovalResponse) => void
}

const FADE = {
  initial: { opacity: 0, y: 4 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -4 },
  transition: { duration: 0.2 },
} as const

const LABEL = 'text-[10px] font-semibold uppercase tracking-[0.14em] text-muted'

/** What sits where the toggle would, when there is no old case to show. */
function ReplacesNote({ meta, old }: { meta: DraftReviewMeta; old: SeoCase | null }) {
  if (old) return null
  if (!meta.replacesStationId) return <span className="text-xs text-muted">New case, replaces nothing</span>
  if (!meta.replaces) return <span className="text-xs text-danger">Replaces a case that could not be found</span>
  return <span className="text-xs text-danger">Replaces {meta.replaces.title}, which could not be loaded</span>
}

function ChecklistLine({ checklist }: { checklist: ChecklistCounts | null }) {
  if (!checklist) {
    return <span className="text-danger">None. The marker needs one before this case goes live.</span>
  }
  const keys = Object.keys(CHECKLIST_LABELS) as (keyof ChecklistCounts)[]
  return (
    <span className="inline-flex flex-wrap gap-x-4 gap-y-1">
      {keys.map((k) => (
        <span key={k}>
          {CHECKLIST_LABELS[k]}{' '}
          <span className={`font-semibold tabular-nums ${checklist[k] === 0 ? 'text-danger' : 'text-heading'}`}>{checklist[k]}</span>
        </span>
      ))}
    </span>
  )
}

export default function CaseReviewBar({ meta, draft, old, view, onToggleView, onApprovalChange }: CaseReviewBarProps) {
  const showingOld = view === 'old' && old !== null
  const written = draft.seo_description?.trim()

  return (
    <motion.aside
      aria-label="Admin review"
      initial={{ opacity: 0, y: -6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, ease: 'easeOut' }}
      className={`mb-6 rounded-2xl border px-4 py-3 sm:px-5 transition-colors duration-300 ${
        showingOld ? 'border-defined bg-surface-warm' : 'border-primary/20 bg-primary/[0.04]'
      }`}
    >
      <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
        <Link href="/admin/case-review" className="text-xs text-muted hover:text-heading transition-colors">
          ← All draft cases
        </Link>
        <span className="rounded-full bg-heading px-2 py-0.5 text-[10px] font-bold uppercase tracking-widest text-surface">
          Admin
        </span>

        <AnimatePresence mode="wait" initial={false}>
          {showingOld && old ? (
            <motion.p key="old" {...FADE} className="text-sm text-heading">
              <span className="font-semibold">Old case it replaces</span>
              <span className="text-muted">
                {' '}
                · {meta.replaces?.lifecycle ?? 'unknown'} · {fmtKeepers(meta.replaces?.keeperCount ?? 0)}. Read only.
              </span>
            </motion.p>
          ) : (
            <motion.div key="new" {...FADE} className="flex flex-wrap items-center gap-x-3 gap-y-1">
              <span className="text-sm font-semibold text-heading">Draft</span>
              <ApprovalControl
                stationId={meta.id}
                approvedAt={meta.approvedAt}
                approvedBy={meta.approvedBy}
                onChange={onApprovalChange}
              />
            </motion.div>
          )}
        </AnimatePresence>

        <div className="flex flex-wrap items-center gap-x-5 gap-y-2 sm:ml-auto">
          {showingOld ? null : (
            <a
              href={`/clinical-master/station/${meta.id}`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs font-semibold text-primary hover:text-primary-light underline underline-offset-4"
            >
              Try this case ↗
            </a>
          )}
          {old ? (
            <button
              type="button"
              onClick={onToggleView}
              aria-pressed={showingOld}
              className="text-xs font-semibold text-heading hover:text-primary underline underline-offset-4 transition-colors"
            >
              {showingOld ? '← Back to the new case' : 'View the case it replaces'}
            </button>
          ) : (
            <ReplacesNote meta={meta} old={old} />
          )}
        </div>
      </div>

      <AnimatePresence initial={false}>
        {showingOld ? null : (
          <motion.dl
            key="checks"
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.25, ease: 'easeOut' }}
            className="overflow-hidden text-xs text-body"
          >
            <div className="mt-3 border-t border-hairline pt-2.5 flex flex-col gap-1.5">
              <div className="flex flex-col sm:flex-row sm:gap-3">
                <dt className={`${LABEL} sm:w-28 sm:shrink-0 sm:pt-px whitespace-nowrap`}>Google shows</dt>
                <dd className="leading-relaxed">
                  {caseMetaDescription(draft)}
                  {written ? null : (
                    <span className="text-primary"> (no line written, so the standard template)</span>
                  )}
                </dd>
              </div>
              <div className="flex flex-col sm:flex-row sm:gap-3">
                <dt className={`${LABEL} sm:w-28 sm:shrink-0 sm:pt-px whitespace-nowrap`}>Checklist</dt>
                <dd>
                  <ChecklistLine checklist={meta.checklist} />
                </dd>
              </div>
            </div>
          </motion.dl>
        )}
      </AnimatePresence>
    </motion.aside>
  )
}
