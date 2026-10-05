import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { SupabaseClient } from '@supabase/supabase-js'
import { fakeDb, type FakeDb } from './caseVersionsFakeDb'

/**
 * The server half of the case-version rule: the reads the gates make, and the
 * answer they hand a route. The rule itself is pinned in caseVersions.test.ts;
 * this pins that the right facts reach it — the service-role station row, THIS
 * person's keeper rows, the live replacement — and that the today-shaped bank
 * (everything live, nothing replaced) costs nothing beyond the station read.
 */

vi.mock('server-only', () => ({}))
// lib/admin/guard imports the cookie-bound server client; only its pure
// parseAdminEmails is used here.
vi.mock('@/lib/supabase/server', () => ({ createClient: async () => ({}) }))

const {
  CASE_VERSION_REFUSED,
  CASE_VERSION_UNAVAILABLE,
  caseVersionGateFailure,
  caseVersionRefusalBody,
  gateStationRun,
  isAdminEmail,
  loadStationRunDecision,
  practiseStationIdFor,
  toVersionedStation,
} = await import('./caseVersionsServer')

// Bank: PLAIN (live, untouched), OLD1 → NEW1 (both switched), OLD2 archived
// with no live replacement, DRAFT (unreleased) replacing PLAIN2.
const STATIONS = [
  { id: 'PLAIN', lifecycle: 'live', replaces_station_id: null },
  { id: 'OLD1', lifecycle: 'archived', replaces_station_id: null },
  { id: 'NEW1', lifecycle: 'live', replaces_station_id: 'OLD1' },
  { id: 'OLD2', lifecycle: 'archived', replaces_station_id: null },
  { id: 'DRAFT', lifecycle: 'draft', replaces_station_id: 'PLAIN2' },
  { id: 'PLAIN2', lifecycle: 'live', replaces_station_id: null },
]

let db: FakeDb
const client = () => db.client as unknown as SupabaseClient
const station = (id: string) => toVersionedStation(STATIONS.find((s) => s.id === id)!)

const KEEPER = { userId: 'keeper', isAdmin: false }
const OTHER = { userId: 'other', isAdmin: false }
const ADMIN = { userId: 'admin', isAdmin: true }
const GUEST = { userId: null, isAdmin: false }

beforeEach(() => {
  db = fakeDb({
    stations: STATIONS,
    case_keepers: [
      { user_id: 'keeper', station_id: 'OLD1' },
      { user_id: 'keeper', station_id: 'OLD2' },
    ],
  })
  vi.spyOn(console, 'error').mockImplementation(() => {})
})

describe('gateStationRun', () => {
  it('opens a live case that replaces nothing, without reading keepers', async () => {
    // TODAY'S BANK. Every one of the 201 cases is this shape.
    expect(await gateStationRun(client(), station('PLAIN'), OTHER)).toEqual({ allowed: true })
    expect(db.reads).toEqual([])
  })

  it('refuses a keeper the replacement of the case they keep, pointing back at the old one', async () => {
    expect(await gateStationRun(client(), station('NEW1'), KEEPER)).toEqual({
      allowed: false,
      reason: 'replaced_for_keeper',
      message: 'You have the earlier version of this case in your library.',
      redirectStationId: 'OLD1',
    })
  })

  it('opens the replacement for everyone who does not keep the old case', async () => {
    expect(await gateStationRun(client(), station('NEW1'), OTHER)).toEqual({ allowed: true })
  })

  it('lets a keeper re-run the archived case they keep', async () => {
    expect(await gateStationRun(client(), station('OLD1'), KEEPER)).toEqual({ allowed: true })
  })

  it('refuses an archived case to a non-keeper, forwarding to its replacement', async () => {
    expect(await gateStationRun(client(), station('OLD1'), OTHER)).toEqual({
      allowed: false,
      reason: 'archived_not_kept',
      message: 'This case has been replaced by a newer version in your library.',
      redirectStationId: 'NEW1',
    })
  })

  it('refuses an archived case with no live replacement, with nowhere to forward', async () => {
    const gate = await gateStationRun(client(), station('OLD2'), OTHER)
    expect(gate).toMatchObject({ allowed: false, reason: 'archived_not_kept', redirectStationId: null })
  })

  it('reads only THIS person\'s keeper rows', async () => {
    // The service role reads every row, so the userId is the whole of the
    // scoping: someone else keeping OLD1 must not make it runnable for you.
    expect((await gateStationRun(client(), station('OLD1'), OTHER)).allowed).toBe(false)
  })

  it('refuses a draft to a non-admin, without reading anything', async () => {
    expect(await gateStationRun(client(), station('DRAFT'), KEEPER)).toEqual({
      allowed: false,
      reason: 'draft',
      message: 'This case is not available yet.',
      redirectStationId: null,
    })
    expect(db.reads).toEqual([])
  })

  it('opens anything to an admin, drafts included, without reading anything', async () => {
    for (const id of ['DRAFT', 'OLD1', 'NEW1', 'PLAIN']) {
      expect(await gateStationRun(client(), station(id), ADMIN)).toEqual({ allowed: true })
    }
    expect(db.reads).toEqual([])
  })

  it('treats a signed-out viewer as keeping nothing', async () => {
    expect((await gateStationRun(client(), station('OLD1'), GUEST)).allowed).toBe(false)
    expect(await gateStationRun(client(), station('NEW1'), GUEST)).toEqual({ allowed: true })
    expect(db.reads).not.toContain('case_keepers')
  })

  it('answers try-again, never a guess, when the keeper read errors', async () => {
    // "Keeps nothing" would refuse a keeper their own old case and open the
    // replacement they must never see. A gate cannot guess either way.
    db.failing.add('case_keepers')
    const unavailable = {
      allowed: false,
      unavailable: true,
      message: 'Could not check this case just now. Try again in a moment.',
    }
    expect(await gateStationRun(client(), station('OLD1'), KEEPER)).toEqual(unavailable)
    expect(await gateStationRun(client(), station('NEW1'), KEEPER)).toEqual(unavailable)
    expect(await gateStationRun(client(), station('NEW1'), OTHER)).toEqual(unavailable)
  })

  it('still answers a plain live case with no keeper read, so a keeper outage cannot block today\'s bank', async () => {
    db.failing.add('case_keepers')
    expect(await gateStationRun(client(), station('PLAIN'), KEEPER)).toEqual({ allowed: true })
    // A draft needs no keeper read either: refused to every non-admin.
    expect((await gateStationRun(client(), station('DRAFT'), KEEPER)).allowed).toBe(false)
  })
})

describe('toVersionedStation', () => {
  it('reads an unknown lifecycle as a draft: admins only, never everyone', () => {
    expect(toVersionedStation({ id: 'x', lifecycle: 'published' }).lifecycle).toBe('draft')
    expect(toVersionedStation({ id: 'x' })).toEqual({ id: 'x', lifecycle: 'draft', replaces_station_id: null })
  })
})

describe('loadStationRunDecision', () => {
  it('loads the row with the service role and gates it', async () => {
    const lookup = await loadStationRunDecision(client(), 'OLD1', OTHER)
    expect(lookup).toMatchObject({ found: true, gate: { allowed: false, redirectStationId: 'NEW1' } })
  })

  it('answers an unknown id as not found', async () => {
    expect(await loadStationRunDecision(client(), 'nope', OTHER)).toEqual({ found: false, failed: false })
  })

  it('reports a failed read as a failure, not as "not found"', async () => {
    db.failing.add('stations')
    expect(await loadStationRunDecision(client(), 'PLAIN', OTHER)).toEqual({ found: false, failed: true })
  })

  it('costs exactly one read for today\'s bank', async () => {
    await loadStationRunDecision(client(), 'PLAIN', KEEPER)
    expect(db.reads).toEqual(['stations'])
  })
})

describe('practiseStationIdFor', () => {
  it('is the case itself when the viewer may run it', async () => {
    expect(await practiseStationIdFor(client(), station('PLAIN'), OTHER)).toBe('PLAIN')
    expect(await practiseStationIdFor(client(), station('OLD1'), KEEPER)).toBe('OLD1')
  })

  it('is the replacement for a non-keeper of an archived case', async () => {
    expect(await practiseStationIdFor(client(), station('OLD1'), OTHER)).toBe('NEW1')
  })

  it('falls back to the case itself when there is nothing better', async () => {
    expect(await practiseStationIdFor(client(), station('OLD2'), OTHER)).toBe('OLD2')
  })

  it('falls back to the case itself when the keeper read errors', async () => {
    db.failing.add('case_keepers')
    expect(await practiseStationIdFor(client(), station('OLD1'), OTHER)).toBe('OLD1')
  })
})

describe('caseVersionRefusalBody', () => {
  it('carries the sentence, the code and the forward', () => {
    expect(
      caseVersionRefusalBody({
        allowed: false,
        reason: 'archived_not_kept',
        message: 'm',
        redirectStationId: 'NEW1',
      }),
    ).toEqual({ error: 'm', code: CASE_VERSION_REFUSED, reason: 'archived_not_kept', redirectStationId: 'NEW1' })
  })

  it('omits the forward when there is none', () => {
    expect(
      caseVersionRefusalBody({ allowed: false, reason: 'draft', message: 'm', redirectStationId: null }),
    ).not.toHaveProperty('redirectStationId')
  })
})

describe('caseVersionGateFailure', () => {
  it('is a 403 with the refusal body for a refusal', () => {
    expect(
      caseVersionGateFailure({ allowed: false, reason: 'draft', message: 'm', redirectStationId: null }),
    ).toEqual({ status: 403, body: { error: 'm', code: CASE_VERSION_REFUSED, reason: 'draft' } })
  })

  it('is a 503 try-again when the rule could not be checked', () => {
    expect(caseVersionGateFailure({ allowed: false, unavailable: true, message: 'm' })).toEqual({
      status: 503,
      body: { error: 'm', code: CASE_VERSION_UNAVAILABLE },
    })
  })
})

describe('isAdminEmail', () => {
  const original = process.env.ADMIN_EMAILS
  afterEach(() => {
    process.env.ADMIN_EMAILS = original
  })

  it('matches the allowlist case-insensitively and fails closed', () => {
    process.env.ADMIN_EMAILS = 'boss@example.com, other@example.com'
    expect(isAdminEmail(' Boss@Example.com ')).toBe(true)
    expect(isAdminEmail('gp@example.com')).toBe(false)
    expect(isAdminEmail(undefined)).toBe(false)
    process.env.ADMIN_EMAILS = ''
    expect(isAdminEmail('boss@example.com')).toBe(false)
  })
})
