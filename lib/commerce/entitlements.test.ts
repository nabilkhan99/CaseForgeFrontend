import { describe, expect, it } from 'vitest'
import { parseAdminEmails } from '@/lib/admin/guard'
import {
  ACCESS_LAUNCH_DATE,
  accessWindow,
  computeEntitlement,
  decideAccess,
  type AccessContext,
  type EntitlementRow,
} from './entitlements'

const row = (over: Partial<EntitlementRow>): EntitlementRow => ({
  plan: 'self_study',
  status: 'paid',
  created_at: '2026-09-05T10:00:00Z',
  ...over,
})

const DURING = new Date('2026-09-20T00:00:00Z')
const AFTER_PREORDER_WINDOW = new Date('2026-12-15T00:00:00Z')
/** Before the 1 Sept launch — a preorder row's access window has not opened. */
const BEFORE_LAUNCH = new Date('2026-08-20T00:00:00Z')

describe('accessWindow', () => {
  it('starts at purchase for post-launch buys', () => {
    const { start, end } = accessWindow('2026-09-05T10:00:00Z')
    expect(start.toISOString()).toBe('2026-09-05T10:00:00.000Z')
    expect(end.toISOString()).toBe('2026-12-04T10:00:00.000Z')
  })

  it('floors preorder-era buys at launch day', () => {
    const { start } = accessWindow('2026-07-28T09:00:00Z')
    expect(start).toEqual(ACCESS_LAUNCH_DATE)
  })
})

describe('computeEntitlement', () => {
  it('returns none with no purchases', () => {
    expect(computeEntitlement([], DURING).state).toBe('none')
  })

  it('self_study is active inside the window, without lectures', () => {
    const e = computeEntitlement([row({})], DURING)
    expect(e.state).toBe('active')
    expect(e.hasLectures).toBe(false)
    expect(e.expiresAt?.toISOString()).toBe('2026-12-04T10:00:00.000Z')
  })

  it('complete is active with lectures and its coaching day', () => {
    const e = computeEntitlement(
      [row({ plan: 'complete', coaching_day: '2026-09-20' })],
      DURING,
    )
    expect(e).toMatchObject({ state: 'active', hasLectures: true, coachingDay: '2026-09-20' })
  })

  it('preorder buy (Sarah) starts 1 Sept and runs to 30 Nov', () => {
    const e = computeEntitlement(
      [row({ plan: 'complete', created_at: '2026-07-28T09:00:00Z' })],
      DURING,
    )
    expect(e.state).toBe('active')
    expect(e.expiresAt?.toISOString()).toBe('2026-11-30T00:00:00.000Z')
  })

  it('goes read-only after the window ends', () => {
    const e = computeEntitlement([row({})], AFTER_PREORDER_WINDOW)
    expect(e.state).toBe('read_only')
    expect(e.hasLectures).toBe(false)
  })

  it('refunded rows grant nothing', () => {
    expect(computeEntitlement([row({ status: 'refunded' })], DURING).state).toBe('none')
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

  it('a preorder row reads active before its window opens (CURRENT behaviour)', () => {
    // `accessWindow().start` floors preorder buys at 1 Sept, but entitlementOf
    // only tests `now >= end`, so today (20 Aug) a preorder buyer computes as
    // active twelve days before the advertised opening. Asserted as-is to pin
    // the status quo — the start-gate semantics land in a sibling branch, and
    // this expectation is what that change should flip.
    const e = computeEntitlement(
      [row({ plan: 'complete', created_at: '2026-07-28T09:00:00Z' })],
      BEFORE_LAUNCH,
    )
    expect(e.state).toBe('active')
    expect(accessWindow('2026-07-28T09:00:00Z').start > BEFORE_LAUNCH).toBe(true)
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
      [row({ created_at: '2026-03-01T00:00:00Z' }), row({})],
      DURING,
    )
    expect(e.state).toBe('active')
  })

  it('active complete beats active self_study regardless of order', () => {
    const a = computeEntitlement([row({}), row({ plan: 'complete' })], DURING)
    const b = computeEntitlement([row({ plan: 'complete' }), row({})], DURING)
    expect(a.hasLectures).toBe(true)
    expect(b.hasLectures).toBe(true)
  })
})

describe('decideAccess', () => {
  const ctx = (over: Partial<AccessContext> = {}): AccessContext => ({
    email: 'trainee@nhs.net',
    staged: false,
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

  it('bypasses for every signed-in tester on a staged deployment', () => {
    expect(decideAccess([], ctx({ staged: true }))).toMatchObject({ allowed: true, bypass: true })
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
