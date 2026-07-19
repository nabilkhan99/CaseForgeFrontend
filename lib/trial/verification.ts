import 'server-only'
import { createHash, randomInt, timingSafeEqual } from 'crypto'

/**
 * Email verification for the trial feedback gate.
 * A 6-digit code is emailed to the lead; only a salted hash is stored, with a
 * short expiry, an attempt cap and a resend cooldown enforced server-side.
 */

export const CODE_LENGTH = 6
export const CODE_TTL_MS = 10 * 60 * 1000
export const RESEND_COOLDOWN_SECONDS = 60
export const MAX_VERIFY_ATTEMPTS = 5

export function generateVerificationCode(): string {
  return String(randomInt(0, 10 ** CODE_LENGTH)).padStart(CODE_LENGTH, '0')
}

/**
 * Hash the code bound to the email it was sent to, so a code issued for one
 * address can never verify another. Salted with the service-role key (always
 * present server-side) purely to make offline guessing of the 6-digit space
 * from a leaked row harder.
 */
export function hashVerificationCode(code: string, email: string): string {
  const salt = process.env.SUPABASE_SERVICE_ROLE_KEY ?? ''
  return createHash('sha256').update(`${salt}:${email}:${code}`).digest('hex')
}

export function verificationCodeMatches(
  code: string,
  email: string,
  storedHash: string,
): boolean {
  const candidate = Buffer.from(hashVerificationCode(code, email), 'hex')
  const stored = Buffer.from(storedHash, 'hex')
  return candidate.length === stored.length && timingSafeEqual(candidate, stored)
}
