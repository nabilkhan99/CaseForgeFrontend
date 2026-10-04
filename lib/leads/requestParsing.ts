/**
 * Small checks for the /api/admin/leads request bodies. Admin-only routes, but
 * the browser is still not trusted: every field is typed and bounded here.
 */

export const MAX_NOTES_CHARS = 4000
const MAX_LABEL_CHARS = 80

export type Parsed<T> = { ok: true; value: T } | { ok: false; error: string }

export function asObject(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>) : null
}

export function parseEmail(value: unknown): Parsed<string> {
  const email = typeof value === 'string' ? value.trim().toLowerCase() : ''
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) && email.length <= 320
    ? { ok: true, value: email }
    : { ok: false, error: 'A lead email is required.' }
}

/** Notes as typed or dictated. Empty means "none"; too long is refused rather than cut. */
export function parseNotes(value: unknown, required: boolean): Parsed<string | null> {
  const notes = typeof value === 'string' ? value.trim() : ''
  if (!notes) return required ? { ok: false, error: 'Write or dictate what happened first.' } : { ok: true, value: null }
  if (notes.length > MAX_NOTES_CHARS) return { ok: false, error: `Keep notes under ${MAX_NOTES_CHARS} characters.` }
  return { ok: true, value: notes }
}

export function parseLabel(value: unknown): Parsed<string> {
  const label = typeof value === 'string' ? value.replace(/\s+/g, ' ').trim() : ''
  if (!label) return { ok: false, error: 'Say what the next action is.' }
  return { ok: true, value: label.slice(0, MAX_LABEL_CHARS) }
}

/** An ISO instant, or null for "no date". Anything else is an error, not a silent null. */
export function parseDueAt(value: unknown): Parsed<string | null> {
  if (value === null || value === undefined || value === '') return { ok: true, value: null }
  if (typeof value !== 'string' || !Number.isFinite(Date.parse(value))) return { ok: false, error: 'That date is not valid.' }
  return { ok: true, value: new Date(value).toISOString() }
}
