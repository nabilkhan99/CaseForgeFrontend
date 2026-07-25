/**
 * The qualification fields captured with the trial email gate.
 * Shared by the gate form and /api/try/send-code so the allowlists
 * can never drift apart.
 *
 * Option lists use the spec's verbatim wording. The AKT list starts at
 * January 2027 and the SCA list at September 2027, as specified.
 */

export interface LeadFieldOption {
  value: string
  label: string
}

/** Q4 — Where are you currently in relation to GP training? */
export const TRAINING_STAGES: readonly LeadFieldOption[] = [
  { value: 'st1', label: 'ST1' },
  { value: 'st2', label: 'ST2' },
  { value: 'st3', label: 'ST3' },
  { value: 'not_in_training', label: 'Not currently in GP training' },
] as const

/** The three stages that open the AKT/SCA branch. */
export const IN_TRAINING_STAGES = ['st1', 'st2', 'st3'] as const

/** Q6 / Q7 — exam status. The same eight states for both AKT and SCA. */
export const EXAM_STATUSES: readonly LeadFieldOption[] = [
  { value: 'not_started', label: "I haven't started thinking about it yet" },
  { value: 'preparing_first', label: 'Preparing for my first attempt, not booked' },
  { value: 'booked_first', label: 'Booked for my first attempt' },
  { value: 'awaiting_first', label: 'Awaiting my first-attempt result' },
  { value: 'preparing_resit', label: 'Preparing for a resit, not booked' },
  { value: 'booked_resit', label: 'Booked for a resit' },
  { value: 'awaiting_resit', label: 'Awaiting my resit result' },
  { value: 'passed', label: "I've passed it" },
] as const

/** Statuses that ask "when are you aiming to sit/resit?" */
export const AIMING_STATUSES = ['not_started', 'preparing_first', 'preparing_resit'] as const
/** Statuses that ask "which sitting are you booked for?" */
export const BOOKED_STATUSES = ['booked_first', 'booked_resit'] as const

/** AKT sittings offered when the candidate is already booked. */
export const AKT_SITTINGS: readonly LeadFieldOption[] = [
  { value: 'jan_2027', label: 'January 2027' },
  { value: 'apr_2027', label: 'April 2027' },
  { value: 'jul_2027', label: 'July 2027' },
  { value: 'oct_2027', label: 'October 2027' },
  { value: 'jan_2028', label: 'January 2028' },
  { value: 'apr_2028', label: 'April 2028' },
  { value: 'jul_2028', label: 'July 2028' },
  { value: 'oct_2028', label: 'October 2028' },
  { value: 'jan_2029', label: 'January 2029' },
] as const

/** AKT targets — the booked list plus the two open-ended answers. */
export const AKT_TARGETS: readonly LeadFieldOption[] = [
  ...AKT_SITTINGS,
  { value: 'later_2029', label: '2029 or later' },
  { value: 'not_sure', label: "I'm not sure yet" },
] as const

/** SCA sittings offered when the candidate is already booked. */
export const SCA_SITTINGS: readonly LeadFieldOption[] = [
  { value: 'sep_2027', label: 'September 2027' },
  { value: 'nov_2027', label: 'November 2027' },
  { value: 'jan_2028', label: 'January 2028' },
  { value: 'mar_2028', label: 'March 2028' },
  { value: 'may_2028', label: 'May 2028' },
  { value: 'jul_2028', label: 'July 2028' },
  { value: 'sep_2028', label: 'September 2028' },
  { value: 'nov_2028', label: 'November 2028' },
  { value: 'jan_2029', label: 'January 2029' },
  { value: 'mar_2029', label: 'March 2029' },
  { value: 'may_2029', label: 'May 2029' },
  { value: 'jul_2029', label: 'July 2029' },
  { value: 'sep_2029', label: 'September 2029' },
  { value: 'nov_2029', label: 'November 2029' },
] as const

/** SCA targets — the booked list plus the two open-ended answers. */
export const SCA_TARGETS: readonly LeadFieldOption[] = [
  ...SCA_SITTINGS,
  { value: 'later_2029', label: '2029 or later' },
  { value: 'not_sure', label: "I'm not sure yet" },
] as const

/** Q5 (not-in-training branch) — Which best describes you? */
export const NOT_IN_TRAINING_ROLES: readonly LeadFieldOption[] = [
  { value: 'starting_soon', label: 'Starting GP training soon (keen bean)' },
  { value: 'foundation', label: 'Foundation trainee (wildly overprepared)' },
  { value: 'another_specialty', label: 'In another specialty (grass is always greener)' },
  { value: 'qualified_gp', label: 'Qualified GP (just here for bants)' },
  { value: 'other', label: 'Other (the mysterious lurker)' },
] as const

/** Only "starting soon" is asked for an expected start date. */
export const STARTING_SOON = 'starting_soon'

export const MONTHS: readonly LeadFieldOption[] = [
  { value: '01', label: 'January' },
  { value: '02', label: 'February' },
  { value: '03', label: 'March' },
  { value: '04', label: 'April' },
  { value: '05', label: 'May' },
  { value: '06', label: 'June' },
  { value: '07', label: 'July' },
  { value: '08', label: 'August' },
  { value: '09', label: 'September' },
  { value: '10', label: 'October' },
  { value: '11', label: 'November' },
  { value: '12', label: 'December' },
] as const

function years(from: number, to: number): readonly LeadFieldOption[] {
  const out: LeadFieldOption[] = []
  for (let y = from; y <= to; y += 1) out.push({ value: String(y), label: String(y) })
  return out
}

/** Q5 — when GP training started (already under way, so past-leaning). */
export const TRAINING_START_YEARS = years(2018, 2027)
/** Q6 (not-in-training branch) — when they are due to start. */
export const EXPECTED_START_YEARS = years(2026, 2030)

export function findOption(
  options: readonly LeadFieldOption[],
  value: unknown,
): LeadFieldOption | undefined {
  if (typeof value !== 'string') return undefined
  return options.find((option) => option.value === value)
}

/** The follow-up list for an exam status, or null when none is asked. */
export function followUpFor(
  exam: 'akt' | 'sca',
  status: string,
): { kind: 'aiming' | 'booked'; options: readonly LeadFieldOption[] } | null {
  const aiming = (AIMING_STATUSES as readonly string[]).includes(status)
  const booked = (BOOKED_STATUSES as readonly string[]).includes(status)
  if (!aiming && !booked) return null
  if (exam === 'akt') {
    return aiming
      ? { kind: 'aiming', options: AKT_TARGETS }
      : { kind: 'booked', options: AKT_SITTINGS }
  }
  return aiming
    ? { kind: 'aiming', options: SCA_TARGETS }
    : { kind: 'booked', options: SCA_SITTINGS }
}

/** Question wording for each follow-up, per the spec. */
const FOLLOW_UP_LABELS: Record<string, string> = {
  'akt:aiming:first': 'When are you aiming to sit the AKT?',
  'akt:aiming:resit': 'When are you aiming to resit the AKT?',
  'akt:booked:first': 'Which AKT sitting are you booked for?',
  'akt:booked:resit': 'Which AKT resit are you booked for?',
  'sca:aiming:first': 'When are you aiming to sit the SCA?',
  'sca:aiming:resit': 'When are you aiming to resit the SCA?',
  'sca:booked:first': 'Which SCA sitting are you booked for?',
  'sca:booked:resit': 'Which SCA resit are you booked for?',
}

export function followUpLabel(exam: 'akt' | 'sca', status: string): string {
  const follow = followUpFor(exam, status)
  if (!follow) return ''
  const resit = status === 'preparing_resit' || status === 'booked_resit'
  return FOLLOW_UP_LABELS[`${exam}:${follow.kind}:${resit ? 'resit' : 'first'}`] ?? ''
}
