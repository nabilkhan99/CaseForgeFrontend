import { describe, expect, it, vi } from 'vitest'
import {
  buildReceiptContent,
  formatAmount,
  formatReceiptDate,
  isReceiptPlanKey,
  receiptFileName,
  type ReceiptFacts,
} from './receiptContent'

/**
 * The token values from section 4 of the receipt spec, pinned per plan.
 *
 * These strings are the receipt. A wrong terms block on a recurring plan is a
 * consumer-law problem, and a "Total paid" on a subscription is a false
 * statement about money — so each plan's whole set is asserted, not sampled.
 */

const BASE = {
  receiptNumber: 'FF-26-4478',
  paidAt: new Date('2026-08-27T10:30:00Z'),
  customerName: 'Jane Okonkwo',
  paymentMethod: 'Card',
} as const

const COMPLETE: ReceiptFacts = {
  ...BASE,
  planKey: 'complete',
  amountPence: 59900,
  coachingDayLabel: 'Saturday 12 September 2026',
}

const SELF_STUDY: ReceiptFacts = { ...BASE, planKey: 'self_study', amountPence: 29900 }

const MONTHLY: ReceiptFacts = {
  ...BASE,
  planKey: 'self_study_monthly',
  amountPence: 12900,
  periodStart: new Date('2026-08-27T10:30:00Z'),
  periodEnd: new Date('2026-09-27T10:30:00Z'),
}

describe('Complete SCA Course — £599 one-off', () => {
  const c = buildReceiptContent(COMPLETE)

  it('uses the formal plan name and the course strapline', () => {
    expect(c.planName).toBe('Complete SCA Course')
    expect(c.planStrapline).toBe(
      'Preparation course for the MRCGP Simulated Consultation Assessment.',
    )
  })

  it('lists the coaching day, the lectures and the stations', () => {
    expect(c.lineItems).toEqual([
      'Full-day small-group coaching, Saturday 12 September 2026, 09:00 to 17:00',
      'On-demand lecture series',
      '200 consultation practice stations, 3 month access',
    ])
  })

  it('is a total paid, at £599.00', () => {
    expect(c.totalLabel).toBe('Total paid')
    expect(c.amount).toBe('£599.00')
  })

  it('states plainly that nothing recurs', () => {
    expect(c.terms).toEqual([
      'One-off course fee. Not a subscription, and no recurring charge.',
      'Full course specification at fourteenfisherman.com/course-spec',
    ])
  })
})

describe('Self-Study, 3 month — £299 one-off', () => {
  const c = buildReceiptContent(SELF_STUDY)

  it('uses the short plan name and the self-study strapline', () => {
    expect(c.planName).toBe('Self-Study')
    expect(c.planStrapline).toBe(
      'AI consultation practice for the MRCGP Simulated Consultation Assessment.',
    )
  })

  it('says what is and is not included', () => {
    expect(c.lineItems).toEqual([
      '200 consultation practice stations, unlimited use',
      '3 month access from date of purchase',
      'No live teaching or coaching included',
    ])
  })

  it('is a total paid, at £299.00', () => {
    expect(c.totalLabel).toBe('Total paid')
    expect(c.amount).toBe('£299.00')
  })

  it('states plainly that nothing recurs', () => {
    expect(c.terms[0]).toBe(
      'One-off course fee for 3 months access. Not a subscription, and no recurring charge.',
    )
  })
})

describe('Self-Study, monthly — £129 recurring', () => {
  const c = buildReceiptContent(MONTHLY)

  it('names the plan as the recurring one', () => {
    expect(c.planName).toBe('Self-Study, monthly')
  })

  it('prints the billing period it actually bought', () => {
    expect(c.lineItems[1]).toBe('Billing period 27 August 2026 to 27 September 2026')
  })

  it('is an amount charged, never a total paid — more is due next month', () => {
    expect(c.totalLabel).toBe('Amount charged')
    expect(c.amount).toBe('£129.00')
  })

  it('states the renewal date and the amount, which is the consumer-law bit', () => {
    expect(c.terms[0]).toBe(
      'Recurring monthly subscription. Renews automatically on 27 September 2026 at £129.00 until cancelled.',
    )
    expect(c.terms[1]).toBe(
      'Cancel any time from your account or by emailing hello@fourteenfisherman.com. Full details at fourteenfisherman.com/course-spec',
    )
  })
})

describe('the two blocks that must never be swapped', () => {
  it('never gives a recurring plan a one-off terms block', () => {
    const monthly = buildReceiptContent(MONTHLY)
    expect(monthly.terms.join(' ')).toContain('Recurring monthly subscription')
    expect(monthly.terms.join(' ')).not.toContain('no recurring charge')
  })

  it('never gives a one-off plan a recurring terms block', () => {
    for (const facts of [COMPLETE, SELF_STUDY]) {
      const terms = buildReceiptContent(facts).terms.join(' ')
      expect(terms).toContain('Not a subscription, and no recurring charge')
      expect(terms).not.toContain('Renews automatically')
    }
  })

  it('never prints the £99.66 pricing-page breakdown on any receipt', () => {
    // It is a display breakdown of the £299 one-off, never a billed amount.
    for (const facts of [COMPLETE, SELF_STUDY, MONTHLY]) {
      const c = buildReceiptContent(facts)
      const everything = [c.amount, ...c.lineItems, ...c.terms].join(' ')
      expect(everything).not.toContain('99.66')
    }
  })
})

describe('the charge date is not the coaching day', () => {
  it('dates the payment from paidAt, whatever the coaching day says', () => {
    const c = buildReceiptContent({
      ...COMPLETE,
      paidAt: new Date('2026-08-27T10:30:00Z'),
      coachingDayLabel: 'Saturday 12 September 2026',
    })
    expect(c.paymentDate).toBe('27 August 2026')
    expect(c.lineItems[0]).toContain('Saturday 12 September 2026')
  })

  it('dates a payment in London time, not UTC', () => {
    // 00:30 BST is 23:30 the previous day in UTC. A receipt dated the day
    // before the customer's bank statement is what a finance team queries.
    expect(formatReceiptDate(new Date('2026-08-26T23:30:00Z'))).toBe('27 August 2026')
  })
})

describe('formatting helpers', () => {
  it('renders pence as pounds with two decimals', () => {
    expect(formatAmount(59900)).toBe('£599.00')
    expect(formatAmount(12900)).toBe('£129.00')
    expect(formatAmount(0)).toBe('£0.00')
  })

  it('names the attachment the way the spec asks', () => {
    expect(receiptFileName('FF-26-4478')).toBe('Fourteen-Fisherman-receipt-FF-26-4478.pdf')
    expect(buildReceiptContent(COMPLETE).fileName).toBe(
      'Fourteen-Fisherman-receipt-FF-26-4478.pdf',
    )
  })

  it('recognises only the three plans a receipt can be issued for', () => {
    expect(isReceiptPlanKey('complete')).toBe(true)
    expect(isReceiptPlanKey('self_study')).toBe(true)
    expect(isReceiptPlanKey('self_study_monthly')).toBe(true)
    // Sold on a call, never through Checkout.
    expect(isReceiptPlanKey('intensive')).toBe(false)
    expect(isReceiptPlanKey(null)).toBe(false)
    expect(isReceiptPlanKey('mystery_tier')).toBe(false)
  })
})

describe('missing values are visible, not blank', () => {
  it('marks a missing coaching day rather than printing an empty gap', () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    const c = buildReceiptContent({ ...COMPLETE, coachingDayLabel: null })
    expect(c.lineItems[0]).toContain('[session date]')
  })

  it('marks a missing billing period rather than printing an empty gap', () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    const c = buildReceiptContent({ ...MONTHLY, periodStart: null, periodEnd: null })
    expect(c.lineItems[1]).toBe('Billing period [start date] to [end date]')
  })

  it('marks a missing customer name', () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    expect(buildReceiptContent({ ...COMPLETE, customerName: '  ' }).customerName).toBe(
      '[Customer name]',
    )
  })
})

describe('names that have broken receipts before', () => {
  it('keeps an apostrophe as an apostrophe, not an HTML entity', () => {
    const c = buildReceiptContent({ ...COMPLETE, customerName: "Niamh O'Sullivan-D'Arcy" })
    expect(c.customerName).toBe("Niamh O'Sullivan-D'Arcy")
    expect(c.customerName).not.toContain('&#39;')
    expect(c.customerName).not.toContain('&apos;')
  })

  it('passes a 30-character name through untouched', () => {
    const name = 'Christopher Wainwright-Bailey'
    expect(buildReceiptContent({ ...COMPLETE, customerName: name }).customerName).toBe(name)
  })
})
