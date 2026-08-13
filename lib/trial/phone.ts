import { normalizePhone } from './questionnaire'

/**
 * Convert a phone number as people actually type it into E.164 (+447…),
 * which is what Brevo's SMS API needs and what makes the number tappable
 * to call from the lead alert. UK-first: a bare 0-prefixed number is
 * assumed to be UK, matching the audience (UK GP trainees).
 *
 * Returns null when the number can't be made sendable.
 */
export function toE164(raw: string): string | null {
  const cleaned = normalizePhone(raw.trim())

  let candidate: string
  if (cleaned.startsWith('+')) {
    candidate = cleaned
  } else if (cleaned.startsWith('00')) {
    candidate = `+${cleaned.slice(2)}`
  } else if (cleaned.startsWith('0')) {
    candidate = `+44${cleaned.slice(1)}`
  } else {
    candidate = `+${cleaned}`
  }

  return /^\+\d{9,15}$/.test(candidate) ? candidate : null
}
