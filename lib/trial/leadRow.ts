import { toE164 } from './phone'
import type { PartialAnswers } from './questionnaire'

/**
 * Map validated answers onto `trial_leads` columns, omitting anything not
 * answered yet.
 *
 * Omitting rather than nulling is the point. These arrive one question at a
 * time, so writing `null` for the unanswered ones would erase the answers of
 * the question before — the partial save would destroy the very thing it
 * exists to collect.
 *
 * Verification columns are deliberately absent: `send-code` owns the code, the
 * throttle and `email_verified_at`, and a partial save must never disturb them.
 */
export function leadFieldsFrom(
  answers: PartialAnswers,
  stationId: string | null,
): Record<string, string | null> {
  const fields: Record<string, string | null> = { station_id: stationId }
  const set = (column: string, value: string | undefined) => {
    if (value) fields[column] = value
  }

  set('first_name', answers.firstName)
  // E.164, so the SMS step and a phone call both work straight off the row.
  set('phone', answers.phone ? (toE164(answers.phone) ?? answers.phone) : undefined)
  set('training_stage', answers.trainingStage)
  set('training_start_month', answers.trainingStartMonth)
  set('training_start_year', answers.trainingStartYear)
  set('akt_status', answers.aktStatus)
  set('akt_sitting', answers.aktSitting)
  set('sca_status', answers.scaStatus)
  set('sca_sitting', answers.scaSitting)
  set('not_in_training_role', answers.notInTrainingRole)
  set('expected_start_month', answers.expectedStartMonth)
  set('expected_start_year', answers.expectedStartYear)

  return fields
}
