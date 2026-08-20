import { BrevoClient, BrevoError } from '@getbrevo/brevo'
import { formatPounds } from './referralEmail'

interface SendPayoutReadyEmailArgs {
  /** Recipient — whoever is owed money. */
  toEmail: string
  /** Recipient display name, if known. */
  toName?: string | null
  /** Amount owed, in pence. */
  amount: number
  /**
   * Which side of the referral this is. The referrer earned it by sharing; the
   * buyer earned it by joining through someone's link — and "you've earned £100"
   * with no explanation would read as a scam to the buyer, who never set out to
   * earn anything.
   */
  side: 'referrer' | 'referee'
}

interface SendPayoutReadyEmailResult {
  sent: boolean
  skipped?: 'missing_BREVO_API_KEY'
  brevoMessageId?: string
  error?: string
}

/** The one-line explanation of why this person is owed money. */
export function payoutReason(side: 'referrer' | 'referee'): string {
  return side === 'referrer'
    ? 'Someone joined Fourteen Fisherman through your referral link — thank you.'
    : "You joined Fourteen Fisherman through a friend's referral link, which earns you a cash reward as well as them."
}

/**
 * Tell someone their referral payout is ready and ask how to send it.
 *
 * Deliberately does NOT ask for a sort code and account number in a reply: bank
 * details sitting in an inbox are the worst version of this. It asks for a
 * PayPal address (safe to email) or offers to arrange a transfer, keeping the
 * sensitive path human until there's a proper form.
 *
 * Never throws — failures are logged and returned so the caller can leave
 * notified_at NULL and retry on the next pass.
 */
export async function sendPayoutReadyEmail({
  toEmail,
  toName,
  amount,
  side,
}: SendPayoutReadyEmailArgs): Promise<SendPayoutReadyEmailResult> {
  const brevoKey = process.env.BREVO_API_KEY
  if (!brevoKey) {
    console.warn('[payout-ready-email] skipped: BREVO_API_KEY not set in env')
    return { sent: false, skipped: 'missing_BREVO_API_KEY' }
  }

  const sum = formatPounds(amount)
  const firstName = toName?.trim().split(' ')[0] || 'there'
  const reason = payoutReason(side)
  const subject = `Your ${sum} is ready`
  const brevo = new BrevoClient({ apiKey: brevoKey })

  const htmlBody = `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width,initial-scale=1">
    <meta name="color-scheme" content="light">
    <meta name="supported-color-schemes" content="light">
    <title>${subject}</title>
  </head>
  <body style="margin:0;padding:0;background-color:#F5F0EB;font-family:-apple-system,BlinkMacSystemFont,'Plus Jakarta Sans','Segoe UI',Roboto,sans-serif;color:#1C1917;-webkit-font-smoothing:antialiased;">
    <div style="display:none;font-size:1px;color:#F5F0EB;line-height:1px;max-height:0px;max-width:0px;opacity:0;overflow:hidden;">Reply and tell us where to send it.</div>
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
                <h1 style="margin:0;font-size:30px;line-height:1.15;font-weight:700;letter-spacing:-0.02em;color:#1C1917;">Your ${sum} is ready.</h1>
              </td>
            </tr>
            <tr>
              <td style="padding:20px 40px 0 40px;">
                <p style="margin:0 0 18px 0;font-size:16px;line-height:1.6;color:#44403C;">Hi ${firstName},</p>
                <p style="margin:0 0 18px 0;font-size:16px;line-height:1.6;color:#44403C;">${reason} Your <strong style="color:#1C1917;">${sum}</strong> is confirmed and ready to send.</p>
                <p style="margin:0 0 18px 0;font-size:16px;line-height:1.6;color:#44403C;">Just reply to this email with your PayPal address, or say you&rsquo;d rather have a bank transfer and we&rsquo;ll arrange it from there. Please don&rsquo;t send account numbers by email &mdash; we&rsquo;ll sort that out securely.</p>
              </td>
            </tr>
            <tr>
              <td style="padding:8px 40px 0 40px;">
                <div style="height:1px;line-height:1px;font-size:1px;background-color:rgba(28,25,23,0.08);">&nbsp;</div>
              </td>
            </tr>
            <tr>
              <td style="padding:24px 40px 36px 40px;">
                <p style="margin:0 0 4px 0;font-size:15px;line-height:1.5;color:#44403C;">Speak soon,</p>
                <p style="margin:0;font-size:15px;line-height:1.5;font-weight:600;color:#1C1917;">The Fourteen Fisherman Team</p>
              </td>
            </tr>
          </table>
          <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="max-width:560px;">
            <tr>
              <td style="padding:20px 8px 0 8px;text-align:center;">
                <p style="margin:0;font-size:12px;line-height:1.5;color:#78716C;">Fourteen Fisherman &middot; The gold standard for SCA prep<br><a href="https://www.fourteenfisherman.com" style="color:#78716C;text-decoration:underline;">fourteenfisherman.com</a></p>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`

  const textBody = `Hi ${firstName},

${reason} Your ${sum} is confirmed and ready to send.

Just reply to this email with your PayPal address, or say you'd rather have a bank transfer and we'll arrange it from there. Please don't send account numbers by email — we'll sort that out securely.

Speak soon,
The Fourteen Fisherman Team

—
Fourteen Fisherman · The gold standard for SCA prep
https://www.fourteenfisherman.com`

  try {
    const result = await brevo.transactionalEmails.sendTransacEmail({
      sender: { name: 'Fourteen Fisherman', email: 'hello@fourteenfisherman.com' },
      to: [{ email: toEmail, name: toName?.trim() || undefined }],
      subject,
      htmlContent: htmlBody,
      textContent: textBody,
      tags: ['referral-payout-ready'],
    })
    console.log('[payout-ready-email] sent', { email: toEmail, side, brevoMessageId: result.messageId })
    return { sent: true, brevoMessageId: result.messageId }
  } catch (emailErr: unknown) {
    if (emailErr instanceof BrevoError) {
      console.error('[payout-ready-email] Brevo API error', { email: toEmail, status: emailErr.statusCode })
      return { sent: false, error: `brevo_${emailErr.statusCode}` }
    }
    console.error('[payout-ready-email] Brevo SDK threw', { email: toEmail, emailErr })
    return { sent: false, error: 'brevo_threw' }
  }
}
