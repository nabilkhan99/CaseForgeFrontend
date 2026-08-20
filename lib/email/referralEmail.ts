import { BrevoClient, BrevoError } from '@getbrevo/brevo'

interface SendReferralEmailArgs {
  /** Recipient — the buyer who just became an advocate. */
  toEmail: string
  /** Recipient display name, if known. */
  toName?: string | null
  /** Their personal share link, e.g. https://origin/r/CODE. */
  referralUrl: string
  /** Reward they earn per qualifying referral, in pence. */
  rewardAmount: number
  /**
   * Discount their friend gets at checkout, in pence. Omit (or 0) for a
   * one-sided referral, which drops the "and they get £X off" half of every
   * line rather than rendering "£0 off".
   */
  refereeDiscount?: number
}

interface SendReferralEmailResult {
  sent: boolean
  skipped?: 'missing_BREVO_API_KEY'
  brevoMessageId?: string
  error?: string
}

/**
 * Format pence as a pound string. Whole pounds render bare (10000 -> "£100");
 * anything with pence renders to two decimals (2550 -> "£25.50").
 */
export function formatPounds(pence: number): string {
  return pence % 100 === 0 ? `£${pence / 100}` : `£${(pence / 100).toFixed(2)}`
}

/**
 * Send the "you're now an advocate" email with the buyer's referral link.
 * Mirrors the Brevo pattern used by the waitlist route (same sender, HTML +
 * text, tags). Never throws — failures are logged and returned in the result
 * so the caller (the Stripe webhook) can continue regardless.
 */
export async function sendReferralEmail({
  toEmail,
  toName,
  referralUrl,
  rewardAmount,
  refereeDiscount = 0,
}: SendReferralEmailArgs): Promise<SendReferralEmailResult> {
  const brevoKey = process.env.BREVO_API_KEY
  if (!brevoKey) {
    console.warn('[referral-email] skipped: BREVO_API_KEY not set in env')
    return { sent: false, skipped: 'missing_BREVO_API_KEY' }
  }

  const reward = formatPounds(rewardAmount)
  const firstName = toName?.trim().split(' ')[0] || 'there'

  // Two-sided referrals lead with the friend's side as well as the advocate's:
  // "money for you" is a weaker thing to forward to a mate than "money for both
  // of us". Every string below degrades cleanly to the one-sided wording when no
  // discount is configured.
  const discount = refereeDiscount > 0 ? formatPounds(refereeDiscount) : null
  const subject = discount
    ? `Your referral link — ${reward} for you, ${discount} off for them`
    : `Your referral link — earn ${reward} per mate`
  const preheader = discount
    ? `Share your link — ${reward} for you, ${discount} off for every mate who joins.`
    : `Share your link — earn ${reward} for every mate who joins.`
  const pitch = discount
    ? `when they enrol, you earn up to ${reward} — and they get up to ${discount} off.`
    : `when they enrol, you earn up to ${reward}.`
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
    <div style="display:none;font-size:1px;color:#F5F0EB;line-height:1px;max-height:0px;max-width:0px;opacity:0;overflow:hidden;">${preheader}</div>
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
                <h1 style="margin:0;font-size:30px;line-height:1.15;font-weight:700;letter-spacing:-0.02em;color:#1C1917;">You're in — now earn ${reward}.</h1>
              </td>
            </tr>
            <tr>
              <td style="padding:20px 40px 0 40px;">
                <p style="margin:0 0 18px 0;font-size:16px;line-height:1.6;color:#44403C;">Hi ${firstName},</p>
                <p style="margin:0 0 18px 0;font-size:16px;line-height:1.6;color:#44403C;">Thanks for pre-ordering. Know another GP trainee sweating the SCA? Share your personal link below — ${pitch}</p>
                <p style="margin:0 0 12px 0;font-size:14px;line-height:1.5;color:#78716C;">Your link:</p>
              </td>
            </tr>
            <tr>
              <td style="padding:0 40px 36px 40px;">
                <a href="${referralUrl}" style="display:inline-block;background-color:#B45309;color:#FFFCF8;font-size:14px;font-weight:600;text-decoration:none;padding:12px 22px;border-radius:10px;letter-spacing:-0.005em;mso-padding-alt:0;">
                  ${referralUrl}
                </a>
              </td>
            </tr>
            <tr>
              <td style="padding:0 40px;">
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
                <p style="margin:0;font-size:12px;line-height:1.5;color:#78716C;">Fourteen Fisherman · The gold standard for SCA prep<br><a href="https://www.fourteenfisherman.com" style="color:#78716C;text-decoration:underline;">fourteenfisherman.com</a></p>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`

  const textBody = `Hi ${firstName},

Thanks for pre-ordering. Know another GP trainee sweating the SCA? Share your personal link — ${pitch}

Your link: ${referralUrl}

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
      tags: ['referral-invite'],
    })
    console.log('[referral-email] sent', { email: toEmail, brevoMessageId: result.messageId })
    return { sent: true, brevoMessageId: result.messageId }
  } catch (emailErr) {
    if (emailErr instanceof BrevoError) {
      console.error('[referral-email] Brevo API error', {
        email: toEmail,
        statusCode: emailErr.statusCode,
        message: emailErr.message,
      })
      return { sent: false, error: `${emailErr.statusCode} ${emailErr.message}` }
    }
    console.error('[referral-email] Brevo SDK threw', { email: toEmail, emailErr })
    return { sent: false, error: emailErr instanceof Error ? emailErr.message : String(emailErr) }
  }
}
