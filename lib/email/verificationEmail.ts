import 'server-only'
import { BrevoClient, BrevoError } from '@getbrevo/brevo'

interface SendVerificationEmailArgs {
  toEmail: string
  firstName?: string | null
  code: string
}

interface SendVerificationEmailResult {
  sent: boolean
  skipped?: 'missing_BREVO_API_KEY'
  error?: string
}

/**
 * Send the 6-digit verification code for the trial feedback gate.
 * Mirrors the Brevo transactional pattern used by the referral email. Never
 * throws — the send-code route decides how to surface a failure.
 */
export async function sendVerificationEmail({
  toEmail,
  firstName,
  code,
}: SendVerificationEmailArgs): Promise<SendVerificationEmailResult> {
  const brevoKey = process.env.BREVO_API_KEY
  if (!brevoKey) {
    console.warn('[verification-email] skipped: BREVO_API_KEY not set in env')
    return { sent: false, skipped: 'missing_BREVO_API_KEY' }
  }

  const name = firstName?.trim() || 'there'
  const brevo = new BrevoClient({ apiKey: brevoKey })

  const htmlBody = `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width,initial-scale=1">
    <meta name="color-scheme" content="light">
    <meta name="supported-color-schemes" content="light">
    <title>Your verification code</title>
  </head>
  <body style="margin:0;padding:0;background-color:#F5F0EB;font-family:-apple-system,BlinkMacSystemFont,'Plus Jakarta Sans','Segoe UI',Roboto,sans-serif;color:#1C1917;-webkit-font-smoothing:antialiased;">
    <div style="display:none;font-size:1px;color:#F5F0EB;line-height:1px;max-height:0px;max-width:0px;opacity:0;overflow:hidden;">${code} is your Fourteen Fisherman verification code.</div>
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
                <h1 style="margin:0;font-size:26px;line-height:1.2;font-weight:700;letter-spacing:-0.02em;color:#1C1917;">Your verification code</h1>
              </td>
            </tr>
            <tr>
              <td style="padding:16px 40px 0 40px;">
                <p style="margin:0 0 18px 0;font-size:16px;line-height:1.6;color:#44403C;">Hi ${name}, enter this code to unlock your feedback report:</p>
              </td>
            </tr>
            <tr>
              <td style="padding:0 40px 8px 40px;">
                <p style="margin:0;display:inline-block;background-color:#F5F0EB;border:1px solid rgba(28,25,23,0.08);border-radius:12px;padding:14px 26px;font-size:32px;font-weight:700;letter-spacing:0.35em;color:#1C1917;font-family:'SF Mono',SFMono-Regular,Menlo,Consolas,monospace;">${code}</p>
              </td>
            </tr>
            <tr>
              <td style="padding:16px 40px 36px 40px;">
                <p style="margin:0;font-size:13px;line-height:1.6;color:#78716C;">The code expires in 10 minutes. If you didn't request it, you can ignore this email.</p>
              </td>
            </tr>
          </table>
          <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="max-width:560px;">
            <tr>
              <td style="padding:20px 8px 0 8px;text-align:center;">
                <p style="margin:0;font-size:12px;line-height:1.5;color:#78716C;">Fourteen Fisherman · The gold standard for SCA prep<br><a href="https://www.fourteenfisherman.com" style="color:#78716C;text-decoration:underline;">fourteenfisherman.com</a></p>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`

  const textBody = `Hi ${name},

Your Fourteen Fisherman verification code is: ${code}

Enter it to unlock your feedback report. The code expires in 10 minutes. If you didn't request it, you can ignore this email.

—
Fourteen Fisherman · The gold standard for SCA prep
https://www.fourteenfisherman.com`

  try {
    await brevo.transactionalEmails.sendTransacEmail({
      sender: { name: 'Fourteen Fisherman', email: 'hello@fourteenfisherman.com' },
      to: [{ email: toEmail }],
      subject: `${code} is your verification code`,
      htmlContent: htmlBody,
      textContent: textBody,
      tags: ['trial-verification'],
    })
    return { sent: true }
  } catch (emailErr) {
    if (emailErr instanceof BrevoError) {
      console.error('[verification-email] Brevo API error', {
        email: toEmail,
        statusCode: emailErr.statusCode,
        message: emailErr.message,
      })
      return { sent: false, error: `${emailErr.statusCode} ${emailErr.message}` }
    }
    console.error('[verification-email] Brevo SDK threw', { email: toEmail, emailErr })
    return { sent: false, error: emailErr instanceof Error ? emailErr.message : String(emailErr) }
  }
}
