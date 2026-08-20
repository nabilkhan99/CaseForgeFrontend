import { BrevoClient } from '@getbrevo/brevo'

/**
 * "Your account is ready — set your password" email, sent by purchase
 * provisioning (lib/auth/provisioning.ts). Same house chrome as the purchase
 * confirmation; one job, one button.
 */

export interface SetPasswordEmailCopy {
  subject: string
  heading: string
  greeting: string
  lines: string[]
  cta: string
}

export function buildSetPasswordEmailCopy(firstNameRaw?: string | null): SetPasswordEmailCopy {
  const firstName = firstNameRaw?.trim().split(' ')[0] || 'there'
  return {
    subject: 'Your Fourteen Fisherman account is ready',
    heading: 'Your account is ready.',
    greeting: `Hi ${firstName},`,
    lines: [
      'Your Fourteen Fisherman account has been created — set a password and you can start practising.',
      'The button below signs you in securely and asks you to choose your password. If it has expired by the time you click it, the page will send you a fresh link.',
    ],
    cta: 'Set my password',
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
  const paragraph = (text: string) =>
    `<p style="margin:0 0 16px 0;font-size:16px;line-height:1.6;color:#44403C;">${text}</p>`

  const htmlContent = `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width,initial-scale=1">
    <meta name="color-scheme" content="light">
    <meta name="supported-color-schemes" content="light">
    <title>${copy.subject}</title>
  </head>
  <body style="margin:0;padding:0;background-color:#F5F0EB;font-family:-apple-system,BlinkMacSystemFont,'Plus Jakarta Sans','Segoe UI',Roboto,sans-serif;color:#1C1917;-webkit-font-smoothing:antialiased;">
    <div style="display:none;font-size:1px;color:#F5F0EB;line-height:1px;max-height:0px;max-width:0px;opacity:0;overflow:hidden;">Set your password and start practising.</div>
    <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="background-color:#F5F0EB;">
      <tr>
        <td align="center" style="padding:40px 16px;">
          <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="max-width:560px;background-color:#FFFCF8;border-radius:18px;border:1px solid rgba(28,25,23,0.06);box-shadow:0 1px 2px rgba(28,25,23,0.04);">
            <tr>
              <td style="padding:36px 40px 8px 40px;">
                <img src="https://www.fourteenfisherman.com/fourteenfishermann-dark.png" alt="Fourteen Fisherman" width="200" height="30" style="display:block;border:0;outline:none;text-decoration:none;">
              </td>
            </tr>
            <tr>
              <td style="padding:24px 40px 0 40px;">
                <h1 style="margin:0;font-size:30px;line-height:1.15;font-weight:700;letter-spacing:-0.02em;color:#1C1917;">${copy.heading}</h1>
              </td>
            </tr>
            <tr>
              <td style="padding:20px 40px 8px 40px;">
                ${paragraph(copy.greeting)}
                ${copy.lines.map(paragraph).join('\n                ')}
              </td>
            </tr>
            <tr>
              <td style="padding:0 40px 36px 40px;">
                <a href="${setPasswordUrl}" style="display:inline-block;background-color:#B45309;color:#FFFFFF;font-size:16px;font-weight:600;line-height:1;text-decoration:none;padding:16px 28px;border-radius:12px;">${copy.cta}</a>
              </td>
            </tr>
          </table>
          <p style="margin:24px 0 0 0;font-size:13px;color:#78716C;">Fourteen Fisherman · fourteenfisherman.com</p>
        </td>
      </tr>
    </table>
  </body>
</html>`

  try {
    await new BrevoClient({ apiKey: brevoKey }).transactionalEmails.sendTransacEmail({
      sender: { name: 'Fourteen Fisherman', email: 'hello@fourteenfisherman.com' },
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
