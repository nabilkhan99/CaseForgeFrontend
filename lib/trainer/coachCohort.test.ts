import { describe, expect, it } from 'vitest'
import type { SupabaseClient } from '@supabase/supabase-js'
import { createFakeSupabase } from '@/lib/testing/fakeSupabase'
import {
  COACH_NO_ACCOUNT_WARNING,
  coachCohortName,
  ensureCoachSeesStudent,
  studentNoAccountWarning,
} from './coachCohort'

/**
 * Saving a booking on /admin/coaching lets the coach see the student. Pinned:
 * one cohort per coach (the oldest, as the trainer guard reads it), both coach
 * and student as members, idempotence, and missing accounts as warnings.
 */

const COACH = 'hassankhan4@doctors.org.uk'
const STUDENT = 'student@example.com'

function db(extra: Record<string, Record<string, unknown>[]> = {}) {
  return createFakeSupabase({
    profiles: [
      { id: 'coach-id', email: 'HassanKhan4@doctors.org.uk' },
      { id: 'student-id', email: STUDENT },
    ],
    cohorts: [],
    cohort_members: [],
    ...extra,
  })
}

const asClient = (fake: ReturnType<typeof createFakeSupabase>) => fake as unknown as SupabaseClient

describe('ensureCoachSeesStudent', () => {
  it('creates the coach a cohort with no assigned cases when they have none', async () => {
    const fake = db()
    const result = await ensureCoachSeesStudent(asClient(fake), {
      coachEmail: 'HassanKhan4@Doctors.org.uk',
      coachName: 'Dr Hassan Khan',
      studentEmail: STUDENT,
    })
    expect(fake.tables.cohorts).toHaveLength(1)
    expect(fake.tables.cohorts[0]).toMatchObject({
      name: coachCohortName('Dr Hassan Khan'),
      trainer_email: COACH,
      station_ids: [],
    })
    expect(result).toEqual({ cohortId: fake.tables.cohorts[0].id, warnings: [] })
    expect(fake.tables.cohort_members.map((m) => m.user_id).sort()).toEqual(['coach-id', 'student-id'])
  })

  it('reuses the coach’s oldest cohort, the one their Students tab reads', async () => {
    const fake = db({
      cohorts: [
        { id: 'newer', trainer_email: COACH, created_at: '2026-09-20T00:00:00Z' },
        { id: 'oldest', trainer_email: COACH, created_at: '2026-09-01T00:00:00Z' },
      ],
    })
    const result = await ensureCoachSeesStudent(asClient(fake), {
      coachEmail: COACH,
      coachName: 'Dr Hassan Khan',
      studentEmail: STUDENT,
    })
    expect(result.cohortId).toBe('oldest')
    expect(fake.tables.cohorts).toHaveLength(2)
    expect(fake.tables.cohort_members.every((m) => m.cohort_id === 'oldest')).toBe(true)
  })

  it('is idempotent: saving twice adds nothing', async () => {
    const fake = db()
    const args = { coachEmail: COACH, coachName: 'Dr Hassan Khan', studentEmail: STUDENT }
    await ensureCoachSeesStudent(asClient(fake), args)
    await ensureCoachSeesStudent(asClient(fake), args)
    expect(fake.tables.cohorts).toHaveLength(1)
    expect(fake.tables.cohort_members).toHaveLength(2)
    const upsert = fake.calls.find((call) => call.table === 'cohort_members' && call.op === 'upsert')
    expect(upsert?.args[1]).toEqual({ onConflict: 'cohort_id,user_id', ignoreDuplicates: true })
  })

  it('warns, rather than fails, when an account does not exist yet', async () => {
    const fake = db({ profiles: [] })
    const result = await ensureCoachSeesStudent(asClient(fake), {
      coachEmail: COACH,
      coachName: 'Dr Hassan Khan',
      studentEmail: STUDENT,
    })
    expect(result.warnings).toEqual([COACH_NO_ACCOUNT_WARNING, studentNoAccountWarning(STUDENT)])
    expect(fake.tables.cohort_members).toHaveLength(0)
    expect(fake.tables.cohorts).toHaveLength(1)
  })

  it('throws on a database error instead of reporting a missing account', async () => {
    const fake = db()
    fake.failOn.profiles = { message: 'down' }
    await expect(
      ensureCoachSeesStudent(asClient(fake), {
        coachEmail: COACH,
        coachName: 'Dr Hassan Khan',
        studentEmail: STUDENT,
      }),
    ).rejects.toMatchObject({ message: 'down' })
  })
})
