import {
  EXPECTED_START_YEARS,
  IN_TRAINING_STAGES,
  MONTHS,
  NOT_IN_TRAINING_ROLES,
  STARTING_SOON,
  TRAINING_START_YEARS,
  findOption,
  followUpFor,
  EXAM_STATUSES,
  TRAINING_STAGES,
} from './leadFields'

/** Every answer the gate collects. All optional — branches leave gaps. */
export interface QuestionnaireAnswers {
  email: string
  firstName: string
  trainingStage: string
  trainingStartMonth: string
  trainingStartYear: string
  aktStatus: string
  aktSitting: string
  scaStatus: string
  scaSitting: string
  notInTrainingRole: string
  expectedStartMonth: string
  expectedStartYear: string
}

export const EMPTY_ANSWERS: QuestionnaireAnswers = {
  email: '',
  firstName: '',
  trainingStage: '',
  trainingStartMonth: '',
  trainingStartYear: '',
  aktStatus: '',
  aktSitting: '',
  scaStatus: '',
  scaSitting: '',
  notInTrainingRole: '',
  expectedStartMonth: '',
  expectedStartYear: '',
}

export type StepId =
  | 'identity'
  | 'stage'
  | 'trainingStart'
  | 'aktStatus'
  | 'aktSitting'
  | 'scaStatus'
  | 'scaSitting'
  | 'role'
  | 'expectedStart'

export function isInTraining(stage: string): boolean {
  return (IN_TRAINING_STAGES as readonly string[]).includes(stage)
}

/**
 * The ordered steps for the answers so far.
 *
 * Derived rather than hardcoded so the branching in the spec falls out on its
 * own: statuses with no follow-up simply never add their sitting step, and
 * "Not currently in GP training" swaps the exam questions for the role branch.
 */
export function buildSteps(answers: QuestionnaireAnswers): StepId[] {
  const steps: StepId[] = ['identity', 'stage']
  if (!answers.trainingStage) return steps

  if (isInTraining(answers.trainingStage)) {
    steps.push('trainingStart', 'aktStatus')
    if (answers.aktStatus) {
      if (followUpFor('akt', answers.aktStatus)) steps.push('aktSitting')
      steps.push('scaStatus')
      if (answers.scaStatus && followUpFor('sca', answers.scaStatus)) steps.push('scaSitting')
    }
    return steps
  }

  steps.push('role')
  if (answers.notInTrainingRole === STARTING_SOON) steps.push('expectedStart')
  return steps
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

/** Whether the current step has everything it needs to advance. */
export function isStepComplete(step: StepId, a: QuestionnaireAnswers): boolean {
  switch (step) {
    case 'identity':
      return EMAIL_RE.test(a.email.trim()) && a.firstName.trim().length > 0
    case 'stage':
      return !!a.trainingStage
    case 'trainingStart':
      return !!a.trainingStartMonth && !!a.trainingStartYear
    case 'aktStatus':
      return !!a.aktStatus
    case 'aktSitting':
      return !!a.aktSitting
    case 'scaStatus':
      return !!a.scaStatus
    case 'scaSitting':
      return !!a.scaSitting
    case 'role':
      return !!a.notInTrainingRole
    case 'expectedStart':
      return !!a.expectedStartMonth && !!a.expectedStartYear
    default:
      return false
  }
}

/**
 * Server-side validation mirror. Returns the payload to persist, or an error
 * string. Every option is checked against its allowlist so a hand-rolled POST
 * cannot write arbitrary values.
 */
export function validateAnswers(
  input: Record<string, unknown>,
): { ok: true; value: QuestionnaireAnswers } | { ok: false; error: string } {
  const str = (v: unknown) => (typeof v === 'string' ? v.trim() : '')

  const email = str(input.email).toLowerCase()
  if (!EMAIL_RE.test(email)) return { ok: false, error: 'A valid email is required' }

  const firstName = str(input.firstName).slice(0, 60)
  if (!firstName) return { ok: false, error: 'First name is required' }

  const stage = findOption(TRAINING_STAGES, str(input.trainingStage))
  if (!stage) return { ok: false, error: 'Training stage is required' }

  const out: QuestionnaireAnswers = {
    ...EMPTY_ANSWERS,
    email,
    firstName,
    trainingStage: stage.value,
  }

  if (isInTraining(stage.value)) {
    const month = findOption(MONTHS, str(input.trainingStartMonth))
    const year = findOption(TRAINING_START_YEARS, str(input.trainingStartYear))
    if (!month || !year) return { ok: false, error: 'GP training start date is required' }
    out.trainingStartMonth = month.value
    out.trainingStartYear = year.value

    const akt = findOption(EXAM_STATUSES, str(input.aktStatus))
    if (!akt) return { ok: false, error: 'AKT status is required' }
    out.aktStatus = akt.value
    const aktFollow = followUpFor('akt', akt.value)
    if (aktFollow) {
      const sitting = findOption(aktFollow.options, str(input.aktSitting))
      if (!sitting) return { ok: false, error: 'AKT sitting is required' }
      out.aktSitting = sitting.value
    }

    const sca = findOption(EXAM_STATUSES, str(input.scaStatus))
    if (!sca) return { ok: false, error: 'SCA status is required' }
    out.scaStatus = sca.value
    const scaFollow = followUpFor('sca', sca.value)
    if (scaFollow) {
      const sitting = findOption(scaFollow.options, str(input.scaSitting))
      if (!sitting) return { ok: false, error: 'SCA sitting is required' }
      out.scaSitting = sitting.value
    }

    return { ok: true, value: out }
  }

  const role = findOption(NOT_IN_TRAINING_ROLES, str(input.notInTrainingRole))
  if (!role) return { ok: false, error: 'Please tell us which best describes you' }
  out.notInTrainingRole = role.value

  if (role.value === STARTING_SOON) {
    const month = findOption(MONTHS, str(input.expectedStartMonth))
    const year = findOption(EXPECTED_START_YEARS, str(input.expectedStartYear))
    if (!month || !year) return { ok: false, error: 'Expected start date is required' }
    out.expectedStartMonth = month.value
    out.expectedStartYear = year.value
  }

  return { ok: true, value: out }
}
