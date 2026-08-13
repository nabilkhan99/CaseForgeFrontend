import 'server-only'
import { BrevoClient, BrevoError } from '@getbrevo/brevo'

interface SendLeadAlertEmailArgs {
  sessionId: string
  email: string
  firstName?: string | null
  phone?: string | null
  /** Whether the number confirmed a texted code. False = fail-open pass. */
  phoneVerified?: boolean
  trainingStage?: string | null
  scaSitting?: string | null
  stationTitle?: string | null
}

/**
 * Internal alert to the founders the moment a trial lead verifies their email
 * — the highest-intent point in the funnel, so the follow-up call can happen
 * while the mock is still fresh. Recipients come from LEAD_ALERT_RECIPIENTS
 * (comma-separated), defaulting to hello@fourteenfisherman.com. Best-effort:
 * never throws, and a failure must not block the feedback reveal.
 */
export async function sendLeadAlertEmail({
  sessionId,
  email,
  firstName,
  phone,
  phoneVerified,
  trainingStage,
  scaSitting,
  stationTitle,
}: SendLeadAlertEmailArgs): Promise<void> {
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

  const name = firstName?.trim() || 'Unknown'
  const feedbackUrl = `https://www.fourteenfisherman.com/try/feedback/${sessionId}`

  const rows: Array<[string, string]> = [
    ['Name', name],
    ['Email', email],
    [
      'Phone',
      phone?.trim()
        ? `${phone.trim()}${phoneVerified === false ? ' (UNVERIFIED — SMS could not be sent)' : phoneVerified ? ' ✓ verified' : ''}`
        : '—',
    ],
    ['Training stage', trainingStage?.trim() || '—'],
    ['SCA sitting', scaSitting?.trim() || '—'],
    ['Station', stationTitle?.trim() || '—'],
  ]

  // Name and free-ish fields are lead-typed text — escape them before HTML.
  const escapeHtml = (value: string) =>
    value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')

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
      <p style="margin:0 0 16px 0;font-size:13px;color:#78716C;">Just finished the free mock and verified their email — call while it's hot.</p>
      <table role="presentation" cellpadding="0" cellspacing="0" border="0">${htmlRows}</table>
      <p style="margin:18px 0 0 0;font-size:13px;"><a href="${feedbackUrl}" style="color:#B45309;">View their feedback report</a></p>
    </div>
  </body>
</html>`

  const textBody = `New verified mock lead — call while it's hot.

${rows.map(([label, value]) => `${label}: ${value}`).join('\n')}

Feedback report: ${feedbackUrl}`

  const brevo = new BrevoClient({ apiKey: brevoKey })
  try {
    await brevo.transactionalEmails.sendTransacEmail({
      sender: { name: 'Fourteen Fisherman', email: 'hello@fourteenfisherman.com' },
      to: recipients.map((address) => ({ email: address })),
      subject: `Mock lead: ${name} (${phone?.trim() || email})`,
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
