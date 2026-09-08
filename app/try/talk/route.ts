import { NextRequest, NextResponse } from 'next/server'

/**
 * The one-click guest door, retired 7 September 2026.
 *
 * This used to open a `clinical_sessions` row owned by nobody and redirect
 * straight into a call screen — no account, no board, and a consultation that
 * lived or died with the browser tab. Every free station is now sat inside a
 * real account, so the route's whole job is to carry the person, and the case
 * they picked, to the form that makes one.
 *
 * KEPT AS A ROUTE rather than deleted. The path is in ads, in sent emails, in
 * every public case page cached before today and in people's history; a 404
 * there is a lost trainee, and a redirect is one hop.
 *
 * `?station=<uuid>` travels with them. /free/start validates it and lands them
 * on that case once the account exists — so a link to a specific case still
 * opens that case, three fields later.
 */

/** Where the free trial begins now. */
const START = '/free/start'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const destination = new URL(START, req.url)

  // Only the station is carried. Everything else in the query is a marketing
  // tag belonging to the page this link was on, and /free/start has no use for
  // it — where a `station` is what decides which patient opens on the far side
  // of the form.
  const station = req.nextUrl.searchParams.get('station')?.trim()
  if (station) destination.searchParams.set('station', station)

  // 307, not 308: this is a door being moved, and a permanent redirect would be
  // cached in browsers for as long as they felt like it — including for anybody
  // testing a change to where it should go.
  const response = NextResponse.redirect(destination, 307)
  response.headers.set('Cache-Control', 'no-store')
  return response
}
