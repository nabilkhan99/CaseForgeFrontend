import 'server-only'
import { BrevoClient } from '@getbrevo/brevo'

interface PushPreorderContactArgs {
  email: string
  fullName?: string | null
  planKey: string
  coachingDayLabel?: string | null
  amountPence: number
}

/**
 * Upsert the buyer as a Brevo contact on the pre-order list so launch comms can
 * be segmented by plan and coaching day. Best-effort: a Brevo failure must never
 * fail the Stripe webhook — the purchase is already recorded in Supabase.
 */
export async function pushPreorderContactToBrevo({
  email,
  fullName,
  planKey,
  coachingDayLabel,
  amountPence,
}: PushPreorderContactArgs): Promise<void> {
  const brevoKey = process.env.BREVO_API_KEY
  if (!brevoKey) {
    console.warn('[preorder-contact] Brevo push skipped: BREVO_API_KEY not set')
    return
  }

  const listId = Number(process.env.BREVO_PREORDER_LIST_ID)
  const nameParts = fullName?.trim().split(/\s+/).filter(Boolean) ?? []
  const brevo = new BrevoClient({ apiKey: brevoKey })

  try {
    await brevo.contacts.createContact({
      email,
      updateEnabled: true,
      ...(Number.isFinite(listId) && listId > 0 ? { listIds: [listId] } : {}),
      attributes: {
        FIRSTNAME: nameParts[0] ?? '',
        LASTNAME: nameParts.slice(1).join(' '),
        PLAN: planKey,
        COACHING_DAY: coachingDayLabel ?? '',
        PREORDER_DATE: new Date().toISOString().slice(0, 10),
        AMOUNT_PAID: amountPence / 100,
      },
    })
  } catch (error: unknown) {
    console.error('[preorder-contact] Brevo contact upsert failed', { email, error })
  }
}
