import { describe, expect, it } from 'vitest'
import {
  MEDICONF_STRAPLINE,
  MEDICONF_WEBINARS,
  mediconfWebinarFor,
  webinarWhen,
} from './mediconf'

/**
 * MediConf "further reading": one webinar per free case.
 *
 * MediConf signpost GP trainees on five Saturday webinars to the five free
 * cases (Rebecca McConnell, 30 Sept 2026), and in return each of those cases
 * points back at its webinar. Only the five free cases carry a link (Nabil,
 * 4 Oct 2026), so the pairing is pinned here: a swap of the free set that
 * forgets this file fails a test instead of linking the wrong webinar.
 */

const CASE = {
  relieverInhaler: 'bd366981-204e-46dd-a3e3-b220d6c7e110',
  allergicRhinitis: '2610a2a8-fd8d-4303-b86a-6d02ed220876',
  childEczema: 'a2c99c9a-4fc3-47fb-8236-bee72c3625e6',
  preDiabetesRisk: '16c48616-d334-4d20-8af1-f17388f702b8',
  teenMigraine: 'c72e0e6f-526c-4812-9515-85d4c9fbad59',
} as const

describe('which case points at which webinar', () => {
  it('links exactly the five free cases', () => {
    expect(Object.keys(MEDICONF_WEBINARS).sort()).toEqual(Object.values(CASE).sort())
  })

  it.each([
    [CASE.relieverInhaler, 'What is New in Respiratory Medicine 2026', '2026-10-03', 196],
    [CASE.allergicRhinitis, 'Prescribing and Clinical Pearls for Primary Care', '2026-10-17', 174],
    [CASE.childEczema, 'Atopic Eczema in Children: What Works in a 10-Minute Consultation', '2026-11-07', 180],
    [CASE.preDiabetesRisk, 'Communicating Diabetes Risk & Therapeutic Messages to Patients', '2026-11-14', 187],
    [CASE.teenMigraine, 'Managing Headaches and Migraine', '2026-11-21', 200],
  ])('%s → %s', (stationId, title, date, eventId) => {
    const webinar = mediconfWebinarFor(stationId)
    expect(webinar?.title).toBe(title)
    expect(webinar?.date).toBe(date)
    expect(webinar?.url.startsWith(`https://www.mediconf.co.uk/event/${eventId}/`)).toBe(true)
  })

  it('answers nothing for any other case, or for no case at all', () => {
    expect(mediconfWebinarFor('dc09415f-53cf-4f02-97ab-4ca6971f0cde')).toBeNull()
    expect(mediconfWebinarFor(null)).toBeNull()
    expect(mediconfWebinarFor(undefined)).toBeNull()
    expect(mediconfWebinarFor('')).toBeNull()
  })
})

describe('what the block says about MediConf', () => {
  it('uses the strapline MediConf supplied, word for word', () => {
    expect(MEDICONF_STRAPLINE).toBe(
      'Free live CPD for primary care – practical, relevant and ready to apply in practice.',
    )
  })

  it('calls a webinar that has not happened yet live', () => {
    const rhinitis = mediconfWebinarFor(CASE.allergicRhinitis)!
    expect(webinarWhen(rhinitis, new Date('2026-10-04T18:00:00Z'))).toBe('Live webinar, Saturday 17 October 2026')
  })

  it('stops calling it live once it has been held', () => {
    const respiratory = mediconfWebinarFor(CASE.relieverInhaler)!
    expect(webinarWhen(respiratory, new Date('2026-10-04T18:00:00Z'))).toBe('Webinar held Saturday 3 October 2026')
  })

  it('still calls it live on the morning it runs', () => {
    const migraine = mediconfWebinarFor(CASE.teenMigraine)!
    expect(webinarWhen(migraine, new Date('2026-11-21T08:00:00Z'))).toBe('Live webinar, Saturday 21 November 2026')
  })
})
