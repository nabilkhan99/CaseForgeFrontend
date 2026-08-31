import { describe, expect, it } from 'vitest'
import { leadFieldsFrom } from './leadRow'

describe('leadFieldsFrom', () => {
  it('omits unanswered questions rather than nulling them', () => {
    // The whole point: these arrive one at a time, so a null here would wipe
    // the answer given a moment earlier.
    const fields = leadFieldsFrom({ email: 'a@nhs.net', firstName: 'Sana' }, 'station-1')
    expect(fields).toEqual({ station_id: 'station-1', first_name: 'Sana' })
    expect('sca_status' in fields).toBe(false)
    expect('training_stage' in fields).toBe(false)
  })

  it('maps every answer onto its column', () => {
    const fields = leadFieldsFrom(
      {
        email: 'a@nhs.net',
        firstName: 'Sana',
        trainingStage: 'st3',
        trainingStartMonth: 'august',
        trainingStartYear: '2024',
        aktStatus: 'booked_first',
        aktSitting: 'oct_2026',
        scaStatus: 'booked_resit',
        scaSitting: 'nov_2026',
        notInTrainingRole: 'foundation',
        expectedStartMonth: 'august',
        expectedStartYear: '2027',
      },
      null,
    )
    expect(fields).toMatchObject({
      station_id: null,
      first_name: 'Sana',
      training_stage: 'st3',
      training_start_month: 'august',
      training_start_year: '2024',
      akt_status: 'booked_first',
      akt_sitting: 'oct_2026',
      sca_status: 'booked_resit',
      sca_sitting: 'nov_2026',
      not_in_training_role: 'foundation',
      expected_start_month: 'august',
      expected_start_year: '2027',
    })
  })

  it('stores the phone in E.164 so the SMS step can use it as-is', () => {
    const fields = leadFieldsFrom({ email: 'a@nhs.net', phone: '07700900123' }, null)
    expect(fields.phone).toBe('+447700900123')
  })

  it('never writes a verification column — send-code owns those', () => {
    const fields = leadFieldsFrom(
      { email: 'a@nhs.net', firstName: 'Sana', trainingStage: 'st3' },
      'station-1',
    )
    for (const column of Object.keys(fields)) {
      expect(column).not.toMatch(/verif/)
    }
    expect('email' in fields).toBe(false)
  })
})
