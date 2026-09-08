import { NextResponse } from 'next/server'

/**
 * The answer both retired guest endpoints give.
 *
 * `/api/try/create-session` and `/api/try/realtime-token` existed to let a
 * browser with no account open a consultation and spend Azure realtime minutes
 * against nobody. From 7 September 2026 every free station is sat inside a real
 * account, so both are closed — but they are answered rather than deleted,
 * because a client that has been open in a tab since this morning, or a script
 * somebody wrote against them, deserves a sentence rather than a 404 that reads
 * as an outage.
 *
 * 410 Gone, not 404 or 403: the resource existed, it is deliberately finished,
 * and it is not coming back. Caches and crawlers treat it accordingly.
 *
 * One module so the two answers cannot drift, and so the retirement is a single
 * thing to find and delete when these files finally go.
 */

export const RETIRED_GUEST_ROUTE = {
  error: 'guest_trial_retired',
  message: 'Free stations now run in a free account. Start at /free/start.',
  start: '/free/start',
} as const

export function retiredGuestRoute(): NextResponse {
  return NextResponse.json(RETIRED_GUEST_ROUTE, {
    status: 410,
    headers: { 'Cache-Control': 'no-store' },
  })
}
