import 'server-only'
import { BrevoClient } from '@getbrevo/brevo'

interface PushTrialLeadArgs {
  email: string
  stationTitle: string | null
  score: string | null
}

/**
 * Upsert the trial lead as a Brevo contact so the free-station list is ready
 * for a nurture sequence. Best-effort: a Brevo failure must never block the
 * feedback reveal — the lead is already recorded in Supabase.
 */
export async function pushTrialLeadToBrevo({ email, stationTitle, score }: PushTrialLeadArgs): Promise<void> {
  const brevoKey = process.env.BREVO_API_KEY
  if (!brevoKey) {
    console.warn('[trial-lead] Brevo push skipped: BREVO_API_KEY not set')
    return
  }

  const listId = Number(process.env.BREVO_TRIAL_LIST_ID)
  const brevo = new BrevoClient({ apiKey: brevoKey })

  try {
    await brevo.contacts.createContact({
      email,
      updateEnabled: true,
      ...(Number.isFinite(listId) && listId > 0 ? { listIds: [listId] } : {}),
      attributes: {
        TRIAL_STATION: stationTitle ?? '',
        TRIAL_SCORE: score ?? '',
        TRIAL_DATE: new Date().toISOString().slice(0, 10),
      },
    })
  } catch (error: unknown) {
    console.error('[trial-lead] Brevo contact upsert failed', { email, error })
  }
}
