/**
 * What a receipt says, per plan. Pure — no I/O, no React, no PDF — so every
 * token value in the spec is unit-testable on its own and the renderer stays a
 * dumb layout of these strings.
 *
 * The three plans are NOT interchangeable text. Two are one-off course fees and
 * one is a rolling subscription, and the spec is explicit that a recurring plan
 * must never be issued with a one-off terms block or the reverse: the terms
 * block is the consumer-facing statement of what will happen to the customer's
 * card next month.
 *
 * The £99.66/month on the pricing page is a display breakdown of the £299
 * one-off. It is never a billed amount and must never reach a receipt, so it
 * does not exist anywhere in this file.
 */

import type { PlanKey } from '@/lib/commerce/plans'

/** The plans a receipt can be issued for. Intensive is sold on a call. */
export type ReceiptPlanKey = Extract<PlanKey, 'complete' | 'self_study' | 'self_study_monthly'>

const RECEIPT_PLAN_KEYS: readonly ReceiptPlanKey[] = ['complete', 'self_study', 'self_study_monthly']

export function isReceiptPlanKey(key: string | null | undefined): key is ReceiptPlanKey {
  return RECEIPT_PLAN_KEYS.includes(key as ReceiptPlanKey)
}

/** Everything the caller has to know about a payment to print a receipt. */
export interface ReceiptFacts {
  planKey: ReceiptPlanKey
  receiptNumber: string
  /** The CHARGE date. Not the coaching day — see {@link coachingDayLabel}. */
  paidAt: Date
  customerName: string
  paymentMethod: PaymentMethodLabel
  /** What was actually charged, in pence, straight from Stripe. */
  amountPence: number
  /** "Saturday 12 September 2026". Complete only. */
  coachingDayLabel?: string | null
  /** Rolling plan only: the billing period this charge bought. */
  periodStart?: Date | null
  periodEnd?: Date | null
}

export type PaymentMethodLabel = 'Card' | 'Bank transfer'

/** The finished token values, ready to lay out. */
export interface ReceiptContent {
  receiptNumber: string
  planName: string
  planStrapline: string
  lineItems: readonly string[]
  amount: string
  totalLabel: string
  /** One entry per line; the spec's `<br>` in the terms block. */
  terms: readonly string[]
  paymentDate: string
  paymentMethod: PaymentMethodLabel
  customerName: string
  /** `Fourteen-Fisherman-receipt-FF-26-4478.pdf` */
  fileName: string
}

/** The spec's exact PLAN_NAME strings. Also the receipt's line-item name. */
export const RECEIPT_PLAN_NAMES: Record<ReceiptPlanKey, string> = {
  complete: 'Complete SCA Course',
  self_study: 'Self-Study',
  self_study_monthly: 'Self-Study, monthly',
}

const COURSE_STRAPLINE = 'Preparation course for the MRCGP Simulated Consultation Assessment.'
const SELF_STUDY_STRAPLINE =
  'AI consultation practice for the MRCGP Simulated Consultation Assessment.'

const COURSE_SPEC = 'fourteenfisherman.com/course-spec'
const SUPPORT_EMAIL = 'hello@fourteenfisherman.com'

/**
 * "27 August 2026" — the spec's date format, in London time.
 *
 * The timezone is not incidental. A card charged at 00:30 BST is 23:30 the
 * previous day in UTC, and a receipt that dates a payment to the day before the
 * customer's statement says is exactly the discrepancy a finance team queries.
 */
export function formatReceiptDate(date: Date): string {
  return new Intl.DateTimeFormat('en-GB', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: 'Europe/London',
  }).format(date)
}

/** "£599.00". Pence in, because pence is what Stripe reports. */
export function formatAmount(pence: number): string {
  return `£${(pence / 100).toFixed(2)}`
}

/** The attachment name the spec asks for. */
export function receiptFileName(receiptNumber: string): string {
  return `Fourteen-Fisherman-receipt-${receiptNumber}.pdf`
}

/**
 * A date that belongs on the receipt but may be missing.
 *
 * Every caller of this should have the value — the coaching day is required at
 * checkout for Complete, and Stripe always reports a subscription's period. The
 * placeholder exists so that a receipt with one field missing is still a valid,
 * sendable proof of payment rather than a crash on the payment path, and so the
 * gap is obvious to whoever reads it rather than silently blank.
 */
function orMissing(value: string | null | undefined, what: string): string {
  const trimmed = value?.trim()
  if (trimmed) return trimmed
  console.error('[receipt] missing token — printing a placeholder', { what })
  return `[${what}]`
}

export function buildReceiptContent(facts: ReceiptFacts): ReceiptContent {
  const amount = formatAmount(facts.amountPence)
  const paymentDate = formatReceiptDate(facts.paidAt)

  const common = {
    receiptNumber: facts.receiptNumber,
    planName: RECEIPT_PLAN_NAMES[facts.planKey],
    amount,
    paymentDate,
    paymentMethod: facts.paymentMethod,
    customerName: orMissing(facts.customerName, 'Customer name'),
    fileName: receiptFileName(facts.receiptNumber),
  }

  if (facts.planKey === 'complete') {
    const sessionDate = orMissing(facts.coachingDayLabel, 'session date')
    return {
      ...common,
      planStrapline: COURSE_STRAPLINE,
      lineItems: [
        `Full-day small-group coaching, ${sessionDate}, 09:00 to 17:00`,
        'On-demand lecture series',
        '200 consultation practice stations, 3 month access',
      ],
      totalLabel: 'Total paid',
      terms: [
        'One-off course fee. Not a subscription, and no recurring charge.',
        `Full course specification at ${COURSE_SPEC}`,
      ],
    }
  }

  if (facts.planKey === 'self_study') {
    return {
      ...common,
      planStrapline: SELF_STUDY_STRAPLINE,
      lineItems: [
        '200 consultation practice stations, unlimited use',
        '3 month access from date of purchase',
        'No live teaching or coaching included',
      ],
      totalLabel: 'Total paid',
      terms: [
        'One-off course fee for 3 months access. Not a subscription, and no recurring charge.',
        `Full course specification at ${COURSE_SPEC}`,
      ],
    }
  }

  // The rolling plan. "Amount charged", not "Total paid": more is due next
  // month, so calling this a total would be untrue.
  const periodStart = facts.periodStart
    ? formatReceiptDate(facts.periodStart)
    : orMissing(null, 'start date')
  const periodEnd = facts.periodEnd
    ? formatReceiptDate(facts.periodEnd)
    : orMissing(null, 'end date')
  // The period this charge bought ends on the day the next one is taken.
  const nextBillingDate = periodEnd

  return {
    ...common,
    planStrapline: SELF_STUDY_STRAPLINE,
    lineItems: [
      '200 consultation practice stations, unlimited use',
      `Billing period ${periodStart} to ${periodEnd}`,
      'No live teaching or coaching included',
    ],
    totalLabel: 'Amount charged',
    terms: [
      `Recurring monthly subscription. Renews automatically on ${nextBillingDate} at ${amount} until cancelled.`,
      `Cancel any time from your account or by emailing ${SUPPORT_EMAIL}. Full details at ${COURSE_SPEC}`,
    ],
  }
}
