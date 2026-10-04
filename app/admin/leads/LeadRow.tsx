'use client'

import { AnimatePresence, motion } from 'framer-motion'
import type { CallView, LeadView } from '@/lib/leads/assemble'
import { callerLabel, dueLabel, outcomeLabel, stampLabel } from '@/lib/leads/board'
import CallLogger from './CallLogger'
import NextActionEditor from './NextActionEditor'
import { DueText, EMPTY_CELL, HeatChip, LABEL, Point } from './ui'

export const ROW_GRID = 'md:grid md:grid-cols-[64px_1.4fr_0.9fr_0.7fr_1.6fr_1.2fr] md:gap-5'

interface LeadRowProps {
  lead: LeadView
  index: number
  now: Date
  aiAvailable: boolean
  expanded: boolean
  onToggle: () => void
  onChange: (lead: LeadView, message: string) => void
}

function LatestCall({ lead }: { lead: LeadView }) {
  const last = lead.calls.at(-1)
  if (!last) {
    return (
      <p className="text-xs text-muted leading-relaxed">
        Not called yet{lead.why.length ? ` · ${lead.why.slice(0, 3).join(', ')}` : ''}
      </p>
    )
  }
  return (
    <div className="text-xs leading-relaxed">
      <p className="text-muted">
        <span className="font-semibold text-body">{outcomeLabel(last.outcome)}</span> · {stampLabel(last.at)}
        {lead.calls.length > 1 ? ` · ${lead.calls.length} calls` : ''}
      </p>
      {last.points.slice(0, 2).map((p, i) => (
        <p key={i} className="text-body line-clamp-2">
          {p.label ? <span className="font-semibold">{p.label}: </span> : null}
          {p.text}
        </p>
      ))}
    </div>
  )
}

function History({ calls }: { calls: readonly CallView[] }) {
  if (calls.length === 0) return <p className="text-sm text-muted">No calls logged yet.</p>
  return (
    <ol className="space-y-5">
      {[...calls].reverse().map((call) => (
        <li key={call.id}>
          <p className="text-xs text-muted">
            <span className="font-semibold text-heading">{outcomeLabel(call.outcome)}</span> · <span className="font-mono">{stampLabel(call.at)}</span> · {callerLabel(call.by)}
          </p>
          {call.points.length > 0 && (
            <ul className="mt-1.5 space-y-1">
              {call.points.map((p, i) => (
                <Point key={i} label={p.label} text={p.text} />
              ))}
            </ul>
          )}
          {call.next && <p className="mt-1 text-[11px] text-muted">Set next: {call.next.label}</p>}
        </li>
      ))}
    </ol>
  )
}

/** Tap to call. A number the trial form stored without +44 is shown and dialled as the likely UK one. */
function PhoneCell({ phone }: { phone: LeadView['phone'] }) {
  if (!phone) return <p className="text-xs text-muted">No phone</p>
  return (
    <>
      <a
        href={phone.tel ?? undefined}
        onClick={(event) => event.stopPropagation()}
        className={`text-sm font-mono tabular-nums ${phone.malformed ? 'text-amber-700' : 'text-primary'} hover:underline underline-offset-4`}
      >
        {phone.display}
      </a>
      {phone.malformed && <p className="text-[11px] text-amber-700">Saved without +44 by the form; this is the likely number</p>}
    </>
  )
}

/** One lead: a scannable line, and when opened, its history and the call logger. */
export default function LeadRow({ lead, index, now, aiAvailable, expanded, onToggle, onChange }: LeadRowProps) {
  const due = dueLabel(lead.next.dueAt, now)
  const closed = lead.next.status === 'closed'

  return (
    <motion.li
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, delay: Math.min(index * 0.03, 0.4), ease: 'easeOut' }}
      className={`border-b border-border ${closed ? 'opacity-70' : ''}`}
    >
      <div
        role="button"
        tabIndex={0}
        aria-expanded={expanded}
        onClick={onToggle}
        onKeyDown={(event) => {
          if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault()
            onToggle()
          }
        }}
        className={`${ROW_GRID} cursor-pointer py-5 focus:outline-none focus-visible:bg-surface-warm/60 hover:bg-surface-warm/40 transition-colors`}
      >
        <div className="flex items-center gap-3 md:block">
          <HeatChip heat={lead.heat} score={lead.score} />
          <span className="md:hidden text-base font-semibold text-heading">{lead.name}</span>
        </div>

        <div className="mt-1 md:mt-0 min-w-0">
          <p className="hidden md:block text-sm font-semibold text-heading truncate">
            {lead.name}
            {lead.bought && <span className="ml-2 text-[10px] font-semibold uppercase tracking-wider text-success">Bought</span>}
          </p>
          <PhoneCell phone={lead.phone} />
          <p className="text-xs text-muted truncate">{lead.email}</p>
        </div>

        <div className="mt-2 md:mt-0 text-xs">
          <p className="text-body">{lead.exam.label}</p>
          <p className="text-muted">
            {lead.kind === 'trial' ? (lead.trial?.running ? `Trial ends ${stampLabel(lead.trial.endsAt)}` : '5-day trial, ended') : 'Free case'}
            {lead.stage ? ` · ${lead.stage}` : ''}
          </p>
        </div>

        <div className="mt-1 md:mt-0 text-xs text-muted">
          <span className="font-mono tabular-nums text-body">{lead.consultations}</span> consultations
          <br />
          <span className="font-mono tabular-nums text-body">{lead.passes}</span> passed
          {lead.best !== null ? ` · best ${lead.best.toFixed(1)}` : ''}
        </div>

        <div className="mt-2 md:mt-0 min-w-0">
          <LatestCall lead={lead} />
        </div>

        <div className="mt-2 md:mt-0">
          <p className="text-sm font-semibold text-heading">{lead.next.label}</p>
          {closed ? <p className="text-[11px] text-muted">{lead.next.why || EMPTY_CELL}</p> : <DueText text={due.text} tone={due.tone} />}
        </div>
      </div>

      <AnimatePresence initial={false}>
        {expanded && (
          <motion.div
            key="detail"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.25, ease: 'easeOut' }}
            className="overflow-hidden"
          >
            <div className="grid grid-cols-1 gap-10 pb-8 pt-2 md:grid-cols-[1fr_1.2fr]">
              <section>
                <p className={LABEL}>Calls</p>
                <History calls={lead.calls} />
                {lead.why.length > 0 && <p className="mt-6 text-xs text-muted">Heat {lead.score}: {lead.why.join(', ')}.</p>}
                {lead.aliases.length > 0 && <p className="mt-2 text-xs text-muted">Also signed up as {lead.aliases.join(', ')}.</p>}
              </section>
              <section className="space-y-8">
                {!lead.bought && <CallLogger lead={lead} aiAvailable={aiAvailable} onSaved={onChange} />}
                <NextActionEditor key={`${lead.next.label}-${lead.next.dueAt}-${lead.next.status}`} lead={lead} onSaved={onChange} />
              </section>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.li>
  )
}
