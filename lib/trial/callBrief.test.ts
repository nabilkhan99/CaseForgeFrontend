import { describe, expect, it } from 'vitest'
import { patientInitials } from './callBrief'

describe('patientInitials', () => {
  it('takes the first two', () => {
    expect(patientInitials('Marcus Webb')).toBe('MW')
    expect(patientInitials('anna maria de souza')).toBe('AM')
    expect(patientInitials('Prince')).toBe('P')
    expect(patientInitials(null)).toBe('??')
  })
})
