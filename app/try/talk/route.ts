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
 * `GET /try/talk?station=<uuid>` — the station is optional and advisory. See
 * lib/trial/guestStation.ts for what happens when it is absent or retired.
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

/** No bank, no signing secret, no row: nothing to talk to. */
const UNAVAILABLE = '/free?guest=unavailable'

export const dynamic = 'force-dynamic'

function leave(req: NextRequest, path: string): NextResponse {
  const response = NextResponse.redirect(new URL(path, req.url), 307)
  response.headers.set('Cache-Control', 'no-store')
  return response
}

export async function GET(req: NextRequest) {
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
    console.error('[try/talk] no active station to open')
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
