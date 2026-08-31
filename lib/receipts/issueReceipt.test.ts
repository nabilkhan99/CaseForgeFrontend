import { beforeEach, describe, expect, it, vi } from 'vitest'

/**
 * Receipt numbering under Stripe's retries.
 *
 * Stripe redelivers webhook events routinely, and can have two deliveries of
 * the same event in flight at once. The spec's requirement is absolute — no
 * gaps, no reuse, no renumbering after issue — so the thing pinned here is that
 * a SECOND delivery of the same payment gets the SAME number back rather than
 * burning a new one, and that the reprint is byte-identical.
 *
 * The Postgres side of this (`issue_receipt` in 20260831_receipts.sql) is a row
 * lock plus a savepoint that hands a lost number back. It cannot be executed
 * here, so `fakeIssueReceiptRpc` below models its CONTRACT: keyed on
 * `stripe_event_key`, first call allocates, every later call replays. If that
 * contract ever stops holding, these tests are what says so.
 */

const mocks = vi.hoisted(() => ({ renderReceipt: vi.fn() }))

vi.mock('server-only', () => ({}))
vi.mock('./renderReceipt', () => ({ renderReceipt: mocks.renderReceipt }))

const { issueReceipt } = await import('./issueReceipt')

/** The observable behaviour of `public.issue_receipt`. */
function fakeIssueReceiptRpc(startAt = 4478) {
  const byEventKey = new Map<string, Record<string, unknown>>()
  const state = { next: startAt, allocations: 0 }

  const rpc = vi.fn(async (_fn: string, params: Record<string, unknown>) => {
    const key = params.p_stripe_event_key as string
    // (1) Already issued for this Stripe object — the retry path.
    const existing = byEventKey.get(key)
    if (existing) return { data: existing, error: null }

    // (2) Allocate. The counter only ever moves here.
    const n = state.next++
    state.allocations++
    const row = {
      id: `r-${n}`,
      receipt_number: `FF-26-${String(n).padStart(4, '0')}`,
      plan: params.p_plan,
      amount_pence: params.p_amount_pence,
      customer_name: params.p_customer_name,
      payment_method: params.p_payment_method,
      paid_at: params.p_paid_at,
      period_start: params.p_period_start,
      period_end: params.p_period_end,
      coaching_day_label: params.p_coaching_day_label,
    }
    byEventKey.set(key, row)
    return { data: row, error: null }
  })

  return { supabase: { rpc } as never, state, rpc }
}

const PURCHASE = {
  stripeEventKey: 'cs_test_123',
  preorderId: 'p1',
  email: 'buyer@x.com',
  customerName: 'Jane Okonkwo',
  planKey: 'complete',
  amountPence: 59900,
  currency: 'gbp',
  paymentMethod: 'Card',
  paidAt: new Date('2026-08-27T10:30:00Z'),
  coachingDayLabel: 'Saturday 12 September 2026',
  kind: 'purchase',
} as const

beforeEach(() => {
  vi.clearAllMocks()
  vi.spyOn(console, 'error').mockImplementation(() => {})
  mocks.renderReceipt.mockImplementation(async (facts: { receiptNumber: string }) => ({
    pdf: Buffer.from(`pdf-for-${facts.receiptNumber}`),
    fileName: `Fourteen-Fisherman-receipt-${facts.receiptNumber}.pdf`,
    content: {},
  }))
})

describe('a redelivered webhook gets the same receipt number', () => {
  it('does not burn a second number on a retry', async () => {
    const { supabase, state } = fakeIssueReceiptRpc()

    const first = await issueReceipt(supabase, PURCHASE)
    const retry = await issueReceipt(supabase, PURCHASE)

    expect(first?.receiptNumber).toBe('FF-26-4478')
    expect(retry?.receiptNumber).toBe('FF-26-4478')
    // The counter moved exactly once. This is the no-gap requirement.
    expect(state.allocations).toBe(1)
    expect(state.next).toBe(4479)
  })

  it('reprints identically, down to the payment date', async () => {
    // The reprint is rendered from the row the DATABASE returned, not from the
    // arguments — so a retry that arrives a day later cannot re-date it.
    const { supabase } = fakeIssueReceiptRpc()

    await issueReceipt(supabase, PURCHASE)
    await issueReceipt(supabase, { ...PURCHASE, paidAt: new Date('2026-09-04T09:00:00Z') })

    const [firstFacts] = mocks.renderReceipt.mock.calls[0]
    const [retryFacts] = mocks.renderReceipt.mock.calls[1]
    expect(retryFacts.paidAt).toEqual(firstFacts.paidAt)
    expect(retryFacts.paidAt).toEqual(new Date('2026-08-27T10:30:00Z'))
    expect(retryFacts.receiptNumber).toBe(firstFacts.receiptNumber)
  })

  it('survives three deliveries of the same event', async () => {
    const { supabase, state } = fakeIssueReceiptRpc()

    const numbers = []
    for (let i = 0; i < 3; i++) numbers.push((await issueReceipt(supabase, PURCHASE))?.receiptNumber)

    expect(numbers).toEqual(['FF-26-4478', 'FF-26-4478', 'FF-26-4478'])
    expect(state.allocations).toBe(1)
  })

  it('gives concurrent deliveries of the same event one number between them', async () => {
    const { supabase, state } = fakeIssueReceiptRpc()

    const results = await Promise.all([
      issueReceipt(supabase, PURCHASE),
      issueReceipt(supabase, PURCHASE),
      issueReceipt(supabase, PURCHASE),
    ])

    expect(new Set(results.map((r) => r?.receiptNumber))).toEqual(new Set(['FF-26-4478']))
    expect(state.allocations).toBe(1)
  })
})

describe('different payments get consecutive numbers', () => {
  it('increments by one, with no gaps', async () => {
    const { supabase } = fakeIssueReceiptRpc()

    const a = await issueReceipt(supabase, PURCHASE)
    const b = await issueReceipt(supabase, { ...PURCHASE, stripeEventKey: 'cs_test_456' })
    const c = await issueReceipt(supabase, { ...PURCHASE, stripeEventKey: 'cs_test_789' })

    expect([a?.receiptNumber, b?.receiptNumber, c?.receiptNumber]).toEqual([
      'FF-26-4478',
      'FF-26-4479',
      'FF-26-4480',
    ])
  })

  it('starts the live series at FF-26-4478', async () => {
    // FF-26-4477 was the last number issued by hand before launch.
    const { supabase } = fakeIssueReceiptRpc()
    expect((await issueReceipt(supabase, PURCHASE))?.receiptNumber).toBe('FF-26-4478')
  })

  it('keys a renewal on its invoice, so it never collides with the checkout', async () => {
    const { supabase, state } = fakeIssueReceiptRpc()

    await issueReceipt(supabase, PURCHASE)
    const renewal = await issueReceipt(supabase, {
      ...PURCHASE,
      stripeEventKey: 'in_test_999',
      planKey: 'self_study_monthly',
      amountPence: 12900,
      kind: 'renewal',
    })

    expect(renewal?.receiptNumber).toBe('FF-26-4479')
    expect(state.allocations).toBe(2)
  })
})

describe('failures never take the webhook down with them', () => {
  it('returns null when the number could not be allocated', async () => {
    const supabase = { rpc: async () => ({ data: null, error: { message: 'boom' } }) } as never

    expect(await issueReceipt(supabase, PURCHASE)).toBeNull()
    expect(mocks.renderReceipt).not.toHaveBeenCalled()
  })

  it('returns null rather than throwing when the PDF will not render', async () => {
    // The number is issued and recorded either way — it is not reused, and the
    // row is the audit trail this can be re-rendered from by hand.
    mocks.renderReceipt.mockRejectedValue(new Error('font exploded'))
    const { supabase } = fakeIssueReceiptRpc()

    expect(await issueReceipt(supabase, PURCHASE)).toBeNull()
  })

  it('refuses to print a receipt for a plan it has no template for', async () => {
    const { supabase } = fakeIssueReceiptRpc()

    expect(await issueReceipt(supabase, { ...PURCHASE, planKey: 'intensive' as never })).toBeNull()
    expect(mocks.renderReceipt).not.toHaveBeenCalled()
  })
})

describe('what reaches the database', () => {
  it('passes the charge date, the period and the coaching day as separate fields', async () => {
    const { supabase, rpc } = fakeIssueReceiptRpc()

    await issueReceipt(supabase, {
      ...PURCHASE,
      planKey: 'self_study_monthly',
      periodStart: new Date('2026-08-27T10:30:00Z'),
      periodEnd: new Date('2026-09-27T10:30:00Z'),
    })

    const params = rpc.mock.calls[0][1]
    expect(params.p_paid_at).toBe('2026-08-27T10:30:00.000Z')
    expect(params.p_period_start).toBe('2026-08-27T10:30:00.000Z')
    expect(params.p_period_end).toBe('2026-09-27T10:30:00.000Z')
    // The coaching day is its own field and is never mistaken for the charge date.
    expect(params.p_coaching_day_label).toBe('Saturday 12 September 2026')
  })

  it('sends nulls, not undefined, for the fields a one-off plan does not have', async () => {
    const { supabase, rpc } = fakeIssueReceiptRpc()

    await issueReceipt(supabase, { ...PURCHASE, planKey: 'self_study', coachingDayLabel: null })

    const params = rpc.mock.calls[0][1]
    expect(params.p_period_start).toBeNull()
    expect(params.p_period_end).toBeNull()
    expect(params.p_coaching_day_label).toBeNull()
  })
})
