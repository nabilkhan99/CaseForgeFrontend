import 'server-only'
import { clientIp, createHitLog, withinLimit } from '@/lib/http/rateLimit'

/**
 * The cost backstop that does not live in a cookie.
 *
 * Every other guest rule — three consultations a day, one mint per session per
 * two minutes, thirty minutes to start — is enforced through the signed
 * `ff_guest` cookie, and a cookie is per-browser by construction. Clearing it
 * buys a fresh browser identity, which is the honest answer for a person and a
 * one-line loop for a script: `curl` with no cookie jar gets a brand-new budget
 * on every request. Nothing outside the cookie counted how many times one CLIENT
 * opened a consultation or minted an Azure key, and each of those is real money
 * (a station is roughly $1.45 at Azure list, with a ceiling above $5).
 *
 * So there are two per-IP budgets here, both deliberately far above any human:
 *
 *   * {@link GUEST_OPENS_PER_IP_PER_HOUR} consultations opened, counted across
 *     `/try/talk` and `/api/try/create-session` TOGETHER — they are two doors
 *     onto the same act, and a budget either of them could dodge by using the
 *     other is not a budget;
 *   * {@link GUEST_MINTS_PER_IP_PER_HOUR} realtime-key mints, which is the
 *     larger number because one consultation legitimately re-mints on a
 *     reconnect, and the smaller cost per refusal: a refused mint costs a
 *     trainee a retry, a refused open costs them the consultation.
 *
 * ⚠️ PER SERVERLESS INSTANCE, exactly as lib/http/rateLimit says: the window is
 * module state, so a cold start resets it and traffic spread across instances
 * gets more than the nominal budget. It still stops the cheap attack, which is
 * the one that actually happens, and an NHS trust behind one NAT would need
 * twenty people starting free consultations within the same hour ON THE SAME
 * INSTANCE to notice. Swap both maps for a KV counter when there is one.
 */

/** Guest consultations one client address may open in an hour, both doors. */
export const GUEST_OPENS_PER_IP_PER_HOUR = 20

/** Azure ephemeral keys one client address may mint in an hour. */
export const GUEST_MINTS_PER_IP_PER_HOUR = 30

const WINDOW_MS = 60 * 60 * 1000

const openHits = createHitLog()
const mintHits = createHitLog()

/** Record an attempt to OPEN a guest consultation; false means refuse it. */
export function withinGuestOpenLimit(req: Request): boolean {
  return withinLimit(openHits, clientIp(req), GUEST_OPENS_PER_IP_PER_HOUR, WINDOW_MS)
}

/** Record an attempt to MINT a realtime key; false means refuse it. */
export function withinGuestMintLimit(req: Request): boolean {
  return withinLimit(mintHits, clientIp(req), GUEST_MINTS_PER_IP_PER_HOUR, WINDOW_MS)
}

/**
 * Empty both windows.
 *
 * For tests, which share a module instance across the cases in a file and would
 * otherwise have one case's traffic decide another's. Never called in the app —
 * there is nothing an hour of waiting does not fix.
 */
export function resetGuestRateLimits(): void {
  openHits.clear()
  mintHits.clear()
}

/** The 429 body both API doors answer with, so the codes do not drift. */
export const GUEST_IP_LIMIT_BODY = {
  error: 'Too many free consultations from this connection. Try again a little later.',
  code: 'guest_ip_limit',
} as const
