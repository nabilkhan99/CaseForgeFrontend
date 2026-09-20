/**
 * Which `clinical_sessions.status` values a consultation may still be started
 * from, shared by both lanes.
 *
 * `reading` is a brief that has been opened; `live` is a consultation already
 * under way, and it has to stay startable because a mid-call reconnect re-mints
 * against the same row. Everything else — `processing`, `completed`,
 * `unmarkable`, `error`, `abandoned` — is a consultation that is over.
 *
 * The guest lane has enforced this since the lane reopened (rule 7 in
 * lib/trial/guestSession.ts). The signed-in lane did not, which is the whole of
 * the resurrection bug: re-opening a finished consultation's URL dialled the
 * patient again and demoted a row the marking engine had already completed.
 */
export const STARTABLE_STATUSES: ReadonlySet<string> = new Set(['reading', 'live'])

/** True when a consultation in this state may still be connected to. */
export function isStartableStatus(status: string | null | undefined): boolean {
  return STARTABLE_STATUSES.has(status ?? '')
}
