import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  ACCESS_LAUNCH_DATE,
  NO_ENTITLEMENT,
  accessWindow,
  computeEntitlement,
  decideAccess,
  type AccessContext,
  type EntitlementRow,
} from './entitlements'
import { parseAdminEmails } from '@/lib/admin/guard'
import { ACCESS_OPENS } from './plans'

const row = (over: Partial<EntitlementRow>): EntitlementRow => ({
  plan: 'self_study',
  status: 'paid',
  created_at: '2026-09-05T10:00:00Z',
  ...over,
})

const DURING = new Date('2026-09-20T00:00:00Z')
const AFTER_PREORDER_WINDOW = new Date('2026-12-15T00:00:00Z')

afterEach(() => {
  vi.restoreAllMocks()
})

describe('accessWindow', () => {
  it('starts at purchase for post-launch buys and runs 3 calendar months', () => {
    const { start, end } = accessWindow('2026-09-05T10:00:00Z')
    expect(start.toISOString()).toBe('2026-09-05T10:00:00.000Z')
    expect(end.toISOString()).toBe('2026-12-04T23:59:59.999Z')
  })

  it('floors preorder-era buys at launch day', () => {
    const { start, end } = accessWindow('2026-07-28T09:00:00Z')
    expect(start).toEqual(ACCESS_LAUNCH_DATE)
    expect(end.toISOString()).toBe('2026-11-30T23:59:59.999Z')
  })

  it('takes launch day from the offer, so there is one source of truth', () => {
    expect(ACCESS_LAUNCH_DATE.toISOString()).toBe(`${ACCESS_OPENS}T00:00:00.000Z`)
  })

  it('clamps to the last day of a shorter month', () => {
    // 30 Nov + 3 months lands in February, which has no 30th: clamp to the 28th,
    // then the inclusive end is the day before that.
    expect(accessWindow('2026-11-30T09:00:00Z').end.toISOString()).toBe('2027-02-27T23:59:59.999Z')
  })

  it('grants 3 calendar months, not 3 months and a day', () => {
    // The preorder window is the one customers can count on a calendar:
    // 1 Sept -> the last instant of 30 Nov. An inclusive end on the same
    // day-of-month would hand out 92 days against a promise of three months.
    const { start, end } = accessWindow('2026-07-28T09:00:00Z')
    expect(start.toISOString()).toBe('2026-09-01T00:00:00.000Z')
    expect(end.toISOString()).toBe('2026-11-30T23:59:59.999Z')
    // Access ends the instant 1 Dec begins.
    expect(end.getTime() + 1).toBe(new Date('2026-12-01T00:00:00Z').getTime())
  })

  it('parses a Postgres-shaped timestamp', () => {
    const { start } = accessWindow('2026-09-05 09:00:00.123456+00')
    expect(start.toISOString()).toBe('2026-09-05T09:00:00.123Z')
  })
})

describe('computeEntitlement', () => {
  it('returns none with no purchases', () => {
    expect(computeEntitlement([], DURING).state).toBe('none')
  })

  it('never hands back the shared NO_ENTITLEMENT object', () => {
    const a = computeEntitlement([], DURING)
    const b = computeEntitlement([], DURING)
    expect(a).not.toBe(b)
    expect(a).not.toBe(NO_ENTITLEMENT)
    expect(Object.isFrozen(NO_ENTITLEMENT)).toBe(true)
  })

  it('self_study is active inside the window, without lectures', () => {
    const e = computeEntitlement([row({})], DURING)
    expect(e.state).toBe('active')
    expect(e.hasLectures).toBe(false)
    expect(e.expiresAt?.toISOString()).toBe('2026-12-04T23:59:59.999Z')
  })

  it('complete is active with lectures and its coaching day', () => {
    const e = computeEntitlement(
      [row({ plan: 'complete', coaching_day: '2026-09-20' })],
      DURING,
    )
    expect(e).toMatchObject({ state: 'active', hasLectures: true, coachingDay: '2026-09-20' })
  })

  it('preorder buy (Sarah) starts 1 Sept and runs to 1 Dec', () => {
    const e = computeEntitlement(
      [row({ plan: 'complete', created_at: '2026-07-28T09:00:00Z' })],
      DURING,
    )
    expect(e.state).toBe('active')
    expect(e.expiresAt?.toISOString()).toBe('2026-11-30T23:59:59.999Z')
  })

  it('goes read-only after the window ends', () => {
    const e = computeEntitlement([row({})], AFTER_PREORDER_WINDOW)
    expect(e.state).toBe('read_only')
    expect(e.hasLectures).toBe(false)
  })

  it('refunded rows grant nothing', () => {
    expect(computeEntitlement([row({ status: 'refunded' })], DURING).state).toBe('none')
  })

  it('a monthly buy before launch waits for launch day like every other plan', () => {
    // Founder ruling 21 Aug 2026: all plans activate on 1 Sept. The plan is
    // carried so the dashboard can say "you're in, access opens 1 September".
    const beforeLaunch = new Date(ACCESS_LAUNCH_DATE.getTime() - 1)
    const e = computeEntitlement([row({ plan: 'self_study_monthly' })], beforeLaunch)
    expect(e).toMatchObject({ state: 'none', plan: 'self_study_monthly', hasLectures: false })
    expect(computeEntitlement([row({ plan: 'self_study_monthly' })], ACCESS_LAUNCH_DATE).state).toBe('active')
  })

  it('monthly is active while paid, has no lectures and no expiry', () => {
    const e = computeEntitlement([row({ plan: 'self_study_monthly' })], DURING)
    expect(e).toMatchObject({ state: 'active', hasLectures: false })
    expect(e.expiresAt).toBeUndefined()
  })

  it('canceled monthly is read-only (Stripe ends it at period end)', () => {
    const e = computeEntitlement(
      [row({ plan: 'self_study_monthly', status: 'canceled' })],
      DURING,
    )
    expect(e.state).toBe('read_only')
  })

  it('an active row beats an expired one', () => {
    const e = computeEntitlement(
      [row({ created_at: '2026-09-05T10:00:00Z' }), row({ created_at: '2026-12-10T00:00:00Z' })],
      new Date('2026-12-20T00:00:00Z'),
    )
    expect(e.state).toBe('active')
    expect(e.expiresAt?.toISOString()).toBe('2027-03-09T23:59:59.999Z')
  })

  it('active complete beats active self_study regardless of order', () => {
    const a = computeEntitlement([row({}), row({ plan: 'complete' })], DURING)
    const b = computeEntitlement([row({ plan: 'complete' }), row({})], DURING)
    expect(a.hasLectures).toBe(true)
    expect(b.hasLectures).toBe(true)
  })

  // ── Finding 2: the window has a start, and it gates ──

  it('a preorder bought before launch grants nothing until launch day', () => {
    const e = computeEntitlement(
      [row({ plan: 'complete', created_at: '2026-07-28T09:00:00Z' })],
      new Date('2026-08-20T22:00:00Z'),
    )
    expect(e.state).toBe('none')
    expect(e.hasLectures).toBe(false)
    // The purchase is still known — callers can say when access opens and ends.
    expect(e.plan).toBe('complete')
    expect(e.expiresAt?.toISOString()).toBe('2026-11-30T23:59:59.999Z')
  })

  it('turns active the instant launch day arrives', () => {
    const rows = [row({ created_at: '2026-07-28T09:00:00Z' })]
    expect(computeEntitlement(rows, new Date(ACCESS_LAUNCH_DATE.getTime() - 1)).state).toBe('none')
    expect(computeEntitlement(rows, ACCESS_LAUNCH_DATE).state).toBe('active')
  })

  // ── Finding 9: multi-purchase resolution must not depend on row order ──

  it('the later end date wins between two live one-offs, in either order', () => {
    const early = row({ created_at: '2026-09-02T00:00:00Z' }) // ends 2 Dec
    const late = row({ created_at: '2026-11-01T00:00:00Z' }) // ends 1 Feb
    const forwards = computeEntitlement([early, late], new Date('2026-11-15T00:00:00Z'))
    const backwards = computeEntitlement([late, early], new Date('2026-11-15T00:00:00Z'))
    expect(forwards.expiresAt?.toISOString()).toBe('2027-01-31T23:59:59.999Z')
    expect(backwards.expiresAt?.toISOString()).toBe('2027-01-31T23:59:59.999Z')
  })

  it('a live monthly outranks a one-off that ends, in either order', () => {
    const oneOff = row({ created_at: '2026-09-05T10:00:00Z' })
    const monthly = row({ plan: 'self_study_monthly' })
    expect(computeEntitlement([oneOff, monthly], DURING).plan).toBe('self_study_monthly')
    expect(computeEntitlement([monthly, oneOff], DURING).plan).toBe('self_study_monthly')
  })

  // ── Finding 10: unknown plans must fail closed ──

  it('grants nothing for an unrecognised plan string, and says so', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {})
    const e = computeEntitlement([row({ plan: 'lectures_only_typo' })], DURING)
    expect(e.state).toBe('none')
    expect(e.plan).toBeUndefined()
    expect(spy).toHaveBeenCalled()
  })

  it('does not let an unknown plan mask a real purchase', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {})
    const e = computeEntitlement([row({ plan: 'lectures_only_typo' }), row({})], DURING)
    expect(e.state).toBe('active')
    expect(e.plan).toBe('self_study')
    expect(spy).toHaveBeenCalled()
  })

  // ── Finding 15: exact boundaries ──

  it('access runs to the last millisecond of the final day', () => {
    const rows = [row({})]
    const end = accessWindow('2026-09-05T10:00:00Z').end
    expect(computeEntitlement(rows, new Date(end.getTime() - 1)).state).toBe('active')
    expect(computeEntitlement(rows, end).state).toBe('active')
    expect(computeEntitlement(rows, new Date(end.getTime() + 1)).state).toBe('read_only')
  })

  it('handles a Postgres-shaped created_at', () => {
    const e = computeEntitlement([row({ created_at: '2026-09-05 09:00:00.123456+00' })], DURING)
    expect(e.state).toBe('active')
    expect(e.expiresAt?.toISOString()).toBe('2026-12-04T23:59:59.999Z')
  })

  // ── A bought-but-not-open-yet purchase must not be masked by a lapsed one ──
  //
  // `none` carrying a plan means "paid, window opens later" — a better position
  // than lapsed access, not a worse one. Ranking it under `read_only` (as a
  // single `none` rank did) let a spent purchase win the fold and report ITS
  // plan and ITS past expiry date for a customer who had just paid again.

  it('a pending preorder beats an expired one-off, in either order', () => {
    // Dates chosen to put the two states side by side rather than to describe a
    // real customer: pre-1-Sept the reachable version of this is the churned
    // monthly below. The rule being pinned is the precedence, not the calendar.
    const spent = row({ plan: 'self_study', created_at: '2027-01-01T00:00:00Z' }) // ends 31 Mar
    const pending = row({ plan: 'complete', created_at: '2027-06-01T00:00:00Z' }) // opens 1 Jun
    const now = new Date('2027-05-01T00:00:00Z')

    for (const rows of [
      [spent, pending],
      [pending, spent],
    ]) {
      const e = computeEntitlement(rows, now)
      expect(e.state).toBe('none')
      expect(e.plan).toBe('complete')
      expect(e.expiresAt?.toISOString()).toBe('2027-08-31T23:59:59.999Z')
    }
  })

  it('a pending preorder beats a churned monthly, in either order', () => {
    // The real launch-week case: a lapsed monthly subscriber pre-orders
    // Complete. Before the fix they were shown self_study_monthly, read-only.
    const churned = row({ plan: 'self_study_monthly', status: 'canceled' })
    const pending = row({ plan: 'complete', created_at: '2026-07-28T09:00:00Z' })
    const beforeLaunch = new Date('2026-08-20T22:00:00Z')

    for (const rows of [
      [churned, pending],
      [pending, churned],
    ]) {
      const e = computeEntitlement(rows, beforeLaunch)
      expect(e.state).toBe('none')
      expect(e.plan).toBe('complete')
      expect(e.expiresAt?.toISOString()).toBe('2026-11-30T23:59:59.999Z')
    }
  })

  it('still ranks a no-purchase none below a lapsed purchase', () => {
    // The fold's empty seed is also state 'none'. It carries no plan, and must
    // keep losing to every real row — including a spent one.
    const e = computeEntitlement([row({ created_at: '2026-09-05T10:00:00Z' })], AFTER_PREORDER_WINDOW)
    expect(e.state).toBe('read_only')
    expect(e.plan).toBe('self_study')
  })

  it('before launch, nothing is live — a paid monthly and a preorder both wait', () => {
    // Founder ruling 21 Aug 2026: all plans activate on launch day, so the old
    // "live access beats pending" scenario cannot exist pre-launch. Both rows
    // fold to the pending state, and a plan is still carried for the
    // "you're in, access opens 1 September" banner.
    const monthly = row({ plan: 'self_study_monthly' })
    const pending = row({ plan: 'complete', created_at: '2026-07-28T09:00:00Z' })
    const beforeLaunch = new Date('2026-08-20T22:00:00Z')
    for (const rows of [
      [monthly, pending],
      [pending, monthly],
    ]) {
      const e = computeEntitlement(rows, beforeLaunch)
      expect(e.state).toBe('none')
      expect(e.plan).toBeTruthy()
    }
    // And the moment launch arrives, live access exists again and wins outright.
    expect(computeEntitlement([monthly, pending], ACCESS_LAUNCH_DATE).state).toBe('active')
  })

  it('a refund does not cancel a second, live purchase', () => {
    const e = computeEntitlement(
      [row({ status: 'refunded', plan: 'complete' }), row({})],
      DURING,
    )
    expect(e.state).toBe('active')
    expect(e.plan).toBe('self_study')
  })


  it('a one-off row still mid-provisioning grants nothing', () => {
    // Only `paid` counts, so a buyer whose webhook has written `pending` is
    // told they have no plan rather than "we are setting you up". Pinned so
    // the copy question is a deliberate product call, not an accident.
    expect(computeEntitlement([row({ status: 'pending' })], DURING).state).toBe('none')
  })



  it('intensive is complete-tier: active with lectures and its coaching day', () => {
    const e = computeEntitlement(
      [row({ plan: 'intensive', coaching_day: '2026-09-20' })],
      DURING,
    )
    expect(e).toMatchObject({ state: 'active', hasLectures: true, coachingDay: '2026-09-20' })
  })

})

describe('decideAccess', () => {
  const ctx = (over: Partial<AccessContext> = {}): AccessContext => ({
    email: 'trainee@nhs.net',
    admins: new Set<string>(),
    now: DURING,
    ...over,
  })

  it('lets an active complete purchase practise', () => {
    const d = decideAccess([row({ plan: 'complete' })], ctx())
    expect(d).toMatchObject({ allowed: true, bypass: false })
    expect(d.entitlement.hasLectures).toBe(true)
  })

  it('lets an active monthly subscriber practise', () => {
    const d = decideAccess([row({ plan: 'self_study_monthly' })], ctx())
    expect(d.allowed).toBe(true)
    expect(d.entitlement.state).toBe('active')
  })

  it('blocks a canceled monthly subscriber, read-only', () => {
    const d = decideAccess([row({ plan: 'self_study_monthly', status: 'canceled' })], ctx())
    expect(d.allowed).toBe(false)
    expect(d.entitlement.state).toBe('read_only')
  })

  it('blocks an expired three-month purchase, read-only', () => {
    const d = decideAccess([row({})], ctx({ now: AFTER_PREORDER_WINDOW }))
    expect(d.allowed).toBe(false)
    expect(d.entitlement.state).toBe('read_only')
  })

  it('blocks a refunded purchase with nothing at all', () => {
    const d = decideAccess([row({ status: 'refunded' })], ctx())
    expect(d.allowed).toBe(false)
    expect(d.entitlement.state).toBe('none')
  })

  it('blocks a signed-in user who never bought', () => {
    expect(decideAccess([], ctx())).toMatchObject({ allowed: false, bypass: false })
  })

  it('bypasses for admins, however lapsed their purchases', () => {
    const d = decideAccess(
      [row({ status: 'refunded' })],
      ctx({ email: 'Owner@Fourteen.com', admins: new Set(['owner@fourteen.com']) }),
    )
    expect(d).toMatchObject({ allowed: true, bypass: true })
    // The bypass grants access without rewriting what was actually bought.
    expect(d.entitlement.state).toBe('none')
  })

  it('never bypasses for a non-admin, whatever the deployment', () => {
    expect(decideAccess([], ctx())).toMatchObject({ allowed: false, bypass: false })
  })

  it('opens a pre-launch purchase early when the launch date is brought forward', () => {
    const bought = { plan: 'self_study', status: 'paid', created_at: '2026-08-22T12:00:00Z' }
    const now = new Date('2026-08-23T12:00:00Z')
    expect(decideAccess([bought], ctx({ now })).entitlement.state).toBe('none')
    const early = decideAccess([bought], ctx({ now, launchDate: new Date('2026-08-22T00:00:00Z') }))
    expect(early.entitlement.state).toBe('active')
    expect(early.bypass).toBe(false)
    // The window still runs 3 calendar months from the (earlier) start.
    expect(early.entitlement.expiresAt?.toISOString()).toBe('2026-11-21T23:59:59.999Z')
  })

  it('does not treat a missing email as an admin match', () => {
    const d = decideAccess([], ctx({ email: null, admins: new Set(['owner@fourteen.com']) }))
    expect(d.allowed).toBe(false)
  })

  it('a blank admin entry would match a missing email — parseAdminEmails is what stops it', () => {
    // decideAccess normalizes a null email to ''. An allowlist that contained
    // '' would therefore hand an admin bypass to every account without an
    // email — this is the failure mode:
    expect(decideAccess([], ctx({ email: null, admins: new Set(['']) })).bypass).toBe(true)
    // ...and this is the `.filter(Boolean)` in parseAdminEmails preventing it.
    // ADMIN_EMAILS=',' is the shape that produces blanks (a stray comma, a
    // trailing separator), so the two are asserted together: neither half is
    // safe to change without the other.
    expect(parseAdminEmails(',').size).toBe(0)
    expect(
      decideAccess([], ctx({ email: null, admins: parseAdminEmails(', ,') })).allowed,
    ).toBe(false)
  })
})

