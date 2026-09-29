import { BrevoClient, BrevoError } from '@getbrevo/brevo'
import { parseMeetingUrl } from '@/lib/commerce/coachingJoin'
import {
  coachingSessionLabel,
  COACHING_SESSION_HOURS,
  formatCoachingDateNoYear,
  slotTimeRange,
  type CoachingSlotKey,
} from '@/lib/commerce/coachingSlots'
import { buildCoachingIcs } from './coachingCalendar'
import { BRAND, button, emailShell, fallbackLink, paragraph, row, signoff } from './chrome'
import { firstNameFrom } from './trialEmails'

/**
 * "Your coaching session is confirmed" — the joining link for a booked one to
 * one coaching session, with a calendar invite attached.
 *
 * Sent only from /admin/coaching, when an admin presses Send after saving the
 * coach and the link. Never automatic: the coach and the link are typed by a
 * person, and the student should hear about their session once, correctly.
 *
 * Copy rules (shared with coachingSlots.ts): UK English, no em or en dashes,
 * and never a reference to the old small group format.
 */

export interface CoachingSessionEmailArgs {
  orderId: string
  toEmail: string
  /** preorders.full_name; the greeting uses the first name, "there" when none. */
  toName: string | null
  /** ISO date, coaching_day. */
  day: string
  /** Required: a slot-less legacy booking has no time to confirm. */
  slot: CoachingSlotKey
  /** How the coach is named to the student, e.g. "Dr Hassan Khan". */
  coachName: string
  /** Must already have passed parseMeetingUrl; the sender re-checks. */
  meetingUrl: string
}

export interface CoachingSessionEmail {
  subject: string
  htmlContent: string
  textContent: string
  ics: string
  icsFileName: string
}

export type CoachingSessionEmailResult =
  | { sent: true; brevoMessageId: string | null }
  | { sent: false; error: string }

const ICS_FILE_NAME = 'coaching-session.ics'

/**
 * Escape a person-typed value (the student's name, the coach's name) into HTML.
 * Same helper as trialEmails.ts: `paragraph()` interpolates verbatim.
 */
function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

/** The words of the email, before any markup. One source for html and text. */
function buildCopy(args: CoachingSessionEmailArgs) {
  const firstName = firstNameFrom(args.toName) ?? 'there'
  const when = `${coachingSessionLabel(args.day, args.slot)} (UK time)`
  return {
    subject: `Your coaching session: ${formatCoachingDateNoYear(args.day)}, ${slotTimeRange(args.slot)}`,
    preheader: 'Your joining link and what to expect.',
    heading: 'Your coaching session is confirmed.',
    greeting: `Hi ${firstName},`,
    when,
    booked: (coach: string, whenHtml: string) =>
      `Your one to one coaching session with ${coach} is booked for ${whenHtml}.`,
    format: `It runs for ${COACHING_SESSION_HOURS} hours on a video call, just the two of you. Join from a laptop or computer with a camera and microphone, somewhere quiet.`,
    prep: (coach: string) =>
      `Before the session, ${coach} will look through your Development page and the feedback on the cases you have practised, so the time goes on what is costing you marks. Practising a few more cases before then gives your coach more to work with.`,
    cta: 'Join the session',
    ctaNote: 'The same link is on your dashboard, and a calendar invite is attached.',
    reply: 'If anything changes or you have a question, just reply to this email.',
    closing: 'Best wishes,',
  }
}

/** Subject, html, plain text and the .ics for one booked session. Pure. */
export function buildCoachingSessionEmail(
  args: CoachingSessionEmailArgs,
  now?: Date,
): CoachingSessionEmail {
  const copy = buildCopy(args)
  const coachHtml = escapeHtml(args.coachName)

  const htmlContent = emailShell({
    title: escapeHtml(copy.subject),
    preheader: copy.preheader,
    heading: copy.heading,
    rows: [
      row(
        [
          paragraph(escapeHtml(copy.greeting)),
          paragraph(copy.booked(coachHtml, `<strong>${escapeHtml(copy.when)}</strong>`)),
          paragraph(copy.format),
          paragraph(copy.prep(coachHtml)),
        ].join('\n                '),
        '20px 40px 8px 40px',
      ),
      row(
        `${button(args.meetingUrl, copy.cta)}
                <p style="margin:14px 0 14px 0;font-size:13px;line-height:1.5;color:#78716C;">${copy.ctaNote}</p>
                ${fallbackLink(args.meetingUrl)}`,
        '0 40px 20px 40px',
      ),
      row(paragraph(copy.reply), '8px 40px 0 40px'),
      row(signoff(copy.closing), '8px 40px 36px 40px'),
    ],
  })

  const textContent = [
    copy.greeting,
    copy.booked(args.coachName, copy.when),
    copy.format,
    copy.prep(args.coachName),
    `${copy.cta}: ${args.meetingUrl}`,
    copy.ctaNote,
    copy.reply,
    copy.closing,
    'The Fourteen Fisherman Team',
    `${BRAND.senderName} · ${BRAND.siteUrl}`,
  ].join('\n\n')

  const ics = buildCoachingIcs({
    orderId: args.orderId,
    day: args.day,
    slot: args.slot,
    coachName: args.coachName,
    meetingUrl: args.meetingUrl,
    now,
  })

  return { subject: copy.subject, htmlContent, textContent, ics, icsFileName: ICS_FILE_NAME }
}

/** Pause between the two send attempts. Exported for tests only. */
export const RETRY_DELAY_MS = 1500

/**
 * Send the confirmation through Brevo.
 *
 * Two attempts, as accountEmail.ts does: the first call from a cold lambda can
 * die at the socket against Brevo's edge, and the admin pressing Send would
 * otherwise see a failure for an email that a second try delivers.
 */
export async function sendCoachingSessionEmail(
  args: CoachingSessionEmailArgs,
): Promise<CoachingSessionEmailResult> {
  const brevoKey = process.env.BREVO_API_KEY
  if (!brevoKey) {
    console.warn('[coaching-email] skipped: BREVO_API_KEY not set in env')
    return { sent: false, error: 'missing_BREVO_API_KEY' }
  }

  // chrome.ts puts the link into an href unescaped, by design. Anything that
  // did not come through parseMeetingUrl must never reach it.
  const meetingUrl = parseMeetingUrl(args.meetingUrl)
  if (!meetingUrl) return { sent: false, error: 'invalid_meeting_url' }

  const email = buildCoachingSessionEmail({ ...args, meetingUrl })
  const toName = args.toName?.trim()

  let lastError = 'brevo_error'
  for (let attempt = 1; attempt <= 2; attempt++) {
    try {
      const result = await new BrevoClient({ apiKey: brevoKey }).transactionalEmails.sendTransacEmail({
        sender: { name: BRAND.senderName, email: BRAND.senderEmail },
        // The copy invites a reply; it has to reach a person.
        replyTo: { name: BRAND.senderName, email: BRAND.senderEmail },
        to: [{ email: args.toEmail, ...(toName ? { name: toName } : {}) }],
        subject: email.subject,
        htmlContent: email.htmlContent,
        textContent: email.textContent,
        attachment: [
          { content: Buffer.from(email.ics, 'utf8').toString('base64'), name: email.icsFileName },
        ],
        tags: ['coaching-session'],
      })
      const brevoMessageId = result?.messageId ?? null
      console.log('[coaching-email] sent', { email: args.toEmail, brevoMessageId })
      return { sent: true, brevoMessageId }
    } catch (error) {
      if (error instanceof BrevoError) {
        lastError = `${error.statusCode} ${error.message}`
        console.error('[coaching-email] Brevo API error', {
          email: args.toEmail,
          attempt,
          statusCode: error.statusCode,
          message: error.message,
        })
      } else {
        lastError = error instanceof Error ? error.message : String(error)
        console.error('[coaching-email] send failed', { email: args.toEmail, attempt, error })
      }
      if (attempt < 2) await new Promise((resolve) => setTimeout(resolve, RETRY_DELAY_MS))
    }
  }
  return { sent: false, error: lastError }
}
