/**
 * A best-effort abuse brake for unauthenticated routes that spend money.
 *
 * Lifted, comment and all, from the shape `app/api/auth/resend-set-password`
 * proved out — the same problem arrived twice (a route that mails a stranger's
 * address on an anonymous POST) and the second copy would have drifted.
 *
 * ⚠️ PER SERVERLESS INSTANCE. The window lives in module state, so it resets on
 * a cold start and someone spraying across instances gets more than the nominal
 * budget. It is still worth having, because the threat it actually stops is the
 * cheap one: a script POSTing one address in a loop. On Vercel Hobby there is
 * no Redis to do better with; swap these two Maps for a KV counter when there
 * is one, and nothing else has to change.
 */

/** key -> timestamps of the attempts counted against it. */
export type HitLog = Map<string, number[]>

export function createHitLog(): HitLog {
  return new Map()
}

/**
 * Record an attempt against `key` and report whether it fits in the window.
 *
 * Prunes the WHOLE map on access, not just this key, so a long-lived instance
 * does not accumulate every address it has ever been asked about. Only an
 * ALLOWED attempt is recorded, which keeps the budget a plain "N per window"
 * and bounds each entry at `limit` timestamps — a rejected flood cannot grow
 * the array it is being rejected by.
 */
export function withinLimit(
  hits: HitLog,
  key: string,
  limit: number,
  windowMs: number,
  now: number = Date.now(),
): boolean {
  for (const [seen, times] of hits) {
    const live = times.filter((t) => now - t < windowMs)
    if (live.length === 0) hits.delete(seen)
    else hits.set(seen, live)
  }

  const live = hits.get(key) ?? []
  if (live.length >= limit) return false
  hits.set(key, [...live, now])
  return true
}

/** Vercel puts the client address at the head of `x-forwarded-for`. */
export function clientIp(request: Request): string {
  const forwarded = request.headers.get('x-forwarded-for')
  if (forwarded) return forwarded.split(',')[0].trim()
  return request.headers.get('x-real-ip')?.trim() || 'unknown'
}
