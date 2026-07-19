/**
 * The extra qualification fields captured with the trial email gate.
 * Shared by the gate form and /api/try/send-code so the allowlists
 * can never drift apart.
 */

export interface LeadFieldOption {
  value: string
  label: string
}

export const TRAINING_STAGES: readonly LeadFieldOption[] = [
  { value: 'gpst1', label: 'GPST1' },
  { value: 'gpst2', label: 'GPST2' },
  { value: 'gpst3', label: 'GPST3' },
  { value: 'other', label: 'Other / not in GP training' },
] as const

export const SCA_SIT_DATES: readonly LeadFieldOption[] = [
  { value: 'sep_oct_2026', label: 'September – October 2026' },
  { value: 'nov_dec_2026', label: 'November – December 2026' },
  { value: 'early_2027', label: 'Early 2027' },
  { value: 'later_2027', label: 'Later than that' },
  { value: 'not_sure', label: 'Not sure yet' },
] as const

export function findOption(
  options: readonly LeadFieldOption[],
  value: unknown,
): LeadFieldOption | undefined {
  if (typeof value !== 'string') return undefined
  return options.find((option) => option.value === value)
}
