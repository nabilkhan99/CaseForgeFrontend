import { describe, expect, it } from 'vitest'
import {
  PCCS_ACADEMY_URL,
  PCCS_JOIN_URL,
  PCCS_MODULES,
  PCCS_FURTHER_READING,
  pccsFurtherReadingFor,
} from './pccsAcademy'

/**
 * The PCCS Academy "further reading" links.
 *
 * The Primary Care Cardiovascular Society asked for nine of its Academy modules
 * to be signposted from the matching cases (Helen Makris, 2 Sept 2026). The
 * pairing is a clinical judgement made against each case's own learning points
 * rather than its title, so it is written down here where a wrong edit fails a
 * test instead of quietly sending a trainee to the wrong module.
 */

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/

// Station ids, named so the assertions below read as cases and not as hex.
const CASE = {
  suddenCardiacDeathScreening: '14d22868-ae06-4d75-a8b7-bbd432bd5f8d',
  chestPainOnExercise: 'dc09415f-53cf-4f02-97ab-4ca6971f0cde',
  abnormalEcg: '70e2ee27-b565-4b88-a889-3ab0a6d35dc2',
  statinLowQrisk: 'cc4ab161-748a-4e37-8ad2-4583cd5bde37',
  resistantHypertension: 'a1e23e4a-5c79-4404-b7d3-c7c66390631a',
  statinIntolerance: 'ea2cd5df-cd85-48e8-b55c-504211b58980',
  bradycardiaPreOp: '9d4b7fee-a278-4eb0-ae3a-41f63694b016',
  worseningHeartFailure: 'e61ccedd-9263-422d-88d5-d9cac1b53c30',
  transientHandWeakness: '499f27d9-c445-45eb-9f61-267e62d597da',
  hrtSafety: '500fc1a0-42a1-44d5-9c09-c7fc4e8244be',
  heartFailureIncontinence: 'cb6e2e32-6dd3-4537-9eb6-9de49b8f4610',
  southAsianCvRisk: '16c48616-d334-4d20-8af1-f17388f702b8',
  // Deliberately unlinked.
  dryCoughAfterMi: 'c64a5ae8-bee9-4866-888b-551ed2d1a0d8',
  heartFailureDnacpr: 'baa8226b-614c-4fd0-8fe1-f07c6b794675',
  settledChestPain: 'e27911bc-692a-4b79-a149-e940f6cef7d4',
} as const

const keysFor = (stationId: string) => pccsFurtherReadingFor(stationId).map((module) => module.key)

describe('the PCCS module catalogue', () => {
  it('carries the nine modules PCCS sent, at the addresses they sent', () => {
    expect(Object.fromEntries(Object.values(PCCS_MODULES).map((module) => [module.title, module.url]))).toEqual({
      'Cardiovascular Risk Assessment and Cardiovascular Prevention':
        'https://pccsuk.org/academy/3/cardiovascular_risk_assessment_and_cardiovascular_prevention',
      'Cardiac Investigations': 'https://pccsuk.org/academy/15/cardiac_investigations',
      'Cardiology in sport': 'https://pccsuk.org/academy/1018/cardiology_in_sport',
      Syncope: 'https://pccsuk.org/academy/11/syncope',
      'Heart Failure': 'https://pccsuk.org/academy/8/heart_failure',
      Hypertension: 'https://pccsuk.org/academy/5/hypertension',
      Lipids: 'https://pccsuk.org/academy/6/lipids',
      'Stroke & TIA': 'https://pccsuk.org/academy/16/stroke_tia',
      "Women's Health & CVD": 'https://pccsuk.org/academy/46/womens_health_cvd',
    })
  })

  it('keys every module by its own key', () => {
    for (const [key, module] of Object.entries(PCCS_MODULES)) expect(module.key).toBe(key)
  })

  it('points the two supporting links at PCCS', () => {
    expect(PCCS_ACADEMY_URL).toBe('https://pccsuk.org/academy')
    // Membership is free for practising healthcare professionals, and every
    // module is behind the member login, so this is the link that unblocks them.
    expect(PCCS_JOIN_URL).toBe('https://pccsuk.org/about/join_the_pccs.aspx')
  })
})

describe('which cases signpost which modules', () => {
  it('links twelve cases, each to one or two modules and never the same one twice', () => {
    const entries = Object.entries(PCCS_FURTHER_READING)
    expect(entries).toHaveLength(12)
    for (const [stationId, keys] of entries) {
      expect(stationId).toMatch(UUID)
      expect(keys.length).toBeGreaterThanOrEqual(1)
      expect(keys.length).toBeLessThanOrEqual(2)
      expect(new Set(keys).size).toBe(keys.length)
      for (const key of keys) expect(PCCS_MODULES[key]).toBeDefined()
    }
  })

  it('signposts every one of the nine modules from somewhere', () => {
    const used = new Set(Object.values(PCCS_FURTHER_READING).flat())
    expect([...used].sort()).toEqual(Object.keys(PCCS_MODULES).sort())
  })

  it('pairs by what the case teaches, not by what its title says', () => {
    // Titled "abnormal ECG result", but the case is incidental atrial
    // fibrillation: the investigation, and the stroke risk it carries.
    expect(keysFor(CASE.abnormalEcg)).toEqual(['investigations', 'stroke'])
    // Bradycardia matters when it is symptomatic, and syncope is the symptom.
    expect(keysFor(CASE.bradycardiaPreOp)).toEqual(['investigations', 'syncope'])
    expect(keysFor(CASE.chestPainOnExercise)).toEqual(['investigations', 'risk'])
    expect(keysFor(CASE.statinLowQrisk)).toEqual(['risk', 'lipids'])
  })

  it('pairs the single-module cases', () => {
    expect(keysFor(CASE.suddenCardiacDeathScreening)).toEqual(['sport'])
    expect(keysFor(CASE.resistantHypertension)).toEqual(['hypertension'])
    expect(keysFor(CASE.statinIntolerance)).toEqual(['lipids'])
    expect(keysFor(CASE.worseningHeartFailure)).toEqual(['heartFailure'])
    expect(keysFor(CASE.heartFailureIncontinence)).toEqual(['heartFailure'])
    expect(keysFor(CASE.transientHandWeakness)).toEqual(['stroke'])
    expect(keysFor(CASE.hrtSafety)).toEqual(['womensHealth'])
    expect(keysFor(CASE.southAsianCvRisk)).toEqual(['risk'])
  })

  it('leaves a case unlinked rather than send it somewhere that does not fit', () => {
    // A cardiovascular-domain case whose teaching is lung cancer red flags.
    expect(pccsFurtherReadingFor(CASE.dryCoughAfterMi)).toEqual([])
    // A resuscitation-wishes conversation: ethics, not heart failure management.
    expect(pccsFurtherReadingFor(CASE.heartFailureDnacpr)).toEqual([])
    // Suspected acute coronary syndrome, which none of the nine modules covers.
    expect(pccsFurtherReadingFor(CASE.settledChestPain)).toEqual([])
  })

  it('answers nothing for a case it has never heard of, or for no case at all', () => {
    expect(pccsFurtherReadingFor('00000000-0000-0000-0000-000000000000')).toEqual([])
    expect(pccsFurtherReadingFor(null)).toEqual([])
    expect(pccsFurtherReadingFor(undefined)).toEqual([])
    expect(pccsFurtherReadingFor('')).toEqual([])
  })

  it('hands back modules in the order the pairing lists them', () => {
    expect(pccsFurtherReadingFor(CASE.statinLowQrisk).map((module) => module.title)).toEqual([
      'Cardiovascular Risk Assessment and Cardiovascular Prevention',
      'Lipids',
    ])
  })
})
