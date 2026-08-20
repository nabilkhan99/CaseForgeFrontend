import { describe, expect, it } from 'vitest'
import { payoutReason } from './payoutReadyEmail'

describe('payoutReason', () => {
  it('thanks the sharer for the referral', () => {
    expect(payoutReason('referrer')).toContain('through your referral link')
  })

  it('explains to the buyer why they are being paid at all', () => {
    // The buyer never set out to earn anything — an unexplained "your £100 is
    // ready" reads as a scam, so the reason must say how they earned it.
    const reason = payoutReason('referee')
    expect(reason).toContain("friend's referral link")
    expect(reason).toContain('earns you a cash reward')
  })

  it('gives the two sides different explanations', () => {
    expect(payoutReason('referrer')).not.toBe(payoutReason('referee'))
  })
})
