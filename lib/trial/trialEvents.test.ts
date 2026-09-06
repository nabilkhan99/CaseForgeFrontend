import { describe, expect, it } from 'vitest'
import { doorForSource, type TrialDoor } from './trialEvents'
import type { TrialSource } from '@/lib/commerce/trialAccess'

/**
 * The trial's two vocabularies for "which door" are different strings, fixed
 * independently: `trial_grants.source` by the build plan's data contract (and a
 * CHECK constraint), the `door` event property by the handoff's analytics
 * table. This is the only place they meet, so it is the only place the mapping
 * can rot.
 */
describe('doorForSource', () => {
  const SOURCES: TrialSource[] = ['signup', 'guest_reveal', 'link', 'cohort']

  it('maps every source the column allows', () => {
    const doors = SOURCES.map(doorForSource)
    expect(doors).toEqual<TrialDoor[]>(['free', 'guest', 'invite', 'cohort'])
  })

  it('is injective, so a funnel breakdown never merges two doors', () => {
    expect(new Set(SOURCES.map(doorForSource)).size).toBe(SOURCES.length)
  })
})
