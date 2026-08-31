import { BrevoClient, BrevoError } from '@getbrevo/brevo'
import {
  BRAND,
  button,
  divider,
  emailShell,
  fallbackLink,
  paragraph,
  row,
  signoff,
} from './chrome'
import { SET_PASSWORD_EXPIRY_NOTE } from './accountEmail'
import type { ReceiptPlanKey } from '@/lib/receipts/receiptContent'

/**
 * The one email a buyer gets when a payment clears: the receipt PDF attached,
 * and the account setup link as the primary action.
 *
 * It replaces TWO emails that used to go out within seconds of each other — a
 * purchase confirmation and a separate "your account is ready" — which between
 * them managed to bury the only thing the buyer actually had to do. The setup
 * link is now the button, above the fold, in the mail that also proves they
 * paid.
 *
 * Transactional, not marketing: no unsubscribe link and no cross-sell, sent on
 * Brevo's transactional stream so it still reaches someone who unsubscribed
 * from marketing. Somebody who has just been charged £599 is owed their receipt
 * regardless of their mailing preferences.
 *
 * `replyTo` is set. The copy says "just reply to this email" three times, and
 * without it those replies go to Brevo's bounce address and nowhere else.
 */

export interface ReceiptEmailCopyArgs {
  planKey: ReceiptPlanKey
  /** Buyer's name; only the first word is used. Blank falls back to "there". */
  firstName?: string | null
  /** "Saturday 12 September 2026". Complete only. */
  sessionDate?: string | null
  /** "27 September 2026". Monthly only — a consumer-law requirement. */
  nextBillingDate?: string | null
  /**
   * The recurring charge, formatted — "£129.00". Monthly only.
   *
   * Passed in from the actual Stripe amount rather than hardcoded, so the copy
   * cannot drift from what the card was charged if the Price is ever rotated.
   */
  renewalAmount?: string | null
  /**
   * False when the buyer already had an account, so there is no link to set a
   * password with and the mail points them at sign-in instead.
   */
  hasSetupLink: boolean
  /** A monthly renewal rather than a first purchase. */
  isRenewal?: boolean
}

export interface ReceiptEmailCopy {
  subject: string
  preheader: string
  heading: string
  greeting: string
  /** Paragraphs before the button. */
  intro: readonly string[]
  ctaLabel: string
  /** Paragraphs after the button. */
  outro: readonly string[]
}

/** Spec section 6: the subject is per plan, and monthly shares Self-Study's. */
const SUBJECTS: Record<ReceiptPlanKey, string> = {
  complete: 'Your Complete SCA Course receipt',
  self_study: 'Your Self-Study receipt',
  self_study_monthly: 'Your Self-Study receipt',
}

const SETUP_PREHEADER = 'Set up your account and get started.'

/**
 * Build the email copy. Pure — no I/O, no env, no Brevo — so the wording of all
 * three variants, and the two renewal/existing-account cases, is unit-testable
 * without sending anything.
 */
export function buildReceiptEmailCopy({
  planKey,
  firstName,
  sessionDate,
  nextBillingDate,
  hasSetupLink,
  renewalAmount,
  isRenewal = false,
}: ReceiptEmailCopyArgs): ReceiptEmailCopy {
  const first = firstName?.trim().split(' ')[0] || 'there'
  const greeting = `Hi ${first},`

  // The monthly renewal terms. Stated on the first charge AND on every renewal:
  // "you will be charged again, on this date, for this much" is the thing a
  // subscriber is entitled to be told, and it is what stops a chargeback.
  const amount = renewalAmount?.trim() || '£129'
  const renewalTerms = nextBillingDate
    ? `This is a monthly subscription. It renews on ${nextBillingDate} at ${amount}, and again each month until you cancel. You can cancel any time from your account, or by replying to this email, and you'll keep access until the end of the period you've paid for.`
    : `This is a monthly subscription. It renews each month at ${amount} until you cancel. You can cancel any time from your account, or by replying to this email, and you'll keep access until the end of the period you've paid for.`

  if (isRenewal) {
    // A renewal is not a welcome. No setup link — they have had an account for
    // a month — and no "thanks for signing up".
    return {
      subject: SUBJECTS[planKey],
      preheader: 'Your monthly receipt is attached.',
      heading: 'Your receipt.',
      greeting,
      intro: [
        'Your Self-Study subscription renewed today. Your receipt is attached.',
        renewalTerms,
      ],
      ctaLabel: 'Go to your dashboard',
      outro: ['Any questions, just reply to this email.'],
    }
  }

  const thanks =
    planKey === 'complete'
      ? 'Thanks for joining the Complete SCA Course. Your receipt is attached.'
      : 'Thanks for signing up to Self-Study. Your receipt is attached.'

  // The buyer already had an account, so there is no password to set. The
  // receipt still has to reach them; only the action changes.
  const setupIntro = hasSetupLink
    ? [
        thanks,
        'First step is to set up your account. That gives you access to your dashboard, where everything lives.',
      ]
    : [thanks, 'You already have an account with us, so just sign in and everything is there.']

  const outro: string[] = []
  if (planKey === 'complete') {
    outro.push(
      hasSetupLink
        ? "Once you're in, you can start on the practice stations and the lecture series straight away."
        : 'The practice stations and the lecture series are ready for you now.',
    )
    if (sessionDate) {
      outro.push(
        `Your coaching day is ${sessionDate}, 09:00 to 17:00, online. Your joining link will appear on your dashboard under "Coaching day" a few days beforehand.`,
      )
    }
  } else if (planKey === 'self_study') {
    outro.push(
      hasSetupLink
        ? "Once you're in, you have 200 stations and unlimited practice for the next 3 months."
        : 'You have 200 stations and unlimited practice for the next 3 months.',
    )
  } else {
    outro.push(
      hasSetupLink
        ? "Once you're in, you have 200 stations and unlimited practice."
        : 'You have 200 stations and unlimited practice.',
    )
    outro.push(renewalTerms)
  }

  outro.push('Any questions, just reply to this email.')

  return {
    subject: SUBJECTS[planKey],
    preheader: hasSetupLink ? SETUP_PREHEADER : 'Your receipt is attached.',
    heading: 'Your receipt.',
    greeting,
    intro: setupIntro,
    ctaLabel: hasSetupLink ? 'Set up your account' : 'Go to your dashboard',
    outro,
  }
}

export interface SendReceiptEmailArgs extends ReceiptEmailCopyArgs {
  toEmail: string
  toName?: string | null
  /** The set-password link, or null when the buyer already has an account. */
  setupUrl: string | null
  /** The rendered receipt. */
  pdf: Buffer
  /** `Fourteen-Fisherman-receipt-FF-26-4478.pdf` */
  fileName: string
}

export interface SendReceiptEmailResult {
  sent: boolean
  skipped?: 'missing_BREVO_API_KEY'
  brevoMessageId?: string
  error?: string
}

const DASHBOARD_URL = `${BRAND.siteUrl}/dashboard`

export async function sendReceiptEmail(args: SendReceiptEmailArgs): Promise<SendReceiptEmailResult> {
  const brevoKey = process.env.BREVO_API_KEY
  if (!brevoKey) {
    console.warn('[receipt-email] skipped: BREVO_API_KEY not set in env')
    return { sent: false, skipped: 'missing_BREVO_API_KEY' }
  }

  const { toEmail, toName, setupUrl, pdf, fileName } = args
  const copy = buildReceiptEmailCopy({ ...args, firstName: args.firstName ?? toName })
  const ctaHref = setupUrl ?? DASHBOARD_URL

  const htmlContent = emailShell({
    title: copy.subject,
    preheader: copy.preheader,
    heading: copy.heading,
    rows: [
      row(
        [paragraph(copy.greeting), ...copy.intro.map(paragraph)].join('\n                '),
        '20px 40px 8px 40px',
      ),
      // The button sits directly under the intro, above the fold, exactly as
      // the spec asks — not buried below the plan detail.
      row(
        [
          button(ctaHref, copy.ctaLabel),
          // Says what is actually true about the link — 24 hours, not the 7 days
          // the spec hoped for. See SET_PASSWORD_EXPIRY_NOTE for why.
          setupUrl
            ? `<p style="margin:14px 0 0 0;font-size:13px;line-height:1.5;color:#78716C;">${SET_PASSWORD_EXPIRY_NOTE}</p>`
            : '',
          `<div style="height:14px;line-height:14px;font-size:1px;">&nbsp;</div>`,
          fallbackLink(ctaHref),
        ]
          .filter(Boolean)
          .join('\n                '),
        '8px 40px 24px 40px',
      ),
      row(copy.outro.map(paragraph).join('\n                '), '0 40px 8px 40px'),
      row(divider(), '0 40px'),
      row(signoff('Best wishes,'), '24px 40px 36px 40px'),
    ],
  })

  const textContent = [
    copy.greeting,
    ...copy.intro,
    `${copy.ctaLabel}: ${ctaHref}`,
    ...(setupUrl ? [SET_PASSWORD_EXPIRY_NOTE] : []),
    ...copy.outro,
    'Best wishes,',
    'The Fourteen Fisherman Team',
    '',
    '—',
    `${BRAND.senderName} · ${BRAND.siteUrl}`,
  ].join('\n\n')

  try {
    const result = await new BrevoClient({ apiKey: brevoKey }).transactionalEmails.sendTransacEmail({
      sender: { name: BRAND.senderName, email: BRAND.senderEmail },
      // Replies reach a human. The copy invites them; without this they don't.
      replyTo: { name: BRAND.senderName, email: BRAND.senderEmail },
      to: [{ email: toEmail, ...(toName?.trim() ? { name: toName.trim() } : {}) }],
      subject: copy.subject,
      htmlContent,
      textContent,
      // A real attachment, not a link to a hosted page. These receipts get
      // forwarded to deanery finance teams, and a login-gated or expiring link
      // is the most common reason a study-budget claim stalls.
      attachment: [{ content: pdf.toString('base64'), name: fileName }],
      tags: ['receipt', args.isRenewal ? 'renewal' : 'purchase'],
    })
    console.log('[receipt-email] sent', {
      email: toEmail,
      fileName,
      brevoMessageId: result.messageId,
    })
    return { sent: true, brevoMessageId: result.messageId }
  } catch (emailErr) {
    if (emailErr instanceof BrevoError) {
      console.error('[receipt-email] Brevo API error', {
        email: toEmail,
        statusCode: emailErr.statusCode,
        message: emailErr.message,
      })
      return { sent: false, error: `${emailErr.statusCode} ${emailErr.message}` }
    }
    console.error('[receipt-email] Brevo SDK threw', { email: toEmail, emailErr })
    return { sent: false, error: emailErr instanceof Error ? emailErr.message : String(emailErr) }
  }
}
