import 'server-only'
import { createHmac, timingSafeEqual } from 'node:crypto'

/**
 * Signed access to an advocate's own referral tracker.
 *
 * The tracker hangs off /share/[code], and the code itself is semi-public: it
 * travels in every /r/CODE link an advocate shares, so anyone who receives one
 * could otherwise guess their way to that advocate's earnings. A token in the
 * campaign link keeps the numbers to the person they belong to, without asking
 * a lead who has no account to create one.
 *
 * Deliberately NOT a session: it grants read-only sight of one code's progress
 * and nothing else, so a leaked link costs an advocate their referral stats and
 * not an account.
 */

const TOKEN_BYTES = 16 // 32 hex chars — plenty against guessing, short in a URL

/** Reads the signing secret. Absent secret disables the tracker entirely. */
function secret(): string | null {
  const raw = process.env.REFERRAL_SHARE_SECRET?.trim()
  return raw && raw.length > 0 ? raw : null
}

/**
 * Token for a code, or null when no secret is configured — callers must treat
 * null as "no tracker", never as "let them in".
 */
export function signShareToken(code: string): string | null {
  const key = secret()
  if (!key) return null
  return createHmac('sha256', key).update(code).digest('hex').slice(0, TOKEN_BYTES * 2)
}

/**
 * Constant-time check of a supplied token. False whenever anything is missing
 * or malformed, so the tracker fails closed: a misconfigured secret shows the
 * plain share page rather than exposing everyone's figures.
 */
export function verifyShareToken(code: string, token: string | undefined | null): boolean {
  if (!token) return false
  const expected = signShareToken(code)
  if (!expected) return false
  const a = Buffer.from(expected, 'utf8')
  const b = Buffer.from(token, 'utf8')
  // timingSafeEqual throws on length mismatch, which is itself a leak-free no.
  return a.length === b.length && timingSafeEqual(a, b)
}

/**
 * The full tracker URL for a code, or the plain share URL when unsigned.
 *
 * The token goes in the path, not a query string: Brevo rewrites every link in a
 * campaign for click tracking, and the rewritten form of a `?t=...` URL 404s.
 */
export function shareUrlFor(origin: string, code: string): string {
  const token = signShareToken(code)
  return token ? `${origin}/share/${code}/${token}` : `${origin}/share/${code}`
}
