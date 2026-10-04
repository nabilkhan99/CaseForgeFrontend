import { describe, expect, it } from 'vitest'
import { examFromDate, examFromSitting, resolveExam } from './exam'
import { isNeverALead } from './exclusions'
import { heatScore, NO_SIGNALS } from './heat'
import { phoneView } from './phone'

const TODAY = '2026-10-04'
const NOW = new Date('2026-10-04T10:45:00Z')

describe('exam timing', () => {
  it('classes an exact date by days away', () => {
    expect(examFromDate(TODAY, '2026-10-07')).toMatchObject({ cls: 'now', label: '7 Oct 2026 · 3d', days: 3 })
    expect(examFromDate(TODAY, '2026-11-18').cls).toBe('prime')
    expect(examFromDate(TODAY, '2027-02-01').cls).toBe('soon')
    expect(examFromDate(TODAY, '2027-09-01').cls).toBe('far')
    expect(examFromDate(TODAY, '2026-09-10')).toMatchObject({ cls: 'sat', label: '10 Sept 2026 (sat)' })
  })

  it('reads the old trial form’s sitting keys by months ahead', () => {
    expect(examFromSitting(TODAY, 'sep_2026')).toMatchObject({ cls: 'sat', label: 'Sat in September 2026' })
    expect(examFromSitting(TODAY, 'oct_2026').cls).toBe('now')
    expect(examFromSitting(TODAY, 'nov_2026').cls).toBe('prime')
    expect(examFromSitting(TODAY, 'early_2027')).toMatchObject({ cls: 'soon', label: 'Early 2027' })
    expect(examFromSitting(TODAY, 'later_2028')).toMatchObject({ cls: 'far', label: '2028' })
    expect(examFromSitting(TODAY, 'not_sure')).toMatchObject({ cls: 'unknown', label: 'Not sure yet' })
    expect(examFromSitting(TODAY, null)).toMatchObject({ cls: 'unknown', label: 'Not given' })
  })

  it('prefers a call, then the profile, then the form', () => {
    expect(resolveExam(TODAY, { callDate: null, callMonth: '2027-02', profileDate: '2026-11-18', sitting: 'jan_2027' }).label).toBe('February 2027')
    expect(resolveExam(TODAY, { callDate: null, callMonth: null, profileDate: '2026-11-18', sitting: 'jan_2027' }).date).toBe('2026-11-18')
    expect(resolveExam(TODAY, { callDate: null, callMonth: null, profileDate: null, sitting: 'jan_2027' }).label).toBe('January 2027')
  })
})

describe('heat', () => {
  const base = {
    now: NOW,
    exam: examFromSitting(TODAY, 'nov_2026'),
    consultations: 11,
    passes: 3,
    activeDays: 4,
    signals: { ...NO_SIGNALS, checkoutStarts: 1, pricingViews: 3, studyBudget: 1 },
    lastActivity: new Date('2026-09-29T10:00:00Z'),
    notCandidate: false,
  }

  it('adds up the rubric with its reasons', () => {
    const result = heatScore(base)
    expect(result.score).toBe(15)
    expect(result.heat).toBe('hot')
    expect(result.why).toEqual([
      'exam in 1 to 2 months',
      'passed 3 cases',
      '11 consultations',
      'came back on another day',
      'reached the payment page',
      'compared prices',
      'checked study-budget funding',
      'active in the last 2 weeks',
    ])
  })

  it('caps someone not in GP training at cool', () => {
    expect(heatScore({ ...base, notCandidate: true })).toMatchObject({ score: 2, heat: 'cool' })
  })

  it('takes a point off someone not seen for a month', () => {
    const quiet = heatScore({ ...base, signals: NO_SIGNALS, consultations: 1, passes: 0, activeDays: 1, lastActivity: new Date('2026-08-01T10:00:00Z') })
    expect(quiet.score).toBe(2) // exam in 1 to 2 months (3), not seen for a month (-1)
  })
})

describe('phones', () => {
  it('formats UK mobiles and links them', () => {
    expect(phoneView('+447700900123')).toEqual({ display: '+44 7700 900123', tel: 'tel:+447700900123', malformed: false })
  })

  it('flags a UK mobile the trial form stored as +7, and dials the likely number', () => {
    expect(phoneView('+7700900123')).toEqual({
      display: '+44 7700 900123',
      tel: 'tel:+447700900123',
      malformed: true,
    })
  })

  it('has nothing to show without a number', () => {
    expect(phoneView(null)).toBeNull()
    expect(phoneView('  ')).toBeNull()
  })
})

describe('exclusions', () => {
  it('keeps a real doctor whose name starts like a founder’s', () => {
    expect(isNeverALead('ishaq.ahmed@example.org')).toBe(false)
    expect(isNeverALead('ishaqmiah1@example.org')).toBe(true)
  })

  it('drops throwaway and test domains', () => {
    expect(isNeverALead('someone@mailinator.com')).toBe(true)
    expect(isNeverALead('someone@neplis.com')).toBe(true)
    expect(isNeverALead('not-an-email')).toBe(true)
  })
})

describe('London time', () => {
  it('turns a London wall time into the right instant either side of the clocks going back', async () => {
    const { londonWallTimeToUtc, londonToday } = await import('./time')
    expect(londonWallTimeToUtc('2026-10-24', '18:00').toISOString()).toBe('2026-10-24T17:00:00.000Z') // BST
    expect(londonWallTimeToUtc('2026-10-26', '18:00').toISOString()).toBe('2026-10-26T18:00:00.000Z') // GMT
    expect(londonToday(new Date('2026-10-04T23:30:00Z'))).toBe('2026-10-05')
  })
})
