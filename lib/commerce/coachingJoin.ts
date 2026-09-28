/**
 * Joining details for a booked one to one coaching session: who the coach is
 * and the video call link. Pure — shared by the admin endpoint that writes them,
 * the student's dashboard that shows them, and the confirmation email.
 *
 * Kept on the `preorders` row beside `coaching_day` / `coaching_slot` (see the
 * 20260928 migration). A session is one to one, so the order is the booking.
 */

export interface CoachingJoinDetails {
  /** The link the student and coach both join. Null until an admin sets it. */
  meetingUrl: string | null
  /** How the coach is named to the student, e.g. "Dr Hassan Khan". */
  coachName: string | null
}

export const NO_JOIN_DETAILS: CoachingJoinDetails = Object.freeze({
  meetingUrl: null,
  coachName: null,
})

/** Longest link accepted. Real meeting links are well under 200 characters. */
export const MAX_MEETING_URL_LENGTH = 500

/** Longest coach name accepted; it has to fit on one dashboard line. */
export const MAX_COACH_NAME_LENGTH = 80

/**
 * A meeting link fit to put behind a button, or null.
 *
 * https only, and parsed rather than pattern-matched: this string is
 * interpolated into an `href` in the email (chrome.ts `button` deliberately
 * does not escape) and on the dashboard, so `javascript:`, `http:`, a stray
 * space or a quote must never get through. Returned as typed (trimmed), not as
 * `URL.toString()`, which would quietly add a trailing slash to a bare host and
 * make the stored link differ from the one the coach pasted.
 */
export function parseMeetingUrl(raw: unknown): string | null {
  if (typeof raw !== 'string') return null
  const value = raw.trim()
  if (!value || value.length > MAX_MEETING_URL_LENGTH) return null
  if (/[\s"'<>`]/.test(value)) return null
  let url: URL
  try {
    url = new URL(value)
  } catch {
    return null
  }
  if (url.protocol !== 'https:' || !url.hostname || url.username || url.password) return null
  return value
}

/** A display name for the coach: trimmed, single-spaced, 2 to 80 characters. */
export function parseCoachName(raw: unknown): string | null {
  if (typeof raw !== 'string') return null
  const value = raw.trim().replace(/\s+/g, ' ')
  if (value.length < 2 || value.length > MAX_COACH_NAME_LENGTH) return null
  if (/[<>]/.test(value)) return null
  return value
}

/**
 * The coach's account email, lower-cased — the form `cohorts.trainer_email`
 * requires by CHECK constraint, so the coach's Students tab resolves.
 */
export function parseCoachEmail(raw: unknown): string | null {
  if (typeof raw !== 'string') return null
  const value = raw.trim().toLowerCase()
  if (value.length > 254) return null
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value) ? value : null
}

export interface JoiningDetailsInput {
  meetingUrl: string
  coachName: string
  coachEmail: string
}

export type JoiningDetailsParse =
  | { ok: true; value: JoiningDetailsInput }
  | { ok: false; error: string }

/** Validate the admin form body. Every field is required; the first bad one is named. */
export function parseJoiningDetailsInput(body: unknown): JoiningDetailsParse {
  const input = (body ?? {}) as Record<string, unknown>
  const coachName = parseCoachName(input.coachName)
  if (!coachName) return { ok: false, error: 'Enter the coach’s name as the student should see it.' }
  const coachEmail = parseCoachEmail(input.coachEmail)
  if (!coachEmail) return { ok: false, error: 'Enter the email the coach signs in with.' }
  const meetingUrl = parseMeetingUrl(input.meetingUrl)
  if (!meetingUrl) return { ok: false, error: 'Enter the meeting link, starting https://' }
  return { ok: true, value: { meetingUrl, coachName, coachEmail } }
}

/**
 * The joining details as a student may see them, from the raw order columns.
 * Re-validated on the way out as well as on the way in: a hand-edited row must
 * degrade to "not set yet", never to a broken or unsafe link.
 */
export function joinDetailsFromRow(row: {
  coaching_meeting_url?: string | null
  coaching_coach_name?: string | null
} | null | undefined): CoachingJoinDetails {
  if (!row) return NO_JOIN_DETAILS
  return {
    meetingUrl: parseMeetingUrl(row.coaching_meeting_url),
    coachName: parseCoachName(row.coaching_coach_name),
  }
}
