import { randomUUID } from 'node:crypto'
import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseAdmin } from '@/lib/supabase/admin'
import { rejectIfSignedIn } from '@/lib/trial/guestOnly'
import { pickGuestStationId } from '@/lib/trial/guestStation'
import {
  GUEST_COOKIE,
  canOpenGuestSession,
  guestCookieOptions,
  readGuestCookie,
  signGuestCookie,
  withGuestSession,
} from '@/lib/trial/guestSession'

/**
 * One click to a live patient.
 *
 * The curious door used to be three pages — a picker, a brief with an
 * exam-style reading clock, and only then the call — and every one of them was
 * a place to leave. This route is the whole of the default path: it opens the
 * consultation server-side and redirects into the call screen, which asks for
 * the microphone the moment it paints. The brief is two lines on that screen;
 * the full brief and its reading timer are still there, one quiet link away,
 * for the trainee who wants to sit the thing properly.
 *
 * `GET /try/talk?station=<uuid>` — the station is optional and advisory, and
 * it may only ever name one of the five free cases (contract C2). A station
 * that is not free, is retired, or is absent altogether opens the first free
 * case instead; when nothing at all is free the visitor goes to /free rather
 * than into a paid station. See lib/trial/guestStation.ts.
 *
 * WHY THE SERVER MAKES THE ID. It is the hinge the anonymous Azure mint hangs
 * on: the session id is generated here, written to the database here, and
 * recorded in a signed httpOnly cookie here, all before the browser learns it.
 * `/api/try/realtime-token` then refuses any id that did not come out of this
 * route (or `create-session`, which does the same three things for the
 * read-the-brief path). See lib/trial/guestSession.ts.
 */

/** A visitor who has had their three for today belongs at the deliberate door. */
const OVERFLOW = '/free?guest=limit'

/** No free case, no signing secret, no row: nothing to talk to. */
const UNAVAILABLE = '/free?guest=unavailable'

export const dynamic = 'force-dynamic'

/**
 * Did a person navigate here, or did a machine reach for the link?
 *
 * This route has a side effect — it opens a consultation and spends one of the
 * three a browser gets in a day — and it is reached by GET, which browsers,
 * crawlers and link-preview bots all feel free to do unasked. Next's own
 * `<Link>` prefetches into the viewport in production, so a landing page
 * carrying "talk to a patient first" would otherwise open a session for every
 * visitor who merely scrolled past it, and a link pasted into Slack would open
 * one for the unfurler.
 *
 * A denylist of the signals machines actually send, not an allowlist of
 * `Sec-Fetch-Mode: navigate` — that header is absent on older browsers, and
 * requiring it would refuse real people to catch bots.
 */
function isMachineFetch(req: NextRequest): boolean {
  // HEAD is answered by this handler too (Next derives it from GET), and
  // nobody navigates with one.
  if ((req.method ?? 'GET').toUpperCase() === 'HEAD') return true

  const headers = req.headers
  if (headers.get('next-router-prefetch')) return true
  if ((headers.get('sec-purpose') ?? '').includes('prefetch')) return true
  const purpose = (
    headers.get('purpose') ??
    headers.get('x-purpose') ??
    headers.get('x-moz') ??
    ''
  ).toLowerCase()
  return purpose.includes('prefetch') || purpose.includes('preview')
}

function leave(req: NextRequest, path: string): NextResponse {
  const response = NextResponse.redirect(new URL(path, req.url), 307)
  response.headers.set('Cache-Control', 'no-store')
  return response
}

export async function GET(req: NextRequest) {
  // Nothing is opened for a prefetch. 204 rather than a redirect: there is no
  // destination to offer a machine, and a real navigation never gets here.
  if (isMachineFetch(req)) {
    return new NextResponse(null, { status: 204, headers: { 'Cache-Control': 'no-store' } })
  }

  // The middleware already turns signed-in visitors away from /try/*, but this
  // route writes a row nobody owns, so it says no itself as well. A redirect
  // rather than the 403 `rejectIfSignedIn` returns: this is a navigation, and
  // the customer's consultations live in the dashboard.
  if (await rejectIfSignedIn()) {
    return leave(req, '/dashboard')
  }

  const nowSeconds = Math.floor(Date.now() / 1000)
  const cookie = readGuestCookie(req.cookies.get(GUEST_COOKIE)?.value)

  if (!canOpenGuestSession(cookie, nowSeconds)) {
    console.warn('[try/talk] guest daily limit reached')
    return leave(req, OVERFLOW)
  }

  const admin = getSupabaseAdmin()
  const stationId = await pickGuestStationId(admin, req.nextUrl.searchParams.get('station'))
  if (!stationId) {
    console.error('[try/talk] no free station to open')
    return leave(req, UNAVAILABLE)
  }

  const sessionId = randomUUID()
  const { error } = await admin.from('clinical_sessions').insert({
    id: sessionId,
    user_id: null,
    station_id: stationId,
    status: 'reading',
    started_at: new Date().toISOString(),
  })
  if (error) {
    console.error('[try/talk] could not open a consultation', error)
    return leave(req, UNAVAILABLE)
  }

  const signed = signGuestCookie(withGuestSession(cookie, sessionId, nowSeconds))
  if (!signed) {
    // No signing secret means the mint would refuse this session anyway, so
    // fail here rather than after the trainee has granted their microphone.
    console.error('[try/talk] no signing secret — refusing to open a consultation')
    return leave(req, UNAVAILABLE)
  }

  const response = leave(req, `/try/session/${sessionId}`)
  response.cookies.set(GUEST_COOKIE, signed, guestCookieOptions())
  return response
}
