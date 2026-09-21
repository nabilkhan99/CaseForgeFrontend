/**
 * PCCS Academy "further reading": which of the Primary Care Cardiovascular
 * Society's learning modules each case signposts.
 *
 * Agreed with PCCS on 2 Sept 2026 (Helen Makris): they sent nine Academy
 * modules to link from the matching cases in the case library.
 *
 * Two things that are easy to get wrong:
 *
 *  - The pairing is made against what a case TEACHES, read from its learning
 *    points, not against its title. "Man contacted about an abnormal ECG
 *    result" is a case about incidental atrial fibrillation, so it points at the
 *    investigation and at the stroke risk. "Man with a dry cough several months
 *    after his heart attack" sits in the cardiovascular domain but teaches lung
 *    cancer red flags, so it points nowhere. A case with no honest match is left
 *    out: a poor link reads worse than no link.
 *
 *  - Every module is behind the PCCS member login. Membership is free for
 *    practising healthcare professionals, which covers every trainee here, so
 *    the block that renders these says so and links to the join page. Without
 *    that a trainee meets a login wall and reasonably concludes the link is
 *    broken.
 *
 * Kept in code, keyed by station id, the way CASE_SEO_OVERRIDES is in
 * lib/seo/cases.ts: it is a dozen rows of editorial judgement that should be
 * reviewed in a diff and guarded by a test, not edited live in a table.
 */

export type PccsModuleKey =
  | 'risk'
  | 'investigations'
  | 'sport'
  | 'syncope'
  | 'heartFailure'
  | 'hypertension'
  | 'lipids'
  | 'stroke'
  | 'womensHealth'

export interface PccsModule {
  key: PccsModuleKey
  /** PCCS's own name for the module, as it appears on their site. */
  title: string
  url: string
}

export const PCCS_ACADEMY_URL = 'https://pccsuk.org/academy'
export const PCCS_JOIN_URL = 'https://pccsuk.org/about/join_the_pccs.aspx'

function academyModule(key: PccsModuleKey, title: string, path: string): PccsModule {
  return { key, title, url: `${PCCS_ACADEMY_URL}/${path}` }
}

export const PCCS_MODULES: Readonly<Record<PccsModuleKey, PccsModule>> = {
  risk: academyModule(
    'risk',
    'Cardiovascular Risk Assessment and Cardiovascular Prevention',
    '3/cardiovascular_risk_assessment_and_cardiovascular_prevention',
  ),
  investigations: academyModule('investigations', 'Cardiac Investigations', '15/cardiac_investigations'),
  sport: academyModule('sport', 'Cardiology in sport', '1018/cardiology_in_sport'),
  syncope: academyModule('syncope', 'Syncope', '11/syncope'),
  heartFailure: academyModule('heartFailure', 'Heart Failure', '8/heart_failure'),
  hypertension: academyModule('hypertension', 'Hypertension', '5/hypertension'),
  lipids: academyModule('lipids', 'Lipids', '6/lipids'),
  stroke: academyModule('stroke', 'Stroke & TIA', '16/stroke_tia'),
  womensHealth: academyModule('womensHealth', "Women's Health & CVD", '46/womens_health_cvd'),
}

/** Station id -> the modules it signposts, most relevant first. */
export const PCCS_FURTHER_READING: Readonly<Record<string, readonly PccsModuleKey[]>> = {
  // Cardiovascular Health
  '14d22868-ae06-4d75-a8b7-bbd432bd5f8d': ['sport'], // Father concerned about sudden cardiac death screening
  'dc09415f-53cf-4f02-97ab-4ca6971f0cde': ['investigations', 'risk'], // Chest pain during exercise (stable angina)
  '70e2ee27-b565-4b88-a889-3ab0a6d35dc2': ['investigations', 'stroke'], // Abnormal ECG result (atrial fibrillation)
  'cc4ab161-748a-4e37-8ad2-4583cd5bde37': ['risk', 'lipids'], // Requesting a statin with a low QRISK score
  'a1e23e4a-5c79-4404-b7d3-c7c66390631a': ['hypertension'], // BP above 180/100 despite ramipril
  'ea2cd5df-cd85-48e8-b55c-504211b58980': ['lipids'], // High cholesterol, intolerant of statins and ezetimibe
  '9d4b7fee-a278-4eb0-ae3a-41f63694b016': ['investigations', 'syncope'], // Low heart rate at pre-operative assessment
  'e61ccedd-9263-422d-88d5-d9cac1b53c30': ['heartFailure'], // Worsening heart failure symptoms
  // Other domains
  '499f27d9-c445-45eb-9f61-267e62d597da': ['stroke'], // Neurology: transient hand weakness and clumsiness (TIA)
  '500fc1a0-42a1-44d5-9c09-c7fc4e8244be': ['womensHealth'], // Gynaecology: hot flushes, is HRT safe
  'cb6e2e32-6dd3-4537-9eb6-9de49b8f4610': ['heartFailure'], // Older Adults: heart failure and diuretic-induced incontinence
  '16c48616-d334-4d20-8af1-f17388f702b8': ['risk'], // Population Health: CV risk and IFG in a South Asian male
  //
  // Deliberately absent (see the header): the dry cough after a heart attack
  // (c64a5ae8, lung cancer red flags), the heart failure patient asking not to
  // be resuscitated (baa8226b, an ethics conversation), and the chest pain that
  // settled an hour ago (e27911bc, acute coronary syndrome: no module covers it).
}

export function pccsFurtherReadingFor(stationId: string | null | undefined): PccsModule[] {
  if (!stationId) return []
  return (PCCS_FURTHER_READING[stationId] ?? []).map((key) => PCCS_MODULES[key])
}
