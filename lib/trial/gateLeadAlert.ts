import 'server-only'
import type { SupabaseClient } from '@supabase/supabase-js'
import { sendLeadAlertEmail } from '@/lib/email/leadAlertEmail'
import { SCA_TARGETS, TRAINING_STAGES, findOption } from '@/lib/trial/leadFields'

export interface GateLeadForAlert {
  email: string
  first_name: string | null
  phone: string | null
  training_stage: string | null
  sca_sitting: string | null
  sca_sit_date: string | null
  station_id: string | null
}

/**
 * Resolve the human-readable labels for a trial lead and fire the founder
 * alert. Called once per lead, at the end of the gate: after phone
 * verification succeeds, or from the fail-open path when the SMS could not
 * be sent (phoneVerified: false). Best-effort — never throws.
 */
export async function sendGateLeadAlert(
  supabase: SupabaseClient,
  sessionId: string,
  lead: GateLeadForAlert,
  phoneVerified: boolean,
): Promise<void> {
  try {
    let stationTitle: string | null = null
    if (lead.station_id) {
      const { data: station } = await supabase
        .from('stations')
        .select('title')
        .eq('id', lead.station_id)
        .maybeSingle()
      stationTitle = station?.title ?? null
    }

    await sendLeadAlertEmail({
      sessionId,
      email: lead.email,
      firstName: lead.first_name,
      phone: lead.phone,
      phoneVerified,
      trainingStage:
        findOption(TRAINING_STAGES, lead.training_stage)?.label ?? lead.training_stage,
      scaSitting: findOption(SCA_TARGETS, lead.sca_sitting)?.label ?? lead.sca_sit_date,
      stationTitle,
    })
  } catch (error: unknown) {
    console.error('[gate-lead-alert] failed', { sessionId, error })
  }
}
