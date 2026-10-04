import type { ExamTiming } from './exam'
import type { Heat } from './followUp'

/**
 * How hot a lead is: a guide to who to ring first, not a prediction.
 *
 * Ported point for point from the customer-lead-report skill (REFERENCE.md has
 * the table). The rubric now lives in three places: here, that skill, and the
 * method note on the page. Change all three together.
 */

export const HOT_FROM = 9
export const WARM_FROM = 5
/** Someone not in GP training is never more than cool. */
const NOT_CANDIDATE_CAP = 2

/** PostHog browsing signals, merged across every browser tied to a lead's email(s). */
export interface Signals {
  pricingViews: number
  billingToggles: number
  checkoutStarts: number
  paywallHits: number
  guideViews: number
  casebankViews: number
  studyBudget: number
  portfolioCases: number
  guestSessions: number
  activeDays: number
  lastSeen: string | null
}

export const NO_SIGNALS: Signals = {
  pricingViews: 0,
  billingToggles: 0,
  checkoutStarts: 0,
  paywallHits: 0,
  guideViews: 0,
  casebankViews: 0,
  studyBudget: 0,
  portfolioCases: 0,
  guestSessions: 0,
  activeDays: 0,
  lastSeen: null,
}

export interface HeatInput {
  now: Date
  exam: ExamTiming
  consultations: number
  passes: number
  /** London days with a consultation. */
  activeDays: number
  signals: Signals
  lastActivity: Date | null
  notCandidate: boolean
}

export interface HeatResult {
  score: number
  heat: Heat
  why: string[]
}

type Part = [points: number, why: string]

function timing(exam: ExamTiming): Part {
  switch (exam.cls) {
    case 'prime':
      return [3, 'exam in 1 to 2 months']
    case 'soon':
      return [2, 'exam in the next few months']
    case 'now':
      return [1, exam.date ? 'exam in the next 2 weeks' : 'sitting this month']
    case 'unknown':
      return [1, '']
    default:
      return [0, '']
  }
}

function activity(input: HeatInput): Part[] {
  const parts: Part[] = []
  if (input.passes) parts.push([2, `passed ${input.passes} case${input.passes > 1 ? 's' : ''}`])
  if (input.consultations >= 4) parts.push([1, `${input.consultations} consultations`])
  if (Math.max(input.activeDays, input.signals.activeDays) >= 2) parts.push([1, 'came back on another day'])
  return parts
}

function buying(s: Signals): Part[] {
  const parts: Part[] = []
  if (s.checkoutStarts) parts.push([3, 'reached the payment page'])
  if (s.paywallHits) parts.push([2, 'hit the trial paywall'])
  if (s.pricingViews >= 2 || s.billingToggles) parts.push([2, 'compared prices'])
  else if (s.pricingViews === 1) parts.push([1, 'saw pricing'])
  if (s.studyBudget) parts.push([1, 'checked study-budget funding'])
  if (s.guideViews >= 2) parts.push([1, `read ${s.guideViews} guide pages`])
  return parts
}

function recency(now: Date, last: Date | null): Part[] {
  if (!last) return []
  const days = (now.getTime() - last.getTime()) / 86_400_000
  if (days < 14) return [[2, 'active in the last 2 weeks']]
  return days > 30 ? [[-1, '']] : []
}

export function heatScore(input: HeatInput): HeatResult {
  const parts = [timing(input.exam), ...activity(input), ...buying(input.signals), ...recency(input.now, input.lastActivity)]
  const raw = parts.reduce((sum, [points]) => sum + points, 0)
  const score = input.notCandidate ? Math.min(raw, NOT_CANDIDATE_CAP) : raw
  return {
    score,
    heat: score >= HOT_FROM ? 'hot' : score >= WARM_FROM ? 'warm' : 'cool',
    why: parts.map(([, why]) => why).filter(Boolean),
  }
}
