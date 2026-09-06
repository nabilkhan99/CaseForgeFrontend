import { createHmac, timingSafeEqual } from 'node:crypto'
import type { TrialSource } from '@/lib/commerce/trialAccess'

/**
 * The signed link behind door (c): "here are your five stations, click once".
 *
 * One link, valid 24 hours, that names an address and the door it came
 * through. Redeeming it creates the account if there isn't one, claims any
 * guest consultation that address already sat, grants the five, signs the
 * browser in and lands on /dashboard — see app/api/auth/start.
 *
 * ## Why a signed token and not a row
 *
 * There is nothing to store. The link's whole content is "this address was
 * invited, by us, before this instant", which a MAC over those three fields
 * proves without a table to insert into, clean up, or leak. It also means a
 * mint run is pure: the script can produce 185 links without writing anything,
 * so a dry run is genuinely dry.
 *
 * The cost is that a minted link cannot be revoked before it expires. That is
 * the same property {@link import('./provisioning').mintSetPasswordLink} has,
 * and it is bounded the same way: 24 hours, one address per link.
 *
 * ## What a link is worth
 *
 * ⚠️ BEARER CREDENTIAL. Whoever holds it becomes that account. Treat it exactly
 * as the set-password link is treated: short expiry, one address per link,
 * never logged, never put in a URL that gets shared. A forwarded email hands
 * the account over, which is the accepted trade for a one-click door.
 *
 * The MAC is what makes that a bounded risk rather than an open one: without
 * the secret you cannot mint a link for an address you were not sent, so the
 * worst case is a leaked link, not a link generator.
 *
 * ## Not a client module
 *
 * Deliberately NOT importing `server-only`, so the mint script and the unit
 * tests can load it in plain Node. It is still unusable from the browser: the
 * secret comes from `TRIAL_LINK_SECRET`, which is not `NEXT_PUBLIC_`, so a
 * client bundle inlines `undefined` and every call fails closed rather than
 * shipping a signing key. Do not "fix" that by exposing the variable.
 */

/** The doors that hand out a link. Sign-up and the guest reveal do not. */
export type TrialLinkSource = Extract<TrialSource, 'link' | 'cohort'>

/** 24 hours — the same window the set-password link has, for the same reasons. */
export const TRIAL_LINK_TTL_MS = 24 * 60 * 60 * 1000

/** Bumped if the payload shape ever changes; an unknown version is refused. */
const TOKEN_VERSION = 1

export interface TrialLinkPayload {
  email: string
  source: TrialLinkSource
  /** Epoch ms after which the token is refused. */
  expiresAt: number
}

/** The wire shape. Short keys because this rides in a URL people paste. */
interface WirePayload {
  v: number
  e: string
  s: string
  x: number
}

export type TrialLinkFailure =
  /** No `TRIAL_LINK_SECRET` in the environment — minting and verifying both refuse. */
  | 'no_secret'
  /** Not two base64url segments, or the payload is not the shape we write. */
  | 'malformed'
  /** The MAC does not match: the token was edited, or signed with another secret. */
  | 'bad_signature'
  /** Past `expiresAt`. */
  | 'expired'

export type TrialLinkResult =
  | { ok: true; payload: TrialLinkPayload }
  | { ok: false; reason: TrialLinkFailure }

function base64url(input: Buffer): string {
  return input.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

function fromBase64url(input: string): Buffer {
  return Buffer.from(input.replace(/-/g, '+').replace(/_/g, '/'), 'base64')
}

/**
 * The signing key, or null.
 *
 * Read on every call rather than at module load: the env is not populated at
 * import time in tests, and reading a string is free next to the HMAC.
 */
function secretFrom(override?: string): string | null {
  const secret = (override ?? process.env.TRIAL_LINK_SECRET ?? '').trim()
  return secret.length > 0 ? secret : null
}

function sign(body: string, secret: string): string {
  return base64url(createHmac('sha256', secret).update(body).digest())
}

export interface MintTrialLinkInput {
  email: string
  source: TrialLinkSource
  /** Defaults to {@link TRIAL_LINK_TTL_MS} from `now`. */
  ttlMs?: number
  /** Injected by the tests; production reads `TRIAL_LINK_SECRET`. */
  secret?: string
  now?: Date
}

/**
 * A token for one address, or null when there is no secret to sign it with.
 *
 * Null rather than a throw: the caller is usually a route that has other work
 * to finish (the account is already created and the grant already made by the
 * time a link is minted), and a missing env var must degrade to "no link" —
 * which every caller renders as "we could not sign you in automatically" —
 * rather than failing the whole request.
 */
export function mintTrialLink(input: MintTrialLinkInput): string | null {
  const secret = secretFrom(input.secret)
  if (!secret) {
    console.warn('[trial-link] TRIAL_LINK_SECRET is not set — no link minted')
    return null
  }

  const email = input.email.trim().toLowerCase()
  if (!email) return null

  const now = input.now?.getTime() ?? Date.now()
  const payload: WirePayload = {
    v: TOKEN_VERSION,
    e: email,
    s: input.source,
    x: now + (input.ttlMs ?? TRIAL_LINK_TTL_MS),
  }

  const body = base64url(Buffer.from(JSON.stringify(payload), 'utf8'))
  return `${body}.${sign(body, secret)}`
}

export interface VerifyTrialLinkOptions {
  secret?: string
  now?: Date
}

/**
 * Check a token and read what it says, or say why it cannot be trusted.
 *
 * Order matters and is not cosmetic: the signature is checked BEFORE the
 * expiry, so an attacker cannot learn anything about the secret by watching
 * which of the two failures comes back. Both are answered with a friendly
 * "this link has expired" page by the caller anyway.
 */
export function verifyTrialLink(
  token: string | null | undefined,
  options: VerifyTrialLinkOptions = {},
): TrialLinkResult {
  const secret = secretFrom(options.secret)
  if (!secret) return { ok: false, reason: 'no_secret' }

  const raw = token?.trim() ?? ''
  const parts = raw.split('.')
  if (parts.length !== 2 || !parts[0] || !parts[1]) return { ok: false, reason: 'malformed' }

  const [body, mac] = parts

  // Constant-time, and length-checked first because timingSafeEqual throws on
  // mismatched lengths — a throw here would be a 500 on an attacker-supplied
  // string, which is both a leak and an availability problem.
  const expected = Buffer.from(sign(body, secret), 'utf8')
  const provided = Buffer.from(mac, 'utf8')
  if (expected.length !== provided.length || !timingSafeEqual(expected, provided)) {
    return { ok: false, reason: 'bad_signature' }
  }

  let parsed: unknown
  try {
    parsed = JSON.parse(fromBase64url(body).toString('utf8'))
  } catch {
    return { ok: false, reason: 'malformed' }
  }

  const wire = parsed as Partial<WirePayload> | null
  if (
    !wire ||
    wire.v !== TOKEN_VERSION ||
    typeof wire.e !== 'string' ||
    typeof wire.x !== 'number' ||
    (wire.s !== 'link' && wire.s !== 'cohort')
  ) {
    return { ok: false, reason: 'malformed' }
  }

  const now = options.now?.getTime() ?? Date.now()
  if (now >= wire.x) return { ok: false, reason: 'expired' }

  return {
    ok: true,
    payload: { email: wire.e.trim().toLowerCase(), source: wire.s, expiresAt: wire.x },
  }
}

/** Where a minted token is redeemed. One page, whichever door minted it. */
export function trialLinkUrl(origin: string, token: string): string {
  const url = new URL('/auth/start', origin)
  url.searchParams.set('token', token)
  return url.toString()
}

/**
 * The other kind of link that lands on the same page: a GoTrue recovery
 * `token_hash`, for an account we have JUST created and already granted.
 *
 * Used by `/api/try/verify-code`, which has done the account, claim and grant
 * work itself and only needs to hand the browser a way to be signed in. It
 * needs no `TRIAL_LINK_SECRET`, which is why the sign-up and guest-reveal doors
 * work before that variable is set anywhere.
 */
export function trialSignInUrl(origin: string, tokenHash: string, email: string): string {
  const url = new URL('/auth/start', origin)
  url.searchParams.set('token_hash', tokenHash)
  url.searchParams.set('email', email)
  return url.toString()
}
