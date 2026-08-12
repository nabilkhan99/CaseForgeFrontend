import 'server-only'
import { BrevoClient } from '@getbrevo/brevo'

interface PushTrialLeadArgs {
  email: string
  firstName?: string | null
  phone?: string | null
  stationTitle: string | null
  score: string | null
  trainingStage?: string | null
  /**
   * Human label for the SCA sitting the lead named. Still written to the
   * long-standing SCA_SIT_DATE attribute so existing Brevo segments and
   * automations keep working after the questionnaire replaced the old
   * coarse "when are you sitting?" field.
   */
  scaSitDate?: string | null
  aktStatus?: string | null
  aktSitting?: string | null
  scaStatus?: string | null
  scaSitting?: string | null
  gpTrainingStart?: string | null
  notInTrainingRole?: string | null
}

/**
 * Upsert the trial lead as a Brevo contact so the free-station list is ready
 * for a nurture sequence. Best-effort: a Brevo failure must never block the
 * feedback reveal — the lead is already recorded in Supabase.
 */
export async function pushTrialLeadToBrevo({
  email,
  firstName,
  phone,
  stationTitle,
  score,
  trainingStage,
  scaSitDate,
  aktStatus,
  aktSitting,
  scaStatus,
  scaSitting,
  gpTrainingStart,
  notInTrainingRole,
}: PushTrialLeadArgs): Promise<void> {
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
        FIRSTNAME: firstName ?? '',
        // Text attribute, NOT Brevo's built-in SMS attribute — SMS rejects
        // anything that isn't strict international format and the whole
        // contact upsert would fail with it.
        PHONE: phone ?? '',
        TRIAL_STATION: stationTitle ?? '',
        TRIAL_SCORE: score ?? '',
        TRIAL_DATE: new Date().toISOString().slice(0, 10),
        TRAINING_STAGE: trainingStage ?? '',
        SCA_SIT_DATE: scaSitDate ?? '',
        AKT_STATUS: aktStatus ?? '',
        AKT_SITTING: aktSitting ?? '',
        SCA_STATUS: scaStatus ?? '',
        SCA_SITTING: scaSitting ?? '',
        GP_TRAINING_START: gpTrainingStart ?? '',
        NOT_IN_TRAINING_ROLE: notInTrainingRole ?? '',
      },
    })
  } catch (error: unknown) {
    console.error('[trial-lead] Brevo contact upsert failed', { email, error })
  }
}
