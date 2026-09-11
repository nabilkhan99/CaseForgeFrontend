import { extractPresentingComplaint } from '@/lib/stations/presentingComplaint'

/**
 * The brief a one-click consultation gets: two lines, on the call screen.
 *
 * The default guest path has no reading page any more, so the trainee arrives
 * at a ringing phone knowing nothing. Two lines is the whole budget — enough to
 * know who is on the line and why, not so much that the screen becomes a
 * document and the call becomes something to do afterwards. Anyone who wants
 * the real thing takes the "Read the full brief first" link, which is the
 * unchanged exam-style page with its reading clock.
 *
 *   line 1  Marcus Webb, 34
 *   line 2  Chest still tight, the inhaler isn't working.
 *
 * Line 2 is the "Reason for Encounter" line already parsed out of the brief for
 * the library's search index and row captions
 * (lib/stations/presentingComplaint.ts) — the sentence the patient booked the
 * appointment with, which is exactly the one line worth having. It is capped
 * much shorter here than there: 240 characters is a caption, and this has to
 * hold one line on a phone. The station title is the fallback for the handful
 * of briefs that carry no such heading — a curated one-liner, so it never
 * leaves the trainee with nothing.
 */

/** Roughly one line at the call screen's size on a narrow phone. */
const MAX_COMPLAINT = 110

export interface CallBrief {
  /** "Marcus Webb, 34" — or just the name where the age is missing. */
  who: string
  /** One sentence. Never empty when the station has a title. */
  complaint: string
}

export interface CallBriefStation {
  title?: string | null
  patient_name?: string | null
  patient_age?: number | string | null
  candidate_instructions?: string | null
}

function oneLine(value: string): string {
  const cleaned = value.replace(/\s+/g, ' ').trim()
  if (cleaned.length <= MAX_COMPLAINT) return cleaned
  const cut = cleaned.slice(0, MAX_COMPLAINT)
  const lastSpace = cut.lastIndexOf(' ')
  // Cut on a word boundary, unless the boundary is so early that the line would
  // say nothing — the same rule the search caption uses.
  return `${(lastSpace > MAX_COMPLAINT * 0.6 ? cut.slice(0, lastSpace) : cut).trimEnd()}…`
}

export function buildCallBrief(station: CallBriefStation | null | undefined): CallBrief {
  const name = station?.patient_name?.trim() || 'Your patient'
  const age = Number(station?.patient_age)
  const who = Number.isFinite(age) && age > 0 ? `${name}, ${age}` : name

  const complaint = extractPresentingComplaint(station?.candidate_instructions)
  const title = station?.title?.trim() ?? ''
  return { who, complaint: oneLine(complaint || title) }
}

/** The initials the orb shows. */
export function patientInitials(patientName: string | null | undefined): string {
  const parts = (patientName ?? '').trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return '??'
  return parts
    .map((part) => part[0])
    .join('')
    .slice(0, 2)
    .toUpperCase()
}
