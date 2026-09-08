/**
 * How short a password may be, in the one place both ends can read it.
 *
 * The form checks it to enable its button and the verify route checks it again
 * before anything is written, because a client check is a courtesy and not a
 * rule. They were briefly two constants in two files; the failure that shape
 * produces is a button that submits a password the server then refuses, which
 * is a dead end with no message worth reading.
 *
 * No `server-only` marker: this is a number and a sentence, imported by a client
 * component (components/free/FreeStart) as well as by the route.
 *
 * Eight is Supabase GoTrue's own default minimum. Raising it here without
 * raising it there would be theatre; raising it there is a project setting and a
 * decision about everybody's password, not this door's.
 */

export const MIN_PASSWORD_LENGTH = 8

/** The hint under the field. One line, states the rule, promises nothing else. */
export const PASSWORD_HINT = `${MIN_PASSWORD_LENGTH} characters or more`

/** True when a typed password is long enough to be worth sending. */
export function passwordLongEnough(password: string): boolean {
  return password.length >= MIN_PASSWORD_LENGTH
}
