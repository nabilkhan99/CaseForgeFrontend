/**
 * What the guest reveal does with the account `/api/try/verify-code` makes.
 *
 * Proving the address at the gate is what creates the Supabase account, grants
 * the five stations AND signs the browser in — the verify response carries
 * session cookies, so by the time this screen renders the person is already
 * inside the product. This gate is the last screen before the report and
 * therefore the only place that can tell them so.
 *
 * ## No link, no inbox
 *
 * There used to be a `signInUrl` in this response: a one-time credential the
 * gate turned into a button, with an email fallback behind it. Both are gone.
 * A bearer credential for an account has no business travelling in a JSON body
 * when the same request can simply set the cookie, and "check your inbox" was
 * the second inbox trip in ninety seconds for somebody who had just read a code
 * out of the first one.
 *
 * EVERY FIELD IS STILL OPTIONAL, and the whole block may be absent. Absent means
 * "no account was made", never "assume one was" — that is the rule these two
 * functions exist to make testable, because the failure it prevents (offering a
 * dashboard to somebody who has none) is silent.
 */
import { doorForSource, type TrialDoor } from '@/lib/trial/trialEvents'

export interface VerifiedAccount {
  userId?: string
  /** True only when this verification is what created the account. */
  created?: boolean
}

export interface VerifyCodeResponse {
  ok?: boolean
  error?: string
  account?: VerifiedAccount
  trial?: { state?: string; granted?: boolean }
  /** The response set session cookies; the browser is signed in. */
  signedIn?: boolean
  /** Where the caller should go next. `/dashboard`, or a station they picked. */
  redirectTo?: string
}

export interface DashboardOffer {
  href: string
  label: string
}

/**
 * Four, not five: the consultation they have just finished is the first of them,
 * and saying "5 more" to someone looking at their own marked report reads as a
 * different offer from the one they were given.
 */
const LABEL = 'Open your dashboard · 4 more stations, five days'

/** The dashboard. They are signed in; there is nothing between them and it. */
const DASHBOARD = '/dashboard'

/** The offer to render under the report button, or null to render nothing. */
export function dashboardOffer(account: VerifiedAccount | null | undefined): DashboardOffer | null {
  if (!account) return null
  return { href: DASHBOARD, label: LABEL }
}

/**
 * The analytics door for an account this verification created, or null when it
 * created none — an address verified a second time must not count twice.
 */
export function accountCreatedDoor(account: VerifiedAccount | null | undefined): TrialDoor | null {
  return account?.created ? doorForSource('guest_reveal') : null
}
