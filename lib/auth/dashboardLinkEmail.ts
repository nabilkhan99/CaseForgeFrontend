import 'server-only'
import { BrevoClient } from '@getbrevo/brevo'
import { BRAND, button, emailShell, fallbackLink, paragraph, row, signoff } from '@/lib/email/chrome'

/**
 * "Open your dashboard" — the mail carrying a door-(c) link.
 *
 * Sent only when a person asks for it, from the button on their own report
 * (app/api/try/dashboard-link) or from the "send me a fresh one" fallback on
 * /auth/start. Never sent in a batch and never sent unprompted: the mint script
 * writes links to a CSV and stops.
 *
 * Built on the house shell (lib/email/chrome) and the same Brevo transactional
 * call every other sender in this codebase makes, so it skips cleanly with no
 * `BREVO_API_KEY` rather than throwing on a local machine.
 *
 * The 24 hours in the copy is real and not a round number chosen for comfort:
 * a signed trial link's TTL is TRIAL_LINK_TTL_MS, matched to GoTrue's
 * uncapped-by-us `MAILER_OTP_EXP` so both kinds of link say the same thing.
 */

export interface SendDashboardLinkArgs {
  toEmail: string
  toName?: string | null
  /** A redemption URL from `trialLinkUrl`. Interpolated verbatim — never user input. */
  dashboardUrl: string
}

export type SendDashboardLinkResult = { sent: true } | { sent: false; skipped: string }

export function buildDashboardLinkCopy(firstNameRaw?: string | null) {
  const firstName = firstNameRaw?.trim().split(' ')[0] || 'there'
  return {
    subject: 'Your dashboard is ready',
    heading: 'Your dashboard is ready.',
    greeting: `Hi ${firstName},`,
    lines: [
      'The button below signs you in and opens your dashboard. Your consultation, its report and your board are all there.',
      'Five stations, five days from your first consultation, no card. Nothing to cancel.',
    ],
    cta: 'Open my dashboard',
    expiryNote: 'This link signs you in, works once, and expires in 24 hours.',
  }
}

export async function sendDashboardLinkEmail({
  toEmail,
  toName,
  dashboardUrl,
}: SendDashboardLinkArgs): Promise<SendDashboardLinkResult> {
  const brevoKey = process.env.BREVO_API_KEY
  if (!brevoKey) {
    console.warn('[dashboard-link-email] skipped: BREVO_API_KEY not set in env')
    return { sent: false, skipped: 'missing_BREVO_API_KEY' }
  }

  const copy = buildDashboardLinkCopy(toName)

  const htmlContent = emailShell({
    title: copy.subject,
    preheader: 'One click and you are signed in.',
    heading: copy.heading,
    rows: [
      row(
        [paragraph(copy.greeting), ...copy.lines.map(paragraph)].join('\n                '),
        '20px 40px 8px 40px',
      ),
      row(
        `${button(dashboardUrl, copy.cta)}
                <p style="margin:14px 0 14px 0;font-size:13px;line-height:1.5;color:#78716C;">${copy.expiryNote}</p>
                ${fallbackLink(dashboardUrl)}`,
        '0 40px 28px 40px',
      ),
      row(signoff('See you in there,'), '0 40px 36px 40px'),
    ],
  })

  try {
    await new BrevoClient({ apiKey: brevoKey }).transactionalEmails.sendTransacEmail({
      sender: { name: BRAND.senderName, email: BRAND.senderEmail },
      // They asked for this link; if it does not work, their reply has to reach
      // a person rather than Brevo's bounce address.
      replyTo: { name: BRAND.senderName, email: BRAND.senderEmail },
      to: [{ email: toEmail, ...(toName ? { name: toName } : {}) }],
      subject: copy.subject,
      htmlContent,
    })
    return { sent: true }
  } catch (error) {
    console.error('[dashboard-link-email] send failed', { toEmail, error })
    return { sent: false, skipped: 'brevo_error' }
  }
}
