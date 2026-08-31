/**
 * Pure, dependency-free validation for admin-issued advocate codes.
 *
 * The only import is {@link normalizeCode}/{@link generateReferralCode} from the
 * sibling referrals module (themselves pure) — no Supabase / next / Stripe — so
 * this is trivially unit-testable and safe to import from server routes. Every
 * value returned is a fresh, cleaned snapshot: no I/O, no mutation of the input.
 */

import { generateReferralCode, normalizeCode } from './referrals'

/** Raw create-code input from the admin form (already JSON-parsed). */
export interface NewCodeInput {
  ownerName?: string
  ownerEmail?: string
  code?: string
  rewardOverridePence?: number | null
}

/** Cleaned, validated values ready to insert into `referral_codes`. */
export interface ValidatedNewCode {
  code: string
  ownerName: string
  ownerEmail: string
  rewardOverridePence: number | null
}

/** Discriminated result: either the cleaned value or a user-facing error. */
export type NewCodeResult =
  | { ok: true; value: ValidatedNewCode }
  | { ok: false; error: string }

/**
 * Basic email shape check. Deliberately permissive (one `@`, a dot-bearing
 * domain, no spaces) — the goal is to reject obvious typos at the boundary, not
 * to fully validate deliverability.
 */
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

/**
 * Validate and clean a new advocate code request. Pure — returns a fresh
 * {@link ValidatedNewCode} on success or a `{ ok: false, error }` describing the
 * first failing rule:
 *  - `ownerName` is trimmed and must be non-empty.
 *  - `ownerEmail` is trimmed + lowercased and must match {@link EMAIL_RE}.
 *  - `code`, if supplied, is normalized and must be 3–16 chars after
 *    normalization; if absent it is generated from the owner's name.
 *  - `rewardOverridePence`, if supplied, must be an integer >= 0; null/undefined
 *    becomes `null` (fall back to the plan tier).
 */
export function validateNewCode(input: NewCodeInput): NewCodeResult {
  const ownerName = (input.ownerName ?? '').trim()
  if (ownerName.length === 0) {
    return { ok: false, error: 'Name is required' }
  }

  const ownerEmail = (input.ownerEmail ?? '').trim().toLowerCase()
  if (!EMAIL_RE.test(ownerEmail)) {
    return { ok: false, error: 'A valid email is required' }
  }

  let code: string
  if (input.code !== undefined && input.code !== null && input.code.trim() !== '') {
    code = normalizeCode(input.code)
    // normalizeCode caps its output at 16 chars; measure the pre-cap normalized
    // length so an over-long custom code is rejected outright rather than
    // silently truncated into a link the owner never chose.
    const normalizedLength = input.code.toUpperCase().replace(/[^A-Z0-9]/g, '').length
    if (normalizedLength < 3 || normalizedLength > 16) {
      return { ok: false, error: 'Code must be 3–16 letters/numbers' }
    }
  } else {
    code = generateReferralCode(ownerName)
  }

  let rewardOverridePence: number | null
  if (input.rewardOverridePence === undefined || input.rewardOverridePence === null) {
    rewardOverridePence = null
  } else if (!Number.isInteger(input.rewardOverridePence) || input.rewardOverridePence < 0) {
    return { ok: false, error: 'Reward override must be a whole number of pence, 0 or more' }
  } else {
    rewardOverridePence = input.rewardOverridePence
  }

  return { ok: true, value: { code, ownerName, ownerEmail, rewardOverridePence } }
}

/** Cleaned values for a self-serve code minted from an email address alone. */
export interface ValidatedSelfServeCode {
  code: string
  ownerEmail: string
}

/** Discriminated result for {@link validateSelfServeCode}. */
export type SelfServeCodeResult =
  | { ok: true; value: ValidatedSelfServeCode }
  | { ok: false; error: string }

/**
 * Validate a PUBLIC "send me my link" request, where the only thing collected is
 * an email address.
 *
 * A separate function rather than a relaxed {@link validateNewCode}: the admin
 * path genuinely wants a name (an affiliate deal is negotiated with a person,
 * and the admin table is unusable without one), so loosening the shared
 * validator would weaken a rule that still earns its keep. Here there is no name
 * to have, and inventing one from the email local-part would put a fabricated
 * "Nabil.khan" into `owner_name`, the admin table and the greeting line of every
 * email we send them. `owner_name` is nullable, so the honest value is null.
 *
 * The local-part is still used for the code PREFIX, which is the one place it
 * genuinely helps: `nabil.khan@nhs.net` yields a link like /r/NABKXY7Q rather
 * than an anonymous /r/FFXY7Q. {@link generateReferralCode} strips everything
 * outside the unambiguous alphabet and falls back to 'FF', so a local-part of
 * '123' or '....' degrades safely.
 */
export function validateSelfServeCode(input: { ownerEmail?: string }): SelfServeCodeResult {
  const ownerEmail = (input.ownerEmail ?? '').trim().toLowerCase()
  if (!EMAIL_RE.test(ownerEmail)) {
    return { ok: false, error: 'A valid email is required' }
  }

  const localPart = ownerEmail.split('@')[0] ?? ''
  return { ok: true, value: { code: generateReferralCode(localPart), ownerEmail } }
}
