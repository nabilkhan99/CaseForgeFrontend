import { describe, expect, it } from 'vitest'
import { buildAdvocateProgress, type AdvocateReferralRow } from './advocateProgress'
import { PAYOUT_FLOOR_DATE } from './referrals'

const row = (over: Partial<AdvocateReferralRow> = {}): AdvocateReferralRow => ({
  referee_email: 'friend@example.com',
  plan: 'complete',
  reward_amount: 10000,
  status: 'pending',
  void_reason: null,
  created_at: '2026-09-10T09:00:00.000Z',
  paid_at: null,
  ...over,
})

describe('buildAdvocateProgress', () => {
  it('reads as a promise, not an error, when nothing has happened yet', () => {
    const p = buildAdvocateProgress(0, [])
    expect(p).toMatchObject({ clicks: 0, signups: 0, earnedPence: 0, paidPence: 0, outstandingPence: 0, didNotQualify: 0 })
    expect(p.items).toEqual([])
  })

  it('shows clicks before there is any signup to show', () => {
    // The usual state for days: the link is alive, nobody has bought yet.
    expect(buildAdvocateProgress(7, [])).toMatchObject({ clicks: 7, signups: 0, earnedPence: 0 })
  })

  it('splits earned into paid and outstanding', () => {
    const p = buildAdvocateProgress(20, [
      row({ status: 'paid', reward_amount: 10000, paid_at: '2026-09-20T00:00:00.000Z' }),
      row({ status: 'qualified', reward_amount: 5000, plan: 'self_study' }),
      row({ status: 'pending', reward_amount: 5000, plan: 'self_study_monthly' }),
    ])
    expect(p.signups).toBe(3)
    expect(p.earnedPence).toBe(20000)
    expect(p.paidPence).toBe(10000)
    expect(p.outstandingPence).toBe(10000)
  })

  it('translates status into stages an advocate understands', () => {
    const p = buildAdvocateProgress(0, [
      row({ status: 'pending', created_at: '2026-09-01T00:00:00.000Z' }),
      row({ status: 'qualified', created_at: '2026-09-02T00:00:00.000Z' }),
      row({ status: 'paid', created_at: '2026-09-03T00:00:00.000Z' }),
    ])
    expect(p.items.map((i) => i.stage)).toEqual(['paid', 'ready', 'confirming'])
  })

  it('dates only the ones still confirming', () => {
    const p = buildAdvocateProgress(0, [
      row({ status: 'pending', created_at: '2026-09-10T09:00:00.000Z' }),
      row({ status: 'qualified' }),
    ])
    const confirming = p.items.find((i) => i.stage === 'confirming')
    expect(confirming?.payableFrom).toBe('2026-09-15T09:00:00.000Z')
    expect(p.items.find((i) => i.stage === 'ready')?.payableFrom).toBeNull()
  })

  it('floors the payable date at launch for a pre-launch referral', () => {
    const p = buildAdvocateProgress(0, [row({ created_at: '2026-08-21T00:00:00.000Z' })])
    expect(p.items[0].payableFrom).toBe(PAYOUT_FLOOR_DATE.toISOString())
  })

  it('lists void referrals but counts them towards nothing', () => {
    const p = buildAdvocateProgress(5, [
      row({ status: 'qualified', reward_amount: 10000 }),
      row({ status: 'void', reward_amount: 10000, void_reason: 'refunded' }),
      row({ status: 'void', reward_amount: 5000, void_reason: 'refunded' }),
    ])
    expect(p.signups).toBe(1)
    expect(p.earnedPence).toBe(10000)
    expect(p.items).toHaveLength(3) // all visible
    expect(p.didNotQualify).toBe(2)
  })

  it('says WHY a referral fell through, so a refund is not a silent vanishing', () => {
    const p = buildAdvocateProgress(0, [
      row({ status: 'void', void_reason: 'refunded' }),
      row({ status: 'void', void_reason: 'self_referral', created_at: '2026-09-09T00:00:00.000Z' }),
      row({ status: 'void', void_reason: null, created_at: '2026-09-08T00:00:00.000Z' }),
    ])
    expect(p.items.map((i) => i.voidLabel)).toEqual(['Refunded', 'Not eligible', 'Didn\u2019t qualify'])
  })

  it('leaves voidLabel null on referrals that are still alive', () => {
    const p = buildAdvocateProgress(0, [row({ status: 'qualified' })])
    expect(p.items[0].voidLabel).toBeNull()
  })

  it('shows the referee in full, since the tracker is private to its advocate', () => {
    const p = buildAdvocateProgress(0, [row({ referee_email: 'sarah.jones@nhs.net' })])
    expect(p.items[0].who).toBe('sarah.jones@nhs.net')
  })

  it('names plans the way the site does, and passes unknown ones through', () => {
    const p = buildAdvocateProgress(0, [
      row({ plan: 'complete' }),
      row({ plan: 'self_study', created_at: '2026-09-09T00:00:00.000Z' }),
      row({ plan: 'self_study_monthly', created_at: '2026-09-08T00:00:00.000Z' }),
      row({ plan: 'mystery', created_at: '2026-09-07T00:00:00.000Z' }),
    ])
    expect(p.items.map((i) => i.what)).toEqual([
      'Complete SCA Course',
      'Self-Study',
      'Self-Study, monthly',
      'mystery',
    ])
  })


})
