import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { Entitlement } from '@/lib/commerce/entitlements'

/**
 * GET /api/subscription: the booked coaching session as the dashboard reads it.
 * The entitlement fold itself is covered in lib/commerce/entitlements.test.ts;
 * this pins the wiring of `coachingDay` and `coachingSlot` into the response.
 */

const mocks = vi.hoisted(() => ({
  user: { id: 'user-1', email: 'buyer@nhs.net' } as { id: string; email: string } | null,
  entitlement: { state: 'active', hasLectures: true } as Entitlement,
}))

vi.mock('@/lib/commerce/serverEntitlement', () => ({
  getServerEntitlement: async () => ({
    user: mocks.user,
    entitlement: mocks.entitlement,
    allowed: mocks.entitlement.state === 'active',
    bypass: false,
    failedOpen: false,
    cohort: null,
    cohortOnly: false,
  }),
}))

const { GET } = await import('./route')

beforeEach(() => {
  mocks.user = { id: 'user-1', email: 'buyer@nhs.net' }
  mocks.entitlement = { state: 'active', hasLectures: true }
})

describe('GET /api/subscription coaching session', () => {
  it('returns the booked date and slot for a Complete customer', async () => {
    mocks.entitlement = {
      state: 'active',
      plan: 'complete',
      hasLectures: true,
      coachingDay: '2026-11-07',
      coachingSlot: 'afternoon',
    }

    const body = await (await GET()).json()

    expect(body).toMatchObject({ plan: 'complete', coachingDay: '2026-11-07', coachingSlot: 'afternoon' })
  })

  it('returns null for both when nothing is booked, or the plan has no session', async () => {
    mocks.entitlement = { state: 'active', plan: 'self_study', hasLectures: false }

    const body = await (await GET()).json()

    expect(body.coachingDay).toBeNull()
    expect(body.coachingSlot).toBeNull()
  })

  it('returns a legacy booking as a date with slot null', async () => {
    mocks.entitlement = {
      state: 'active',
      plan: 'complete',
      hasLectures: true,
      coachingDay: '2026-09-12',
      coachingSlot: null,
    }

    const body = await (await GET()).json()

    expect(body).toMatchObject({ coachingDay: '2026-09-12', coachingSlot: null })
  })

  it('answers 401 when nobody is signed in', async () => {
    mocks.user = null

    expect((await GET()).status).toBe(401)
  })
})
