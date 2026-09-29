import type { SupabaseClient } from '@supabase/supabase-js'
import { COACHING_SLOT_ORDER, isCoachingSlotKey, type CoachingSlotKey } from './coachingSlots'
import { parseCoachEmail } from './coachingJoin'
import { findUserIdByEmail } from '@/lib/trainer/coachCohort'

/**
 * The admin view of booked one to one coaching sessions (/admin/coaching):
 * which bookings exist, who is coaching each, the joining link, whether the
 * confirmation went out, and whether the coach can see the student yet.
 *
 * Shared by the three /api/admin/coaching routes, which may only export
 * handlers (a value export from a route.ts fails `next build`).
 */

export interface AdminCoachingBooking {
  orderId: string
  email: string
  fullName: string | null
  day: string
  slot: CoachingSlotKey | null
  coachName: string | null
  coachEmail: string | null
  meetingUrl: string | null
  detailsSentAt: string | null
  studentHasAccount: boolean
  /** The student is a member of the cohort whose trainer_email is coachEmail. */
  coachSeesStudent: boolean
}

export interface CoachingOrderRow {
  id: string
  email: string
  full_name: string | null
  plan: string
  status: string
  coaching_day: string | null
  coaching_slot: string | null
  coaching_meeting_url: string | null
  coaching_coach_name: string | null
  coaching_coach_email: string | null
  coaching_details_sent_at: string | null
}

export const COACHING_ORDER_COLUMNS =
  'id, email, full_name, plan, status, coaching_day, coaching_slot, coaching_meeting_url, coaching_coach_name, coaching_coach_email, coaching_details_sent_at'

/** The details saved but the cohort link did not; saving again is the fix. */
export const LINK_FAILED_WARNING =
  'Saved, but the coach could not be linked to this student. Try saving again.'

/** How far back the list reaches, so a session just gone is still there to check. */
export const PAST_WINDOW_DAYS = 7

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export function isUuid(value: unknown): value is string {
  return typeof value === 'string' && UUID.test(value)
}

/** Today's calendar date in London, as YYYY-MM-DD. Coaching dates are London dates. */
export function londonToday(now: Date = new Date()): string {
  // en-CA formats as YYYY-MM-DD.
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Europe/London',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(now)
}

/** The earliest coaching_day the list shows. */
export function coachingListCutoff(now: Date = new Date()): string {
  const [y, m, d] = londonToday(now).split('-').map(Number)
  return new Date(Date.UTC(y, m - 1, d - PAST_WINDOW_DAYS)).toISOString().slice(0, 10)
}

/** A row that is a real coaching booking: paid Complete with a date. */
export function isCoachingBooking(row: Pick<CoachingOrderRow, 'plan' | 'status' | 'coaching_day'>): boolean {
  return row.plan === 'complete' && row.status === 'paid' && Boolean(row.coaching_day)
}

function slotRank(slot: CoachingSlotKey | null): number {
  return slot === null ? COACHING_SLOT_ORDER.length : COACHING_SLOT_ORDER.indexOf(slot)
}

/** Day ascending, morning before afternoon, a slot-less legacy booking last. */
export function sortBookings(bookings: readonly AdminCoachingBooking[]): AdminCoachingBooking[] {
  return [...bookings].sort(
    (a, b) => a.day.localeCompare(b.day) || slotRank(a.slot) - slotRank(b.slot),
  )
}

export function toBooking(
  row: CoachingOrderRow,
  derived: { studentHasAccount: boolean; coachSeesStudent: boolean },
): AdminCoachingBooking {
  return {
    orderId: row.id,
    email: row.email,
    fullName: row.full_name,
    day: row.coaching_day ?? '',
    slot: isCoachingSlotKey(row.coaching_slot) ? row.coaching_slot : null,
    coachName: row.coaching_coach_name,
    coachEmail: row.coaching_coach_email,
    meetingUrl: row.coaching_meeting_url,
    detailsSentAt: row.coaching_details_sent_at,
    ...derived,
  }
}

/**
 * The booking behind an order id, or null when the id is not a uuid or the row
 * is not a paid Complete order with a coaching date. Throws on a DB error.
 */
export async function loadCoachingOrder(
  admin: SupabaseClient,
  orderId: unknown,
): Promise<CoachingOrderRow | null> {
  if (!isUuid(orderId)) return null
  const { data, error } = await admin
    .from('preorders')
    .select(COACHING_ORDER_COLUMNS)
    .eq('id', orderId)
    .maybeSingle()
  if (error) throw error
  const row = data as CoachingOrderRow | null
  return row && isCoachingBooking(row) ? row : null
}

/**
 * Attach `studentHasAccount` / `coachSeesStudent` to each row.
 *
 * Per-email profile lookups rather than one IN query: profiles.email carries
 * whatever casing the account was made with, and a case-insensitive batch
 * match has no clean PostgREST form. There are a handful of bookings, so
 * correctness wins over a round trip. Throws on a DB error.
 */
export async function deriveBookings(
  admin: SupabaseClient,
  rows: readonly CoachingOrderRow[],
): Promise<AdminCoachingBooking[]> {
  const studentIdByEmail = new Map<string, string | null>()
  await Promise.all(
    [...new Set(rows.map((row) => row.email.trim().toLowerCase()))].map(async (email) => {
      studentIdByEmail.set(email, await findUserIdByEmail(admin, email))
    }),
  )

  // Each coach's OLDEST cohort, the one their Students tab reads.
  const coachEmails = [
    ...new Set(
      rows
        .map((row) => parseCoachEmail(row.coaching_coach_email))
        .filter((email): email is string => Boolean(email)),
    ),
  ]
  const cohortByCoach = new Map<string, string>()
  const membersByCohort = new Map<string, Set<string>>()
  if (coachEmails.length > 0) {
    const { data: cohorts, error: cohortError } = await admin
      .from('cohorts')
      .select('id, trainer_email, created_at')
      .in('trainer_email', coachEmails)
      .order('created_at', { ascending: true })
    if (cohortError) throw cohortError
    for (const cohort of (cohorts ?? []) as Array<{ id: string; trainer_email: string }>) {
      if (!cohortByCoach.has(cohort.trainer_email)) cohortByCoach.set(cohort.trainer_email, cohort.id)
    }
    const cohortIds = [...new Set(cohortByCoach.values())]
    if (cohortIds.length > 0) {
      const { data: members, error: memberError } = await admin
        .from('cohort_members')
        .select('cohort_id, user_id')
        .in('cohort_id', cohortIds)
      if (memberError) throw memberError
      for (const member of (members ?? []) as Array<{ cohort_id: string; user_id: string }>) {
        const set = membersByCohort.get(member.cohort_id) ?? new Set<string>()
        set.add(member.user_id)
        membersByCohort.set(member.cohort_id, set)
      }
    }
  }

  return rows.map((row) => {
    const studentId = studentIdByEmail.get(row.email.trim().toLowerCase()) ?? null
    const coachEmail = parseCoachEmail(row.coaching_coach_email)
    const cohortId = coachEmail ? cohortByCoach.get(coachEmail) : undefined
    return toBooking(row, {
      studentHasAccount: studentId !== null,
      coachSeesStudent: Boolean(studentId && cohortId && membersByCohort.get(cohortId)?.has(studentId)),
    })
  })
}
