/**
 * The last thing that looks at an email before it leaves the building.
 *
 * Three cheap structural checks, each standing in for a specific way email
 * tooling has gone wrong before: a template that returned an empty string or a
 * fragment; one that lost its body and became a bare shell; and one addressed
 * to the wrong person because a loop variable was reused between recipients.
 * None of them can tell whether the copy is good — that is what the template
 * tests are for. They exist to make a broken build of an email un-sendable.
 *
 * Split out of due.ts so it can be tested. An assertion that has never been
 * seen to fail is an assertion that might be inverted.
 */

/** What the guard needs from a built email. Structurally {@link RenderedEmail}. */
export interface GuardableEmail {
  html: string
  greeting: string
}

/** The shortest an email of ours can plausibly be: the house shell alone is ~2.5KB. */
export const MIN_HTML_LENGTH = 2000

/**
 * HTML escaping, written a second time on purpose.
 *
 * This guard exists to catch a template that has broken. Importing the
 * builder's own escape function would mean the check and the thing it checks
 * share every bug, which is not a check at all.
 */
function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

/**
 * Throw unless this really is the email we meant to send to this person.
 *
 * Throwing aborts that recipient, not the run — see due.ts, which reports the
 * refusal and carries on with the rest of the batch.
 */
export function assertSendable(email: GuardableEmail, toEmail: string): void {
  const html = email?.html ?? ''
  if (!html.toLowerCase().startsWith('<!doctype html')) {
    throw new Error(`${toEmail}: html is not a document`)
  }
  if (html.length <= MIN_HTML_LENGTH) {
    throw new Error(`${toEmail}: html is only ${html.length} chars — the body is missing`)
  }
  // The greeting carries the recipient's own name, so this is the one check
  // that can catch an email built for somebody else.
  if (!html.includes(escapeHtml(email.greeting))) {
    throw new Error(`${toEmail}: html does not carry this recipient's greeting`)
  }
}
