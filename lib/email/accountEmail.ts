import { BrevoClient } from '@getbrevo/brevo'
import { BRAND, button, emailShell, paragraph, row } from './chrome'

/**
 * "Your account is ready — set your password".
 *
 * This is now the SELF-SERVICE path only: /api/auth/resend-set-password, for a
 * buyer whose link expired. The purchase path no longer sends it — a new buyer
 * gets the receipt email with the same link as its button, so they receive one
 * mail rather than two. Kept because the resend route is the answer to an
 * expired link and has to keep working exactly as it does.
 */

export interface SetPasswordEmailCopy {
  subject: string
  heading: string
  greeting: string
  lines: string[]
  cta: string
  /** The small print under the button. */
  expiryNote: string
}

/**
 * How long a set-password link actually lasts.
 *
 * ⚠️ 24 hours, not the 7 days the receipt spec asks for, and this is a real
 * constraint rather than a choice. The link is a Supabase GoTrue recovery
 * token, whose lifetime is `MAILER_OTP_EXP` — which Supabase caps at 24 hours.
 * Nothing in this codebase can extend it; 7 days would need a bespoke token
 * table. So the emails state what is true, and the self-serve resend at
 * /api/auth/resend-set-password is the recovery path for anyone who misses it.
 */
export const SET_PASSWORD_LINK_EXPIRY = '24 hours'

export const SET_PASSWORD_EXPIRY_NOTE = `This link can only be used once and expires in ${SET_PASSWORD_LINK_EXPIRY}. If it has expired, the sign-in page will send you a fresh one.`

export function buildSetPasswordEmailCopy(firstNameRaw?: string | null): SetPasswordEmailCopy {
  const firstName = firstNameRaw?.trim().split(' ')[0] || 'there'
  return {
    subject: 'Your Fourteen Fisherman account is ready',
    heading: 'Your account is ready.',
    greeting: `Hi ${firstName},`,
    lines: [
      'Your Fourteen Fisherman account has been created — set a password and you can start practising.',
      'The button below signs you in securely and asks you to choose your password.',
    ],
    cta: 'Set my password',
    expiryNote: SET_PASSWORD_EXPIRY_NOTE,
  }
}

interface SendSetPasswordEmailArgs {
  toEmail: string
  toName?: string | null
  setPasswordUrl: string
}

export type SendSetPasswordEmailResult = { sent: true } | { sent: false; skipped: string }

export async function sendSetPasswordEmail({
  toEmail,
  toName,
  setPasswordUrl,
}: SendSetPasswordEmailArgs): Promise<SendSetPasswordEmailResult> {
  const brevoKey = process.env.BREVO_API_KEY
  if (!brevoKey) {
    console.warn('[account-email] skipped: BREVO_API_KEY not set in env')
    return { sent: false, skipped: 'missing_BREVO_API_KEY' }
  }

  const copy = buildSetPasswordEmailCopy(toName)

  const htmlContent = emailShell({
    title: copy.subject,
    preheader: 'Set your password and start practising.',
    heading: copy.heading,
    rows: [
      row(
        [paragraph(copy.greeting), ...copy.lines.map(paragraph)].join('\n                '),
        '20px 40px 8px 40px',
      ),
      row(
        `${button(setPasswordUrl, copy.cta)}
                <p style="margin:14px 0 0 0;font-size:13px;line-height:1.5;color:#78716C;">${copy.expiryNote}</p>`,
        '0 40px 36px 40px',
      ),
    ],
    footerHtml: `<p style="margin:0;font-size:13px;color:#78716C;">${BRAND.senderName} · fourteenfisherman.com</p>`,
  })

  try {
    await new BrevoClient({ apiKey: brevoKey }).transactionalEmails.sendTransacEmail({
      sender: { name: BRAND.senderName, email: BRAND.senderEmail },
      // The buyer asked for this link; if something is wrong with it, their
      // reply has to reach a person rather than Brevo's bounce address.
      replyTo: { name: BRAND.senderName, email: BRAND.senderEmail },
      to: [{ email: toEmail, ...(toName ? { name: toName } : {}) }],
      subject: copy.subject,
      htmlContent,
    })
    return { sent: true }
  } catch (error) {
    console.error('[account-email] send failed', { toEmail, error })
    return { sent: false, skipped: 'brevo_error' }
  }
}
