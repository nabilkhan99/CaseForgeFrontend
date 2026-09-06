/**
 * What the guest reveal does with the account `/api/try/verify-code` makes.
 *
 * Contract V: proving the address at the gate is also what creates the Supabase
 * account and grants the five stations, so the verify response now carries an
 * `account` block alongside its `ok`. This gate is the last screen before the
 * report and therefore the only place that can tell someone the account exists
 * and hand them the way in.
 *
 * EVERY FIELD IS OPTIONAL ON PURPOSE, and the whole block may be absent. The
 * account half of that route belongs to another workstream; until it lands the
 * response is the plain `{ ok }` it has always been, and the gate must then
 * behave exactly as it did before — offering the report and nothing else.
 * Absent means "no account was made", never "assume one was". That is the rule
 * these two functions exist to make testable, because the failure it prevents
 * (offering a dashboard to somebody who has no account) is silent.
 */
import { doorForSource, type TrialDoor } from '@/lib/trial/trialEvents'

export interface VerifiedAccount {
  userId?: string
  /** True only when this verification is what created the account. */
  created?: boolean
  /** A one-shot signed link into the dashboard. Null when none could be minted. */
  signInUrl?: string | null
}

export interface VerifyCodeResponse {
  ok?: boolean
  error?: string
  account?: VerifiedAccount
  trial?: { state?: string; granted?: boolean }
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

/**
 * Where the sign-in link goes when none was minted. The address is verified and
 * the account exists, so the ordinary code-based sign-in works — it is one more
 * step, not a dead end.
 */
const FALLBACK_HREF = '/auth/sign-in'

/** The offer to render under the report button, or null to render nothing. */
export function dashboardOffer(account: VerifiedAccount | null | undefined): DashboardOffer | null {
  if (!account) return null
  return { href: account.signInUrl || FALLBACK_HREF, label: LABEL }
}

/**
 * The analytics door for an account this verification created, or null when it
 * created none — an address verified a second time must not count twice.
 */
export function accountCreatedDoor(account: VerifiedAccount | null | undefined): TrialDoor | null {
  return account?.created ? doorForSource('guest_reveal') : null
}
