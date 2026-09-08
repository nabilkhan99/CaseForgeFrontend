/**
 * The query states /free and /free/open have to answer for.
 *
 * Three different surfaces send people to /free with something in the query,
 * and none of them knows the page has become a picker:
 *
 *   - `/try/talk` bounces here with `?guest=limit` (three consultations is a
 *     browser's lot for the day) or `?guest=unavailable` (no station, or no
 *     signing secret, so nothing can be opened);
 *   - the portfolio tool's banner posts an address itself and arrives with
 *     `?email=…&code=sent`, expecting the code step to be waiting.
 *
 * The picker has no form on it any more, so the second case is a handoff to
 * /free/open rather than a prefill. Pure functions in a module of their own
 * because both pages are server components — there is nowhere else these
 * decisions could be checked without a browser.
 */

/** Next 15 hands a page `searchParams` in this shape, already decoded. */
export type SearchParams = Record<string, string | string[] | undefined>

/** A repeated param (`?email=a&email=b`) is a mistake; take the first. */
export function firstParam(value: string | string[] | undefined): string | undefined {
  const raw = Array.isArray(value) ? value[0] : value
  const trimmed = raw?.trim()
  return trimmed ? trimmed : undefined
}

/** Why the one-click door turned somebody away, if it did. */
export type GuestNotice = 'limit' | 'unavailable'

export function guestNotice(params: SearchParams): GuestNotice | null {
  const guest = firstParam(params.guest)
  return guest === 'limit' || guest === 'unavailable' ? guest : null
}

/**
 * Where a person carrying an address belongs — /free/open, with the address
 * and the code state intact so the step they were promised is the step they
 * get. Null when there is no address, which is the normal case.
 *
 * Only the two params travel. Anything else in the query (utm tags, `ref`)
 * stays on /free, which is where the analytics for the picker want it.
 */
export function openDashboardHref(params: SearchParams): string | null {
  const email = firstParam(params.email)
  if (!email) return null

  const query = new URLSearchParams({ email })
  if (firstParam(params.code) === 'sent') query.set('code', 'sent')
  return `/free/open?${query.toString()}`
}

/** What /free/open opens with. */
export interface OpenPrefill {
  /** Pre-fills the address field. */
  email?: string
  /**
   * Start on the code step because a code has ALREADY been sent — asking for
   * the address a second time would waste that send and read as a bug.
   */
  codeAlreadySent: boolean
}

export function openPrefill(params: SearchParams): OpenPrefill {
  const email = firstParam(params.email)
  return {
    email,
    // Never on its own: a code step with no address to verify against is a
    // dead end, so `?code=sent` without `?email=` starts at the beginning.
    codeAlreadySent: Boolean(email) && firstParam(params.code) === 'sent',
  }
}
