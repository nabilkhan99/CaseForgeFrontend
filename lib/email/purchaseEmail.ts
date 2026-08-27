import { BrevoClient, BrevoError } from '@getbrevo/brevo'
import { ACCESS_OPENS_LABEL, getPlan } from '@/lib/commerce/plans'

interface BuildPurchaseEmailCopyArgs {
  /** Plan key from the Stripe session metadata, e.g. 'complete'. */
  planKey: string
  /** Buyer's name — only the first word is used; falsy/blank falls back to 'there'. */
  firstName?: string | null
  /** Human coaching-day label, e.g. "Saturday 12 September 2026". Null for self-study. */
  coachingDayLabel?: string | null
}

export interface PurchaseEmailCopy {
  subject: string
  heading: string
  greeting: string
  lines: string[]
  coachingLine: string | null
}

interface SendPurchaseEmailArgs {
  /** Recipient — the buyer who just completed checkout. */
  toEmail: string
  /** Recipient display name, if known. */
  toName?: string | null
  /** Plan key from the Stripe session metadata. */
  planKey: string
  /** Human coaching-day label, when the plan includes one. */
  coachingDayLabel?: string | null
}

interface SendPurchaseEmailResult {
  sent: boolean
  skipped?: 'missing_BREVO_API_KEY'
  brevoMessageId?: string
  error?: string
}

/**
 * Build the purchase-confirmation copy. Pure — no I/O, no env, no Brevo — so the
 * wording is unit-testable on its own and the sender below stays a thin shell.
 */
export function buildPurchaseEmailCopy({
  planKey,
  firstName,
  coachingDayLabel,
}: BuildPurchaseEmailCopyArgs): PurchaseEmailCopy {
  const planName = getPlan(planKey)?.name ?? 'your pre-order'
  const first = firstName?.trim().split(' ')[0] || 'there'
  const coachingDay = coachingDayLabel?.trim() || null

  return {
    subject: `You're in — ${planName} confirmed`,
    heading: `You're in.`,
    greeting: `Hi ${first},`,
    lines: [
      `Thanks for pre-ordering ${planName}. Your place is confirmed.`,
      `This is a pre-order: your AI consultation practice and the on-demand lectures start on ${ACCESS_OPENS_LABEL}, and your 3 months' access runs from that date.`,
      // The one question this email did not answer, and the reason a buyer
      // goes looking for a way in before there is one: how they actually get
      // their account. Until launch this is the ONLY email a pre-order buyer
      // receives, so the answer has to live in it.
      `You don't need to do anything yet — we'll email your login details on ${ACCESS_OPENS_LABEL} so you can set a password and go straight in.`,
      `Between now and launch we'll email you everything you need — what to expect, how to get set up, and how to get the most out of the first fortnight.`,
      `Your card receipt comes separately from Stripe. If anything looks wrong, or you just want to ask something, reply to this email and a human will answer.`,
    ],
    coachingLine: coachingDay
      ? `Your coaching day: ${coachingDay} — 9am to 5pm, maximum class of 6. We'll confirm the location and joining details nearer the time.`
      : null,
  }
}

/** One body paragraph, matching the referral email's body styling. */
function paragraph(text: string): string {
  return `<p style="margin:0 0 18px 0;font-size:16px;line-height:1.6;color:#44403C;">${text}</p>`
}

/** The coaching-day callout — an amber-tinted panel so it reads as the standout detail. */
function coachingPanel(text: string): string {
  return `<div style="margin:8px 0 24px 0;padding:16px 18px;background-color:#FDF6EF;border:1px solid rgba(180,83,9,0.18);border-radius:10px;">
                  <p style="margin:0;font-size:15px;line-height:1.6;color:#1C1917;">${text}</p>
                </div>`
}

/**
 * Send the purchase-confirmation email for a completed pre-order. Mirrors the
 * referral email's Brevo pattern (same sender, HTML shell, text alternative,
 * tags). Never throws — failures are logged and returned in the result so the
 * caller (the Stripe webhook) can continue regardless.
 */
export async function sendPurchaseEmail({
  toEmail,
  toName,
  planKey,
  coachingDayLabel,
}: SendPurchaseEmailArgs): Promise<SendPurchaseEmailResult> {
  const brevoKey = process.env.BREVO_API_KEY
  if (!brevoKey) {
    console.warn('[purchase-email] skipped: BREVO_API_KEY not set in env')
    return { sent: false, skipped: 'missing_BREVO_API_KEY' }
  }

  const firstName = toName?.trim().split(' ')[0] || 'there'
  const copy = buildPurchaseEmailCopy({ planKey, firstName, coachingDayLabel })
  const brevo = new BrevoClient({ apiKey: brevoKey })

  // The coaching-day panel sits after the second paragraph: confirmation, then
  // when it all starts, then the buyer's specific day.
  const bodyBlocks = [
    paragraph(copy.greeting),
    paragraph(copy.lines[0]),
    paragraph(copy.lines[1]),
    ...(copy.coachingLine ? [coachingPanel(copy.coachingLine)] : []),
    ...copy.lines.slice(2).map(paragraph),
  ].join('\n                ')

  const htmlBody = `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width,initial-scale=1">
    <meta name="color-scheme" content="light">
    <meta name="supported-color-schemes" content="light">
    <title>${copy.subject}</title>
  </head>
  <body style="margin:0;padding:0;background-color:#F5F0EB;font-family:-apple-system,BlinkMacSystemFont,'Plus Jakarta Sans','Segoe UI',Roboto,sans-serif;color:#1C1917;-webkit-font-smoothing:antialiased;">
    <div style="display:none;font-size:1px;color:#F5F0EB;line-height:1px;max-height:0px;max-width:0px;opacity:0;overflow:hidden;">Your place is confirmed — AI practice and lectures start on ${ACCESS_OPENS_LABEL}.</div>
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
              <td style="padding:20px 40px 18px 40px;">
                ${bodyBlocks}
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

  const textParts = [
    copy.greeting,
    copy.lines[0],
    copy.lines[1],
    ...(copy.coachingLine ? [copy.coachingLine] : []),
    ...copy.lines.slice(2),
  ]

  const textBody = `${textParts.join('\n\n')}

Speak soon,
The Fourteen Fisherman Team

—
Fourteen Fisherman · The gold standard for SCA prep
https://www.fourteenfisherman.com`

  try {
    const result = await brevo.transactionalEmails.sendTransacEmail({
      sender: { name: 'Fourteen Fisherman', email: 'hello@fourteenfisherman.com' },
      to: [{ email: toEmail, name: toName?.trim() || undefined }],
      subject: copy.subject,
      htmlContent: htmlBody,
      textContent: textBody,
      tags: ['purchase-confirmation'],
    })
    console.log('[purchase-email] sent', { email: toEmail, brevoMessageId: result.messageId })
    return { sent: true, brevoMessageId: result.messageId }
  } catch (emailErr) {
    if (emailErr instanceof BrevoError) {
      console.error('[purchase-email] Brevo API error', {
        email: toEmail,
        statusCode: emailErr.statusCode,
        message: emailErr.message,
      })
      return { sent: false, error: `${emailErr.statusCode} ${emailErr.message}` }
    }
    console.error('[purchase-email] Brevo SDK threw', { email: toEmail, emailErr })
    return { sent: false, error: emailErr instanceof Error ? emailErr.message : String(emailErr) }
  }
}
