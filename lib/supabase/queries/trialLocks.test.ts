import { describe, expect, it } from 'vitest'
import { markTrialLocks, type Station } from './station-library'
import { isStationLockedForTrial, trialStationAllowlist } from '@/hooks/useTrialStatus'
import type { TrialSubscription } from '@/app/api/subscription/route'

/**
 * How a trial account's locks reach the library.
 *
 * MARKED, NEVER FILTERED. The locked cases stay in the array and on the board
 * because the brief page behind each of them is where the upsell lives — hiding
 * the bank from the person we are trying to sell it to would be the opposite of
 * the point. So the interesting properties are about the marking, and about the
 * one asymmetry that decides whether anybody sees a lock at all: null means "no
 * limit", an empty list means "nothing is open", and the two arrive from very
 * different places.
 */

function station(id: string): Station {
  return {
    id,
    title: `Case ${id}`,
    patient_name: 'A Patient',
    domain_id: 'd1',
    domain_name: 'Cardiovascular',
    consultation_duration_seconds: 720,
    difficulty: 'intermediate',
    is_active: true,
    presenting_complaint: '',
    status: 'not-started',
    attempts: [],
    passed: false,
    bestVerdict: null,
    bestScore: null,
    bestMaxScore: null,
    lockedForTrial: false,
  }
}

const BANK = ['st-1', 'st-2', 'st-3', 'st-99'].map(station)
const FIVE = ['st-1', 'st-2', 'st-3']

function trial(over: Partial<TrialSubscription> = {}): TrialSubscription {
  return {
    state: 'trial',
    freeStationIds: FIVE,
    casesTried: 1,
    attemptsByStation: { 'st-1': 2 },
    attemptsUnlimited: true,
    daysLeft: 3,
    used: 1,
    remaining: 2,
    allowance: 3,
    windowDays: 5,
    startedAt: '2026-09-08T09:00:00Z',
    expiresAt: '2026-09-13T09:00:00Z',
    reason: null,
    examHint: null,
    ...over,
  }
}

describe('markTrialLocks', () => {
  it('locks everything outside the five and nothing inside it', () => {
    const marked = markTrialLocks(BANK, FIVE)
    expect(marked.filter((s) => s.lockedForTrial).map((s) => s.id)).toEqual(['st-99'])
  })

  it('keeps every case in the array', () => {
    // The locked rows are the upsell. Filtering them out would hide the bank
    // from the only person who might buy it.
    expect(markTrialLocks(BANK, FIVE)).toHaveLength(BANK.length)
  })

  it('does not mutate the stations it was given', () => {
    const bank = [station('st-99')]
    markTrialLocks(bank, FIVE)
    expect(bank[0].lockedForTrial).toBe(false)
  })

  it('leaves the bank untouched when there is no trial limit', () => {
    // null is both "not a trial account" and "the answer has not arrived", and
    // both must draw nothing: a paying customer never sees 195 of their 200
    // cases flash as locked while a fetch resolves.
    expect(markTrialLocks(BANK, null)).toBe(BANK)
  })

  it('locks EVERY case when the flagged list is empty', () => {
    // An empty list is not null. It is what an unapplied migration, an unset
    // flag and a failed lookup all produce — and it is exactly what the server
    // is enforcing, so the board has to say so.
    expect(markTrialLocks(BANK, []).every((s) => s.lockedForTrial)).toBe(true)
  })
})

describe('trialStationAllowlist', () => {
  it('is the five while the trial is live', () => {
    expect(trialStationAllowlist(trial())).toEqual(FIVE)
  })

  it('is null for everybody who is not on a trial', () => {
    expect(trialStationAllowlist(null)).toBeNull()
  })

  it('is null once the trial has ended, rather than an empty list', () => {
    // Deliberate: every case is locked at that point, the dashboard's wall says
    // so in sentences, and dashing out two hundred squares underneath it would
    // be the same message delivered as a graveyard. The middleware bounces them
    // off /clinical-master regardless, so nothing is un-gated by this.
    expect(trialStationAllowlist(trial({ state: 'trial_ended', reason: 'expiry' }))).toBeNull()
  })
})

describe('isStationLockedForTrial', () => {
  it('agrees with the server about which cases open', () => {
    expect(isStationLockedForTrial(FIVE, 'st-2')).toBe(false)
    expect(isStationLockedForTrial(FIVE, 'st-99')).toBe(true)
  })

  it('locks nothing when there is no limit', () => {
    expect(isStationLockedForTrial(null, 'st-99')).toBe(false)
  })

  it('locks everything when the list is empty', () => {
    expect(isStationLockedForTrial([], 'st-1')).toBe(true)
  })
})
