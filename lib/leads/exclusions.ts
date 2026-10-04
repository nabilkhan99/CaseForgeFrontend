import { DISPOSABLE_DOMAINS, INTERNAL_SUBSTRINGS } from '@/scripts/trial-emails/dueRules'

/**
 * Who is not a lead: our own accounts, test sign-ups and throwaway inboxes.
 *
 * The generic lists are shared with the trial-email rules. Exact addresses of
 * real people (a family friend, a trainer cohort) are not here: the repo is
 * public, so they live in the `lead_overrides` table.
 */

/** Founder addresses. Narrower than the trial-email rule's `ishaq`, which would hide a real doctor called Ishaq. */
const FOUNDER_PREFIXES: readonly string[] = ['nabilkhan', 'ishaqmiah', 'hello@fourteenfisherman']

/**
 * Throwaway domains seen in our own testing of the trial flow. Distinct from
 * the generic disposable providers; every one of these was us.
 */
export const TEST_DOMAINS: readonly string[] = [
  'aganseo.com', 'airychen.com', 'apdtax.com', 'barumart.com', 'blobapps.com', 'daugr.com', 'dreameg.com',
  'duidir.com', 'fidhost.com', 'findize.com', 'gwshare.com', 'kierko.com', 'koboywin.com', 'neowd.com',
  'neplis.com', 'primetor.com', 'prorises.com', 'example.com',
]

function domainOf(email: string): string {
  return email.slice(email.lastIndexOf('@') + 1)
}

/** True for an address that is never a lead, before any database overrides. */
export function isNeverALead(rawEmail: string): boolean {
  const email = rawEmail.trim().toLowerCase()
  if (!email.includes('@')) return true
  if (FOUNDER_PREFIXES.some((prefix) => email.startsWith(prefix))) return true
  if (INTERNAL_SUBSTRINGS.some((needle) => email.includes(needle))) return true
  const domain = domainOf(email)
  return [...DISPOSABLE_DOMAINS, ...TEST_DOMAINS].some((bad) => domain === bad || domain.endsWith(`.${bad}`))
}
