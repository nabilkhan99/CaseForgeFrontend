/**
 * Pure view model for an advocate's own referral tracker.
 *
 * Imports nothing (no Supabase / next / crypto) so it is trivially unit-testable
 * and safe from a server component. Sibling of referralStats.ts, which answers
 * the founders' question ("what do we owe, across everyone?"); this answers the
 * advocate's ("where has my link got to, and when do I get paid?").
 *
 * Money is pence. Every value returned is a fresh snapshot.
 */

import { planLabel } from './plans'
import { payableFrom } from './referrals'

/** One attributed purchase, as the advocate's own tracker shows it. */
export interface AdvocateReferralRow {
  referee_email: string
  plan: string
  reward_amount: number
  status: 'pending' | 'qualified' | 'paid' | 'void'
  void_reason: string | null
  created_at: string
  paid_at: string | null
}

/** Where one referral has got to, in the advocate's language. */
export type ProgressStage = 'confirming' | 'ready' | 'paid' | 'void'

export interface ProgressItem {
  /** Referee address in full: the tracker is private to its own advocate. */
  who: string
  /** Human plan name. */
  what: string
  amount: number
  stage: ProgressStage
  /** Why a void referral fell through, in plain words. Null unless void. */
  voidLabel: string | null
  /** ISO date this becomes payable — null once it already is (or is paid). */
  payableFrom: string | null
  joinedAt: string
}

export interface AdvocateProgress {
  clicks: number
  /** Referrals that still count — void ones are excluded throughout. */
  signups: number
  /** pending + qualified + paid reward. What they will end up with. */
  earnedPence: number
  /** Already in their bank. */
  paidPence: number
  /** Earned but not yet sent. */
  outstandingPence: number
  items: readonly ProgressItem[]
  /** How many of `items` are void. They count towards no money figure. */
  didNotQualify: number
}

/**
 * Why a referral fell through, in words an advocate can act on. A refund is the
 * one an advocate genuinely needs to see: their friend bought and changed their
 * mind, which explains the money disappearing far better than silence does.
 * The fraud reasons are deliberately not spelled out.
 */
const VOID_LABELS: Record<string, string> = {
  refunded: 'Refunded',
  self_referral: 'Not eligible',
  below_min_spend: 'Not eligible',
}

function stageFor(status: AdvocateReferralRow['status']): ProgressStage {
  if (status === 'void') return 'void'
  if (status === 'paid') return 'paid'
  if (status === 'qualified') return 'ready'
  return 'confirming'
}

/**
 * Build the advocate's progress view.
 *
 * `clicks` comes from the code row rather than being derived, because a click
 * that never converted still happened and is the earliest signal an advocate
 * gets that their link is alive — often the only thing on the page for days.
 */
export function buildAdvocateProgress(
  clicks: number,
  referrals: readonly AdvocateReferralRow[],
): AdvocateProgress {
  const live = referrals.filter((r) => r.status !== 'void')
  // Void referrals ARE listed (founder decision 2026-08-21: a refund vanishing
  // without explanation is worse than seeing it), but they count towards nothing.
  const items = referrals
    .map((r) => {
      const stage = stageFor(r.status)
      return {
        who: r.referee_email,
        what: planLabel(r.plan),
        amount: r.reward_amount,
        stage,
        voidLabel: stage === 'void' ? (VOID_LABELS[r.void_reason ?? ''] ?? 'Didn\u2019t qualify') : null,
        payableFrom: stage === 'confirming' ? payableFrom(new Date(r.created_at)).toISOString() : null,
        joinedAt: r.created_at,
      }
    })
    // Newest first: the thing that just happened is the thing they came to see.
    .sort((a, b) => new Date(b.joinedAt).getTime() - new Date(a.joinedAt).getTime())

  const earnedPence = live.reduce((t, r) => t + r.reward_amount, 0)
  const paidPence = live.filter((r) => r.status === 'paid').reduce((t, r) => t + r.reward_amount, 0)

  return {
    clicks,
    signups: live.length,
    earnedPence,
    paidPence,
    outstandingPence: earnedPence - paidPence,
    items,
    didNotQualify: referrals.length - live.length,
  }
}
