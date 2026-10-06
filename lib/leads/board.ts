import type { LeadView } from './assemble'
import { REACHED_OUTCOMES, type CallOutcome } from './types'
import { addDays, londonDayLabel, londonTime, londonToday } from './time'

/**
 * How the /admin/leads board filters, sorts and words things. Pure and
 * browser-safe, so the order on screen is tested rather than eyeballed.
 */

export const FILTERS = ['due', 'never', 'chasing', 'spoke', 'closed', 'all'] as const
export type LeadFilter = (typeof FILTERS)[number]

export const FILTER_LABELS: Record<LeadFilter, string> = {
  due: 'Due now',
  never: 'Never called',
  chasing: 'Chasing',
  spoke: 'Spoken to',
  closed: 'Closed',
  all: 'All',
}

const OUTCOME_LABELS: Record<CallOutcome, string> = {
  no_answer: 'No answer',
  voicemail: 'Voicemail left',
  spoke: 'Spoke',
  not_interested: 'Not interested',
  wrong_number: 'Wrong number',
  other: 'Note',
}

export function outcomeLabel(outcome: CallOutcome): string {
  return OUTCOME_LABELS[outcome]
}

const isOpen = (lead: LeadView) => lead.next.status === 'open'
const isDue = (lead: LeadView, now: Date) => isOpen(lead) && lead.next.dueAt !== null && Date.parse(lead.next.dueAt) <= now.getTime()
const everReached = (lead: LeadView) => lead.calls.some((c) => REACHED_OUTCOMES.has(c.outcome))

export function matchesFilter(lead: LeadView, filter: LeadFilter, now: Date): boolean {
  switch (filter) {
    case 'due':
      return isDue(lead, now)
    case 'never':
      return isOpen(lead) && lead.calls.length === 0
    case 'chasing':
      return isOpen(lead) && lead.calls.length > 0 && !everReached(lead)
    case 'spoke':
      return isOpen(lead) && everReached(lead)
    case 'closed':
      return !isOpen(lead)
    default:
      return true
  }
}

export function matchesSearch(lead: LeadView, query: string): boolean {
  const q = query.trim().toLowerCase()
  if (!q) return true
  return [lead.name, lead.email, ...lead.aliases, lead.exam.label, lead.phone?.display ?? ''].some((v) => v.toLowerCase().includes(q))
}

/**
 * The working order: anything due, oldest first; then upcoming, soonest first;
 * then open leads with nothing scheduled, hottest first; closed ones last,
 * most recently touched first. Heat breaks ties.
 */
export function sortLeads(leads: readonly LeadView[], now: Date): LeadView[] {
  const band = (lead: LeadView) => (!isOpen(lead) ? 3 : lead.next.dueAt === null ? 2 : isDue(lead, now) ? 0 : 1)
  const lastTouch = (lead: LeadView) => (lead.calls.length ? Date.parse(lead.calls[lead.calls.length - 1].at) : 0)
  return [...leads].sort((a, b) => {
    const byBand = band(a) - band(b)
    if (byBand) return byBand
    if (band(a) <= 1) {
      const byDue = Date.parse(a.next.dueAt as string) - Date.parse(b.next.dueAt as string)
      if (byDue) return byDue
    }
    if (band(a) === 3) return lastTouch(b) - lastTouch(a)
    return b.score - a.score
  })
}

export type DueTone = 'overdue' | 'now' | 'today' | 'later' | 'none'

/** "Overdue · Sun 12:30", "Now", "Today 18:00", "Tomorrow 12:30", "Wed 7 Oct 10:00", "Not scheduled". */
export function dueLabel(dueAt: string | null, now: Date): { text: string; tone: DueTone } {
  if (!dueAt) return { text: 'Not scheduled', tone: 'none' }
  const due = new Date(dueAt)
  const minutesLate = (now.getTime() - due.getTime()) / 60_000
  if (minutesLate > 60) return { text: `Overdue · ${londonDayLabel(due)} ${londonTime(due)}`, tone: 'overdue' }
  if (minutesLate >= 0) return { text: 'Now', tone: 'now' }
  const today = londonToday(now)
  const day = londonToday(due)
  if (day === today) return { text: `Today ${londonTime(due)}`, tone: 'today' }
  if (day === addDays(today, 1)) return { text: `Tomorrow ${londonTime(due)}`, tone: 'later' }
  return { text: `${londonDayLabel(due)} ${londonTime(due)}`, tone: 'later' }
}

export type TouchTone = 'hot' | 'warm' | 'plain'

export interface TouchPoint {
  label: string
  tone: TouchTone
  /** Plain-English meaning, for the tooltip. */
  title: string
}

/**
 * Every tracked touch point as a chip, strongest buying signal first: the
 * same chips the customer-lead-report HTML shows, which Ishaq asked to keep.
 * Empty when browsing data is off or the lead left no trace on the site.
 */
export function touchPoints(lead: Pick<LeadView, 'signals'>): TouchPoint[] {
  const s = lead.signals
  if (!s) return []
  const chips: Array<TouchPoint | null> = [
    s.checkoutStarts ? { label: `payment page ×${s.checkoutStarts}`, tone: 'hot', title: 'Opened the payment page' } : null,
    s.paywallHits ? { label: `paywall ×${s.paywallHits}`, tone: 'hot', title: 'Reached the end of the free trial' } : null,
    s.pricingViews ? { label: `pricing ×${s.pricingViews}`, tone: 'warm', title: 'Looked at the prices' } : null,
    s.billingToggles ? { label: `compared plans ×${s.billingToggles}`, tone: 'warm', title: 'Switched between the monthly and three-month prices' } : null,
    s.studyBudget ? { label: `study budget ×${s.studyBudget}`, tone: 'warm', title: 'Checked whether their deanery funds the course' } : null,
    s.guideViews ? { label: `guides ×${s.guideViews}`, tone: 'plain', title: 'Read SCA guide pages' } : null,
    s.casebankViews ? { label: `case bank ×${s.casebankViews}`, tone: 'plain', title: 'Read public case pages' } : null,
    s.guestSessions ? { label: `free mocks ×${s.guestSessions}`, tone: 'plain', title: 'Free cases started without an account' } : null,
    s.portfolioCases ? { label: `portfolio ×${s.portfolioCases}`, tone: 'plain', title: 'Wrote cases with the portfolio tool' } : null,
    s.activeDays >= 2 ? { label: `on the site ${s.activeDays} days`, tone: 'plain', title: 'Separate days they visited' } : null,
  ]
  return chips.filter((chip): chip is TouchPoint => chip !== null)
}

/** "6 consultations · 2 redos · 1 passed · best 7.0" */
export function practiceSummary(lead: Pick<LeadView, 'consultations' | 'stationsTried' | 'passes' | 'best'>): string {
  const redos = Math.max(0, lead.consultations - lead.stationsTried)
  return [
    `${lead.consultations} consultation${lead.consultations === 1 ? '' : 's'}`,
    redos ? `${redos} redo${redos === 1 ? '' : 's'}` : null,
    `${lead.passes} passed`,
    lead.best !== null ? `best ${lead.best.toFixed(1)}` : null,
  ]
    .filter(Boolean)
    .join(' · ')
}

/** "Sun 4 Oct, 11:10" for history lines. */
export function stampLabel(iso: string): string {
  const at = new Date(iso)
  return `${londonDayLabel(at)}, ${londonTime(at)}`
}

/** Who logged a call, from their sign-in email: the part before the @. */
export function callerLabel(email: string): string {
  return email.split('@')[0]
}

export function filterCounts(leads: readonly LeadView[], now: Date): Record<LeadFilter, number> {
  return Object.fromEntries(FILTERS.map((f) => [f, leads.filter((l) => matchesFilter(l, f, now)).length])) as Record<LeadFilter, number>
}
