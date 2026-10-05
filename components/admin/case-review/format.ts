/**
 * Small display helpers for the case review pages. No dashes in any of the
 * copy: the product writes without em or en dashes.
 */

/** What an empty value shows. */
export const EMPTY = '·'

/** "5 Oct 2026" */
export function fmtDay(iso: string | null): string {
  if (!iso) return EMPTY
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return EMPTY
  return date.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
}

/** "Sarah Jones, 54" / "Sarah Jones" / "54" / "·" */
export function fmtPatient(name: string | null, age: number | null): string {
  const parts = [name?.trim() || null, age === null || age === undefined ? null : String(age)].filter(Boolean)
  return parts.length > 0 ? parts.join(', ') : EMPTY
}

/** "1 keeper" / "3 keepers" / "no keepers yet" */
export function fmtKeepers(count: number): string {
  if (count === 0) return 'no keepers yet'
  return count === 1 ? '1 keeper' : `${count} keepers`
}

/** Joins the non-empty parts of a meta line with a middle dot. */
export function metaLine(parts: readonly (string | null | undefined)[]): string {
  return parts.filter((p): p is string => Boolean(p && p.trim())).join(' · ')
}
