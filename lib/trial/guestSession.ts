import 'server-only'
import { createHmac, randomUUID, timingSafeEqual } from 'node:crypto'

/**
 * Who is allowed to spend an Azure realtime minute without an account.
 *
 * `/api/try/realtime-token` is the only endpoint in the product that mints a
 * paid-for Azure gpt-realtime key with no authentication at all — a guest has
 * no session by definition. Until now it minted for any client-supplied UUID,
 * inserting a brand-new `clinical_sessions` row when it did not recognise one,
 * with no rate limit of any kind. The five-station trial makes that worse by
 * dropping the `is_free_trial` filter, so every one of the 200 stations becomes
 * reachable that way. This module is the compensating control.
 *
 * ## The cookie
 *
 * The SERVER generates every guest session id (in `/try/talk` or
 * `/api/try/create-session`) and records it in an httpOnly, HMAC-signed cookie
 * before the browser is ever told the id. The cookie is the browser's
 * identity: it carries a random guest id, and one entry per session the server
 * opened for it — when it was opened (`c`) and when a key was last minted for
 * it (`m`).
 *
 * Cookie-backed rather than a table, deliberately. Vercel Hobby has no Redis
 * and an in-memory map is per-instance (so no limit at all across a fleet), and
 * a DB-backed per-browser counter would need a new column on
 * `clinical_sessions` to bind a row to a browser — a migration this workstream
 * does not own. The signature is what makes the cookie trustworthy: it is
 * written and read only by us, the client cannot forge an entry, cannot
 * back-date `m`, and cannot add a session the server never opened. Clearing it
 * does not buy a way past the mint either — a session whose id is not in a
 * valid cookie is refused outright, so the worst a cleared cookie achieves is a
 * fresh browser identity, which is exactly what a fresh browser would get.
 *
 * ## The rules, exactly as enforced
 *
 * A mint is refused unless ALL of these hold. Each refusal carries its own
 * `code` so the caller can tell them apart in logs.
 *
 *  1. `guest_cookie_missing`   — a cookie is present and its HMAC verifies.
 *  2. `guest_session_unrecognised` — the requested session id appears in that
 *     cookie, i.e. this browser is the one the server opened it for.
 *  3. `guest_daily_limit`      — no more than {@link GUEST_SESSIONS_PER_DAY}
 *     guest sessions were opened for this cookie in the last
 *     {@link GUEST_DAY_SECONDS}. Enforced at creation too; here it is the
 *     backstop.
 *  4. `guest_session_unknown`  — the `clinical_sessions` row exists. The route
 *     never inserts one, so an unknown id is a refusal, not a new consultation.
 *  5. `guest_session_owned`    — the row is a guest row (`user_id is null`).
 *  6. `guest_station_mismatch` — the station asked for is the station the row
 *     was created against. The row is authoritative; the body is not.
 *  7. `guest_session_not_startable` — the row's status is `reading` or `live`.
 *     A `processing`, `completed`, `unmarkable`, `error` or `abandoned` session
 *     is over.
 *  8. `guest_session_expired`  — the row was created less than
 *     {@link GUEST_SESSION_MAX_AGE_SECONDS} ago. A session id that leaks stays
 *     spendable for half an hour, not for ever.
 *  9. `guest_mint_cooldown`    — no key was minted for this session in the last
 *     {@link GUEST_MINT_COOLDOWN_SECONDS}. One consultation needs one mint; a
 *     reconnect loop needs none. Carries `retryAfterSeconds`.
 *
 * Rules 4-8 read the database row, which no client controls. Rules 1-3 and 9
 * read the signed cookie, which no client can forge.
 */

/** httpOnly, signed. Never read in the browser. */
export const GUEST_COOKIE = 'ff_guest'

/** Cookie lifetime. Long enough to hold a day's worth of entries for rule 3. */
export const GUEST_COOKIE_MAX_AGE_SECONDS = 24 * 60 * 60

/** Rule 8: how long after creation a guest session may still be started. */
export const GUEST_SESSION_MAX_AGE_SECONDS = 30 * 60

/** Rule 9: minimum gap between two mints for the same session. */
export const GUEST_MINT_COOLDOWN_SECONDS = 120

/** Rule 3: guest consultations one browser may open per rolling day. */
export const GUEST_SESSIONS_PER_DAY = 3

/** The rolling window rule 3 counts over. */
export const GUEST_DAY_SECONDS = 24 * 60 * 60

/** Statuses a consultation may still be started from. */
const STARTABLE_STATUSES = new Set(['reading', 'live'])

/** One consultation the server opened for this browser. */
export interface GuestSessionEntry {
  /** `clinical_sessions.id`. */
  i: string
  /** Opened at, epoch seconds. */
  c: number
  /** Last successful mint, epoch seconds. Absent until the first one. */
  m?: number
}

export interface GuestCookie {
  /** Random per-browser id. Not a user id and never joined to one. */
  g: string
  s: GuestSessionEntry[]
}

/**
 * The signing key.
 *
 * `TRIAL_GUEST_COOKIE_SECRET` if a deployment sets one, otherwise the service
 * role key — the same fallback `lib/trial/verification.ts` makes, and for the
 * same reason: it is always present server-side, so the funnel does not need a
 * new Vercel variable to ship. Null means no signing is possible, and every
 * caller treats that as "no guest consultations", never as "let them in".
 */
function secret(): string | null {
  const raw =
    process.env.TRIAL_GUEST_COOKIE_SECRET?.trim() ||
    process.env.SUPABASE_SERVICE_ROLE_KEY?.trim()
  return raw && raw.length > 0 ? raw : null
}

function encode(payload: GuestCookie): string {
  return Buffer.from(JSON.stringify(payload), 'utf8').toString('base64url')
}

function mac(body: string, key: string): string {
  return createHmac('sha256', key).update(body).digest('base64url')
}

/** A fresh identity for a browser we have not seen. */
export function newGuestCookie(): GuestCookie {
  return { g: randomUUID(), s: [] }
}

/** The cookie value, or null when no secret is configured (fail closed). */
export function signGuestCookie(payload: GuestCookie): string | null {
  const key = secret()
  if (!key) return null
  const body = encode(payload)
  return `${body}.${mac(body, key)}`
}

/**
 * Parse and verify a cookie value. Null for anything missing, malformed,
 * unsigned or tampered with — all of which are the same answer to the caller.
 */
export function readGuestCookie(raw: string | undefined | null): GuestCookie | null {
  if (!raw) return null
  const key = secret()
  if (!key) return null

  const dot = raw.lastIndexOf('.')
  if (dot <= 0) return null
  const body = raw.slice(0, dot)
  const signature = raw.slice(dot + 1)

  const expected = Buffer.from(mac(body, key), 'utf8')
  const supplied = Buffer.from(signature, 'utf8')
  // timingSafeEqual throws on a length mismatch, which is itself a leak-free no.
  if (expected.length !== supplied.length || !timingSafeEqual(expected, supplied)) return null

  try {
    const parsed = JSON.parse(Buffer.from(body, 'base64url').toString('utf8')) as unknown
    if (!parsed || typeof parsed !== 'object') return null
    const candidate = parsed as Partial<GuestCookie>
    if (typeof candidate.g !== 'string' || !Array.isArray(candidate.s)) return null
    const entries = candidate.s.filter(
      (entry): entry is GuestSessionEntry =>
        Boolean(entry) &&
        typeof (entry as GuestSessionEntry).i === 'string' &&
        typeof (entry as GuestSessionEntry).c === 'number',
    )
    return { g: candidate.g, s: entries }
  } catch {
    return null
  }
}

/** Cookie attributes. `lax` so the redirect out of /try/talk carries it. */
export function guestCookieOptions() {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax' as const,
    path: '/',
    maxAge: GUEST_COOKIE_MAX_AGE_SECONDS,
  }
}

/** Entries opened inside the rolling day, oldest first. */
export function sessionsInLastDay(
  cookie: GuestCookie | null,
  nowSeconds: number,
): GuestSessionEntry[] {
  if (!cookie) return []
  return cookie.s
    .filter((entry) => nowSeconds - entry.c < GUEST_DAY_SECONDS)
    .sort((a, b) => a.c - b.c)
}

/** Rule 3, asked at creation time: may this browser open another one? */
export function canOpenGuestSession(cookie: GuestCookie | null, nowSeconds: number): boolean {
  return sessionsInLastDay(cookie, nowSeconds).length < GUEST_SESSIONS_PER_DAY
}

/**
 * The cookie with one more session recorded, pruned of entries older than the
 * rolling day so it cannot grow without bound. Idempotent: recording a session
 * the cookie already holds returns it unchanged, which is what makes
 * `create-session` safe to call twice.
 */
export function withGuestSession(
  cookie: GuestCookie | null,
  sessionId: string,
  nowSeconds: number,
): GuestCookie {
  const base = cookie ?? newGuestCookie()
  const kept = sessionsInLastDay(base, nowSeconds)
  if (kept.some((entry) => entry.i === sessionId)) return { g: base.g, s: kept }
  return { g: base.g, s: [...kept, { i: sessionId, c: nowSeconds }] }
}

/** The cookie with this session's last-mint stamp moved to now. */
export function withMint(
  cookie: GuestCookie,
  sessionId: string,
  nowSeconds: number,
): GuestCookie {
  return {
    g: cookie.g,
    s: cookie.s.map((entry) => (entry.i === sessionId ? { ...entry, m: nowSeconds } : entry)),
  }
}

export interface MintRefusal {
  /** Stable machine name; see the rule list at the top of this file. */
  code: string
  /** What the trainee is shown when the client surfaces it. */
  error: string
  status: number
  retryAfterSeconds?: number
}

/** The `clinical_sessions` columns the rules read. */
export interface GuestSessionRow {
  user_id: string | null
  status: string | null
  started_at: string | null
  station_id: string | null
}

export interface MintRefusalInput {
  cookie: GuestCookie | null
  sessionId: string
  /** Null when no row exists for that id. */
  session: GuestSessionRow | null
  /** The station id the client asked for, checked against the row's. */
  requestedStationId?: string | null
  /** Epoch milliseconds. */
  nowMs: number
}

/**
 * The whole gate, as a pure function: the reason to refuse, or null to mint.
 *
 * Pure so every rule can be pinned by a unit test without a database or an
 * Azure round-trip — the point of the exercise being that these refusals are
 * the only thing standing between a guessed UUID and our Azure bill.
 */
export function guestMintRefusal(input: MintRefusalInput): MintRefusal | null {
  const { cookie, sessionId, session, requestedStationId, nowMs } = input
  const nowSeconds = Math.floor(nowMs / 1000)

  if (!cookie) {
    return {
      code: 'guest_cookie_missing',
      error: 'Start your consultation from the link — this one has lost its place.',
      status: 403,
    }
  }

  const entry = cookie.s.find((candidate) => candidate.i === sessionId)
  if (!entry) {
    return {
      code: 'guest_session_unrecognised',
      error: 'Start your consultation from the link — this one has lost its place.',
      status: 403,
    }
  }

  // Rule 3 again. Creation refuses the fourth, so a cookie we signed can only
  // hold three; this catches a cookie signed before the cap existed.
  const day = sessionsInLastDay(cookie, nowSeconds)
  const rank = day.findIndex((candidate) => candidate.i === sessionId)
  if (rank >= GUEST_SESSIONS_PER_DAY) {
    return {
      code: 'guest_daily_limit',
      error: `That is ${GUEST_SESSIONS_PER_DAY} consultations today. Make an account for five stations over five days.`,
      status: 429,
    }
  }

  if (!session) {
    return {
      code: 'guest_session_unknown',
      error: 'That consultation no longer exists. Start a new one.',
      status: 404,
    }
  }

  if (session.user_id) {
    return {
      code: 'guest_session_owned',
      error: 'That consultation belongs to an account. Open it from your dashboard.',
      status: 403,
    }
  }

  if (
    requestedStationId &&
    session.station_id &&
    requestedStationId !== session.station_id
  ) {
    return {
      code: 'guest_station_mismatch',
      error: 'That consultation is for a different case. Start a new one.',
      status: 403,
    }
  }

  if (!STARTABLE_STATUSES.has(session.status ?? '')) {
    return {
      code: 'guest_session_not_startable',
      error: 'That consultation has already finished.',
      status: 403,
    }
  }

  // The row's own timestamp is authoritative; the cookie's `c` covers a row
  // written without one.
  const openedMs = session.started_at ? Date.parse(session.started_at) : NaN
  const openedSeconds = Number.isFinite(openedMs) ? Math.floor(openedMs / 1000) : entry.c
  if (nowSeconds - openedSeconds > GUEST_SESSION_MAX_AGE_SECONDS) {
    return {
      code: 'guest_session_expired',
      error: 'That consultation has been waiting too long. Start a new one.',
      status: 403,
    }
  }

  if (typeof entry.m === 'number') {
    const since = nowSeconds - entry.m
    if (since < GUEST_MINT_COOLDOWN_SECONDS) {
      return {
        code: 'guest_mint_cooldown',
        error: 'That consultation is already starting. Give it a moment and try again.',
        status: 429,
        retryAfterSeconds: Math.max(1, GUEST_MINT_COOLDOWN_SECONDS - since),
      }
    }
  }

  return null
}

/** One line per refusal, so "the gate said no" is visible in request logs. */
export function logGuestRefusal(route: string, sessionId: string, refusal: MintRefusal): void {
  console.warn(`[${route}] guest mint refused`, {
    code: refusal.code,
    status: refusal.status,
    session: sessionId,
  })
}
