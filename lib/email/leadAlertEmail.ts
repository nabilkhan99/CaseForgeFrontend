import 'server-only'
import { BrevoClient, BrevoError } from '@getbrevo/brevo'

/** Which moment in the funnel produced the lead. */
export type LeadAlertDoor = 'guest_signup' | 'report_link'

export interface SendLeadAlertEmailArgs {
  sessionId: string
  email: string
  firstName?: string | null
  phone?: string | null
  trainingStage?: string | null
  scaSitting?: string | null
  stationTitle?: string | null
  door: LeadAlertDoor
}

const DOOR_LABELS: Record<LeadAlertDoor, string> = {
  guest_signup: 'Signed up after a free case',
  report_link: 'Verified on a report link',
}

/** What a field reads as when the lead did not give it. */
const NOT_GIVEN = 'Not given'

export interface LeadAlertCopy {
  subject: string
  rows: Array<[string, string]>
  feedbackUrl: string
}

/**
 * The rows, subject and link, pure so they can be pinned without Brevo.
 *
 * The same payload the alert carried on main (name, email, phone, training
 * stage, SCA sitting, station, report link), plus how the lead arrived. There
 * is no SMS step any more, so the phone is shown as given, unmarked.
 */
export function buildLeadAlertCopy(args: SendLeadAlertEmailArgs): LeadAlertCopy {
  const name = args.firstName?.trim() || 'Unknown'
  const phone = args.phone?.trim() || ''
  return {
    subject: `Mock lead: ${name} (${phone || args.email})`,
    feedbackUrl: `https://www.fourteenfisherman.com/try/feedback/${args.sessionId}`,
    rows: [
      ['Name', name],
      ['Email', args.email],
      ['Phone', phone || NOT_GIVEN],
      ['Training stage', args.trainingStage?.trim() || NOT_GIVEN],
      ['SCA sitting', args.scaSitting?.trim() || NOT_GIVEN],
      ['Station', args.stationTitle?.trim() || NOT_GIVEN],
      ['How', DOOR_LABELS[args.door]],
    ],
  }
}

/** Lead-typed text goes into HTML, so it is escaped first. */
function escapeHtml(value: string): string {
  return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}

/**
 * Internal alert to the founders the moment a trial lead verifies their email,
 * the highest-intent point in the funnel, so the follow-up call can happen
 * while the consultation is still fresh. Recipients come from
 * LEAD_ALERT_RECIPIENTS (comma-separated), defaulting to
 * hello@fourteenfisherman.com. Best-effort: never throws, and a failure must
 * never reach the person who just verified.
 */
export async function sendLeadAlertEmail(args: SendLeadAlertEmailArgs): Promise<void> {
  const brevoKey = process.env.BREVO_API_KEY
  if (!brevoKey) {
    console.warn('[lead-alert] skipped: BREVO_API_KEY not set in env')
    return
  }

  const recipients = (process.env.LEAD_ALERT_RECIPIENTS ?? 'hello@fourteenfisherman.com')
    .split(',')
    .map((address) => address.trim())
    .filter(Boolean)
  if (recipients.length === 0) return

  const { subject, rows, feedbackUrl } = buildLeadAlertCopy(args)

  const htmlRows = rows
    .map(
      ([label, value]) =>
        `<tr><td style="padding:6px 16px 6px 0;color:#78716C;font-size:13px;white-space:nowrap;">${label}</td><td style="padding:6px 0;color:#1C1917;font-size:14px;font-weight:600;">${escapeHtml(value)}</td></tr>`,
    )
    .join('')

  const htmlBody = `<!doctype html>
<html lang="en">
  <body style="margin:0;padding:24px;background:#F5F0EB;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;color:#1C1917;">
    <div style="max-width:520px;margin:0 auto;background:#FFFCF8;border:1px solid rgba(28,25,23,0.06);border-radius:14px;padding:28px 32px;">
      <h1 style="margin:0 0 4px 0;font-size:19px;">New verified mock lead</h1>
      <p style="margin:0 0 16px 0;font-size:13px;color:#78716C;">Just finished a free case and verified their email. Call while it's hot.</p>
      <table role="presentation" cellpadding="0" cellspacing="0" border="0">${htmlRows}</table>
      <p style="margin:18px 0 0 0;font-size:13px;"><a href="${feedbackUrl}" style="color:#B45309;">View their feedback report</a></p>
    </div>
  </body>
</html>`

  const textBody = `New verified mock lead. Call while it's hot.

${rows.map(([label, value]) => `${label}: ${value}`).join('\n')}

Feedback report: ${feedbackUrl}`

  const brevo = new BrevoClient({ apiKey: brevoKey })
  try {
    await brevo.transactionalEmails.sendTransacEmail({
      sender: { name: 'Fourteen Fisherman', email: 'hello@fourteenfisherman.com' },
      to: recipients.map((address) => ({ email: address })),
      subject,
      htmlContent: htmlBody,
      textContent: textBody,
      tags: ['lead-alert'],
    })
  } catch (error: unknown) {
    if (error instanceof BrevoError) {
      console.error('[lead-alert] Brevo API error', {
        statusCode: error.statusCode,
        message: error.message,
      })
      return
    }
    console.error('[lead-alert] Brevo SDK threw', { error })
  }
}
