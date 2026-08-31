import 'server-only'
import type { SupabaseClient } from '@supabase/supabase-js'
import { renderReceipt, type RenderedReceipt } from './renderReceipt'
import {
  isReceiptPlanKey,
  type PaymentMethodLabel,
  type ReceiptPlanKey,
} from './receiptContent'

/**
 * Issue a receipt for a payment: allocate its number, record it, render the PDF.
 *
 * Allocation and rendering are deliberately in this order and deliberately not
 * in one transaction. `issue_receipt` is a single autocommit RPC that holds a
 * row lock on the receipt counter for its duration, so every other payment in
 * flight queues behind it — the PDF render (~50ms, but unbounded in principle)
 * must happen after that lock is gone, never inside it.
 *
 * The PDF is rendered from the values the DATABASE returned, not from the
 * arguments passed in. On a Stripe retry the RPC hands back the row it wrote
 * the first time, so the reprint is identical down to the payment date — which
 * is what "no renumbering after issue" has to mean in practice.
 *
 * Best-effort by contract: every failure returns null and logs. A receipt that
 * cannot be produced must never fail the Stripe webhook, because the webhook
 * failing means the whole purchase is re-processed.
 */

export type ReceiptKind = 'purchase' | 'renewal'

export interface IssueReceiptArgs {
  /**
   * The Stripe object that caused this charge, and the idempotency key: the
   * checkout session id for a purchase, the invoice id for a renewal. A retry
   * with the same key returns the same receipt number.
   */
  stripeEventKey: string
  preorderId: string | null
  email: string
  customerName: string | null
  planKey: ReceiptPlanKey
  amountPence: number
  currency: string
  paymentMethod: PaymentMethodLabel
  /** The CHARGE date. Not the coaching day. */
  paidAt: Date
  /** Rolling plan only. */
  periodStart?: Date | null
  periodEnd?: Date | null
  /** Complete only: "Saturday 12 September 2026". */
  coachingDayLabel?: string | null
  kind: ReceiptKind
}

/** The `public.receipts` row as `issue_receipt` returns it. */
interface ReceiptRow {
  id: string
  receipt_number: string
  plan: string
  amount_pence: number
  customer_name: string | null
  payment_method: string
  paid_at: string
  period_start: string | null
  period_end: string | null
  coaching_day_label: string | null
}

export interface IssuedReceipt extends RenderedReceipt {
  receiptNumber: string
  /** The billing period end, for the email's renewal line. Rolling plan only. */
  periodEnd: Date | null
}

type ReceiptAdmin = Pick<SupabaseClient, 'rpc'>

export async function issueReceipt(
  supabase: ReceiptAdmin,
  args: IssueReceiptArgs,
): Promise<IssuedReceipt | null> {
  // supabase-js normally reports failures in `error`, but a transport-level
  // fault can still reject. This runs while the caller holds the send claim, so
  // an escaping throw would strand the buyer — see provisionBuyer.
  let data: unknown
  let error: unknown
  try {
    ({ data, error } = await supabase.rpc('issue_receipt', {
      p_stripe_event_key: args.stripeEventKey,
      p_preorder_id: args.preorderId,
      p_email: args.email,
      p_customer_name: args.customerName,
      p_plan: args.planKey,
      p_amount_pence: args.amountPence,
      p_currency: args.currency,
      p_payment_method: args.paymentMethod,
      p_paid_at: args.paidAt.toISOString(),
      p_period_start: args.periodStart?.toISOString() ?? null,
      p_period_end: args.periodEnd?.toISOString() ?? null,
      p_coaching_day_label: args.coachingDayLabel ?? null,
      p_kind: args.kind,
    }))
  } catch (thrown: unknown) {
    error = thrown
  }

  if (error || !data) {
    console.error('[receipt] could not allocate a receipt number', {
      stripeEventKey: args.stripeEventKey,
      error,
    })
    return null
  }

  const row = data as ReceiptRow

  // The row is the record of what was true when the money moved. If its plan is
  // somehow not one we can render, say so rather than printing a wrong receipt.
  if (!isReceiptPlanKey(row.plan)) {
    console.error('[receipt] issued row carries a plan with no receipt template', {
      receiptNumber: row.receipt_number,
      plan: row.plan,
    })
    return null
  }

  try {
    const periodEnd = row.period_end ? new Date(row.period_end) : null
    const rendered = await renderReceipt({
      planKey: row.plan,
      receiptNumber: row.receipt_number,
      paidAt: new Date(row.paid_at),
      customerName: row.customer_name ?? '',
      paymentMethod: row.payment_method === 'Bank transfer' ? 'Bank transfer' : 'Card',
      amountPence: row.amount_pence,
      coachingDayLabel: row.coaching_day_label,
      periodStart: row.period_start ? new Date(row.period_start) : null,
      periodEnd,
    })
    return { ...rendered, receiptNumber: row.receipt_number, periodEnd }
  } catch (error: unknown) {
    // The number is issued and recorded either way. It is not reused, and the
    // row is the audit trail — this receipt can be re-rendered by hand from it.
    console.error('[receipt] number issued but the PDF would not render', {
      receiptNumber: row.receipt_number,
      error,
    })
    return null
  }
}
