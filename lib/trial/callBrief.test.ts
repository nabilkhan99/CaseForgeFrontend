import { describe, expect, it } from 'vitest'
import { buildCallBrief, patientInitials } from './callBrief'

/** The block form is what 169 of the 200 briefs actually look like. */
const BRIEF = [
  '**Patient Name:** Marcus Webb',
  '**Age:** 34',
  '**Reason for Encounter:**',
  '\\"Chest still tight, the inhaler isn\'t working.\\"',
  '**Medical Records:**',
  '- **PMH:** Asthma.',
].join('\n')

describe('buildCallBrief', () => {
  it('is two lines: who, and why they came', () => {
    expect(
      buildCallBrief({
        title: 'Poorly controlled asthma',
        patient_name: 'Marcus Webb',
        patient_age: 34,
        candidate_instructions: BRIEF,
      }),
    ).toEqual({ who: 'Marcus Webb, 34', complaint: "Chest still tight, the inhaler isn't working." })
  })

  it('falls back to the curated title when the brief carries no reason line', () => {
    const brief = buildCallBrief({
      title: 'Telephone triage: acute headache',
      patient_name: 'Simon Fletcher',
      patient_age: 45,
      candidate_instructions: 'Personal details: Patient name: Simon Fletcher',
    })
    expect(brief.complaint).toBe('Telephone triage: acute headache')
  })

  it('keeps the second line to one line, cut on a word', () => {
    const long = `**Reason for Encounter:** ${'symptom '.repeat(40)}end`
    const { complaint } = buildCallBrief({ title: 'x', candidate_instructions: long })
    expect(complaint.length).toBeLessThanOrEqual(111)
    expect(complaint.endsWith('…')).toBe(true)
    expect(complaint).not.toMatch(/sym…$/)
  })

  it('drops the age rather than printing a nonsense one', () => {
    expect(buildCallBrief({ patient_name: 'Marcus Webb', patient_age: null }).who).toBe('Marcus Webb')
    expect(buildCallBrief({ patient_name: 'Marcus Webb', patient_age: 0 }).who).toBe('Marcus Webb')
  })

  it('never leaves the line blank', () => {
    expect(buildCallBrief(null)).toEqual({ who: 'Your patient', complaint: '' })
  })
})

describe('patientInitials', () => {
  it('takes the first two', () => {
    expect(patientInitials('Marcus Webb')).toBe('MW')
    expect(patientInitials('anna maria de souza')).toBe('AM')
    expect(patientInitials('Prince')).toBe('P')
    expect(patientInitials(null)).toBe('??')
  })
})
