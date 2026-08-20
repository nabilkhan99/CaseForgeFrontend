/**
 * How a purchase row is matched to the signed-in account.
 *
 * Purchases key off email (buying email = account email, by product decision),
 * and the RLS policy compares `lower(email) = lower(auth.jwt()->>'email')`.
 * A query filter layered on top of that policy has to agree with it: a
 * case-SENSITIVE `.eq` would hide rows RLS happily returns, so a
 * hand-provisioned row stored as `Sarah@Nhs.net` would lock out someone who
 * paid. `.ilike` matches the policy's case-insensitivity.
 *
 * `.ilike` takes a *pattern*, though, where `%` and `_` are wildcards — and
 * `_` is common in real addresses (`sarah_jones@nhs.net` would otherwise also
 * match `sarahxjones@nhs.net`). {@link exactEmailPattern} escapes them so the
 * filter stays an equality test.
 */
export function exactEmailPattern(email: string | null | undefined): string {
  return (email ?? '').trim().replace(/[\\%_]/g, '\\$&')
}
