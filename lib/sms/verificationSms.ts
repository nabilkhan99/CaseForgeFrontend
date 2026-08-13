import 'server-only'
import { BrevoClient, BrevoError } from '@getbrevo/brevo'

interface SendVerificationSmsArgs {
  /** E.164 number, e.g. +447123456789 */
  toPhone: string
  code: string
}

interface SendVerificationSmsResult {
  sent: boolean
  skipped?: 'missing_BREVO_API_KEY'
  error?: string
}

/**
 * Text the 6-digit code for the trial gate's phone verification step.
 * Requires SMS credits on the Brevo account — a 402 (no credits) surfaces
 * here as sent:false, and the caller fails open rather than blocking the
 * report. Never throws.
 */
export async function sendVerificationSms({
  toPhone,
  code,
}: SendVerificationSmsArgs): Promise<SendVerificationSmsResult> {
  const brevoKey = process.env.BREVO_API_KEY
  if (!brevoKey) {
    console.warn('[verification-sms] skipped: BREVO_API_KEY not set in env')
    return { sent: false, skipped: 'missing_BREVO_API_KEY' }
  }

  const brevo = new BrevoClient({ apiKey: brevoKey })
  try {
    await brevo.transactionalSms.sendTransacSms({
      // Brevo expects the country-coded number without the leading +.
      recipient: toPhone.replace(/^\+/, ''),
      // 11 chars — the carrier limit for alphanumeric sender IDs, so the
      // full brand name doesn't fit. Keep this stable: a changed sender ID
      // reads as a different sender to anyone with the old thread saved.
      sender: '14Fisherman',
      type: 'transactional',
      content: `${code} is your Fourteen Fisherman verification code. It expires in 10 minutes.`,
      tag: { field: 'trial-phone-verification' },
    })
    return { sent: true }
  } catch (error: unknown) {
    if (error instanceof BrevoError) {
      console.error('[verification-sms] Brevo API error', {
        statusCode: error.statusCode,
        message: error.message,
      })
      return { sent: false, error: `${error.statusCode} ${error.message}` }
    }
    console.error('[verification-sms] Brevo SDK threw', { error })
    return { sent: false, error: error instanceof Error ? error.message : String(error) }
  }
}
