import type { Heat } from '@/lib/leads/followUp'
import type { DueTone, TouchPoint, TouchTone } from '@/lib/leads/board'

/** What an empty cell shows. Not a dash: no em or en dashes in this product's copy. */
export const EMPTY_CELL = '·'

export const INPUT =
  'w-full rounded-lg border border-border bg-surface-raised px-3 py-2 text-sm text-heading placeholder:text-muted/70 focus:outline-none focus:ring-2 focus:ring-primary/30'
export const LABEL = 'block text-[10px] font-semibold uppercase tracking-[0.14em] text-muted mb-1.5'
export const ACTION =
  'text-primary hover:text-primary-light underline underline-offset-4 disabled:opacity-40 disabled:no-underline'
export const QUIET_ACTION =
  'text-muted hover:text-heading underline underline-offset-4 disabled:opacity-40 disabled:no-underline'

const HEAT_STYLE: Record<Heat, string> = {
  hot: 'bg-danger/10 text-danger',
  warm: 'bg-primary/10 text-primary',
  cool: 'bg-surface-warm text-muted',
}

/** The heat badge with its score underneath, as the lead report shows it. */
export function HeatChip({ heat, score }: { heat: Heat; score: number }) {
  return (
    <span className="inline-flex items-center gap-2 md:flex-col md:items-start md:gap-1">
      <span className={`inline-block text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded-full ${HEAT_STYLE[heat]}`}>
        {heat}
      </span>
      <span className="font-mono tabular-nums text-[11px] text-muted">score {score}</span>
    </span>
  )
}

const TOUCH_STYLE: Record<TouchTone, string> = {
  hot: 'bg-danger/10 text-danger font-semibold',
  warm: 'bg-primary/10 text-primary font-semibold',
  plain: 'bg-surface-warm text-body',
}

/** Touch points as small chips: payment page, paywall, pricing ×3, guides ×5. */
export function TouchChips({ points, emptyText }: { points: readonly TouchPoint[]; emptyText: string }) {
  if (points.length === 0) return <p className="mt-1 text-[11px] text-muted">{emptyText}</p>
  return (
    <div className="mt-1.5 flex flex-wrap gap-1">
      {points.map((point) => (
        <span key={point.label} title={point.title} className={`text-[11px] px-2 py-0.5 rounded-md ${TOUCH_STYLE[point.tone]}`}>
          {point.label}
        </span>
      ))}
    </div>
  )
}

const DUE_STYLE: Record<DueTone, string> = {
  overdue: 'text-danger font-semibold',
  now: 'text-primary font-semibold',
  today: 'text-primary font-semibold',
  later: 'text-body',
  none: 'text-muted',
}

export function DueText({ text, tone }: { text: string; tone: DueTone }) {
  return <span className={`font-mono tabular-nums text-[11px] ${DUE_STYLE[tone]}`}>{text}</span>
}

/** A tidied point: an optional label, then the sentence. */
export function Point({ label, text }: { label: string | null; text: string }) {
  return (
    <li className="text-sm text-body leading-relaxed">
      {label ? <span className="font-semibold text-heading">{label}: </span> : null}
      {text}
    </li>
  )
}
