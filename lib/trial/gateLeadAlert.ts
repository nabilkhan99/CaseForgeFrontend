import 'server-only'
import { after } from 'next/server'
import type { SupabaseClient } from '@supabase/supabase-js'
import { sendLeadAlertEmail, type LeadAlertDoor } from '@/lib/email/leadAlertEmail'
import { SCA_TARGETS, TRAINING_STAGES, findOption } from '@/lib/trial/leadFields'

/**
 * The founders' lead alert, restored.
 *
 * On main it fired once per lead at the end of the report gate, when the phone
 * step settled. That step is gone, so it fires at the two moments that replaced
 * it, both inside /api/try/verify-code:
 *
 *  - `guest_signup`: the browser that ran a consultation verifies its code and
 *    the account is made (the sign-up while marking page);
 *  - `report_link`: somebody verifies through main's gate on an old report link.
 *
 * ## Never twice for the same lead
 *
 * The caller only schedules it when its own UPDATE is the one that moved the
 * lead's `email_verified_at` from null to set (a conditional update on an
 * existing column, arbitrated by Postgres). A reload, a second tab, a double
 * submit or a returning trainee whose lead was verified long ago all find the
 * column already set, change no row, and send nothing. No new stamp column is
 * needed, and none was added.
 *
 * ## Never in the user's way
 *
 * Scheduled with Next's `after()`, so the response goes back first and the
 * Brevo call runs once it has. Nothing here throws.
 */

export interface GateLeadForAlert {
  email: string
  first_name: string | null
  phone: string | null
  training_stage: string | null
  sca_sitting: string | null
  sca_sit_date: string | null
  station_id: string | null
}

type AlertClient = Pick<SupabaseClient, 'from'>

/** Resolve the labels and send. Best-effort: never throws. */
export async function sendGateLeadAlert(
  supabase: AlertClient,
  sessionId: string,
  lead: GateLeadForAlert,
  door: LeadAlertDoor,
): Promise<void> {
  try {
    let stationTitle: string | null = null
    if (lead.station_id) {
      const { data: station } = await supabase
        .from('stations')
        .select('title')
        .eq('id', lead.station_id)
        .maybeSingle()
      stationTitle = (station as { title?: string | null } | null)?.title ?? null
    }

    await sendLeadAlertEmail({
      sessionId,
      email: lead.email,
      firstName: lead.first_name,
      phone: lead.phone,
      trainingStage:
        findOption(TRAINING_STAGES, lead.training_stage)?.label ?? lead.training_stage,
      scaSitting: findOption(SCA_TARGETS, lead.sca_sitting)?.label ?? lead.sca_sit_date,
      stationTitle,
      door,
    })
  } catch (error: unknown) {
    console.error('[gate-lead-alert] failed', { sessionId, error })
  }
}

/** How a task is run after the response. Injected in tests. */
export type Schedule = (task: () => Promise<void>) => void

/**
 * `after()` keeps the function alive past the response on Vercel. Outside a
 * request scope (a script, a test calling the handler directly) it throws, and
 * the task simply runs now instead.
 */
const afterResponse: Schedule = (task) => {
  try {
    after(task)
  } catch {
    void task()
  }
}

export function scheduleGateLeadAlert(
  supabase: AlertClient,
  sessionId: string,
  lead: GateLeadForAlert,
  door: LeadAlertDoor,
  schedule: Schedule = afterResponse,
): void {
  schedule(() => sendGateLeadAlert(supabase, sessionId, lead, door))
}
