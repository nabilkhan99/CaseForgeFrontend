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

import { payableFrom } from './referrals'

/** One attributed purchase, as much of it as an advocate may see. */
export interface AdvocateReferralRow {
  referee_email: string
  plan: string
  reward_amount: number
  status: 'pending' | 'qualified' | 'paid' | 'void'
  created_at: string
  paid_at: string | null
}

/** Where one referral has got to, in the advocate's language. */
export type ProgressStage = 'confirming' | 'ready' | 'paid'

export interface ProgressItem {
  /** Masked referee address: enough for the advocate, opaque to a stranger. */
  who: string
  /** Human plan name. */
  what: string
  amount: number
  stage: ProgressStage
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
  /** Void referrals are surfaced as a count only, never itemised. */
  didNotQualify: number
}

const PLAN_LABELS: Record<string, string> = {
  complete: 'Complete SCA Course',
  self_study: 'Self-Study',
  self_study_monthly: 'Self-Study, monthly',
}

/**
 * Mask an email to first character + domain: `alex@nhs.net` -> `a••@nhs.net`.
 * The advocate knows who they referred, so a hint is enough to tell two apart;
 * anyone who came by the link some other way learns nothing usable.
 */
export function maskEmail(email: string): string {
  const at = email.indexOf('@')
  if (at <= 0) return '••'
  return `${email[0]}••${email.slice(at)}`
}

/** Stage for a row. Void rows never reach here — they are filtered out first. */
function stageFor(status: AdvocateReferralRow['status']): ProgressStage {
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
  const items = live
    .map((r) => {
      const stage = stageFor(r.status)
      return {
        who: maskEmail(r.referee_email),
        what: PLAN_LABELS[r.plan] ?? r.plan,
        amount: r.reward_amount,
        stage,
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
