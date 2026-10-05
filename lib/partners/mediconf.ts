/**
 * MediConf "further reading": the webinar each free case points back at.
 *
 * MediConf run free live CPD webinars for primary care, and in autumn 2026 they
 * signpost GP trainees from five of them to our five free cases (Rebecca
 * McConnell, 30 Sept 2026). The free five were chosen to match those webinars
 * (4 Oct 2026), and each of them links its webinar here in return.
 *
 * Only the five free cases carry a link (Nabil, 4 Oct 2026). Kept in code, keyed
 * by station id, like PCCS_FURTHER_READING: it is five rows of editorial
 * judgement that should be reviewed in a diff and guarded by a test.
 *
 * The links outlive the webinars. Once a date has passed the block says the
 * webinar was held rather than calling it live; where those links should point
 * afterwards (a recording, or the webinar list) is MediConf's to say.
 */

export type MediconfWebinarKey = 'respiratory' | 'pearls' | 'eczema' | 'diabetes' | 'headache'

export interface MediconfWebinar {
  key: MediconfWebinarKey
  /** MediConf's own title for the webinar, as it appears on their site. */
  title: string
  /** The Saturday it runs, as YYYY-MM-DD (UK). */
  date: string
  url: string
}

/** Supplied by MediConf for use on our site; keep it word for word. */
export const MEDICONF_STRAPLINE =
  'Free live CPD for primary care – practical, relevant and ready to apply in practice.'

export const MEDICONF_WEBINARS_URL = 'https://www.mediconf.co.uk/events/webinar'

/**
 * The logo MediConf gave permission to use on our site (with Rebecca's email,
 * 30 Sept 2026), trimmed to its artwork on a transparent ground. Set this back
 * to null and the block shows the name in its place.
 */
export const MEDICONF_LOGO: { src: string; width: number; height: number } | null = {
  src: '/partners/mediconf-logo.png',
  width: 640,
  height: 153,
}

function webinar(key: MediconfWebinarKey, title: string, date: string, path: string): MediconfWebinar {
  return { key, title, date, url: `https://www.mediconf.co.uk/event/${path}` }
}

/** Station id -> its webinar. Only the five free cases. */
export const MEDICONF_WEBINARS: Readonly<Record<string, MediconfWebinar>> = {
  // Woman ordering her third reliever inhaler in 2 months
  'bd366981-204e-46dd-a3e3-b220d6c7e110': webinar(
    'respiratory',
    'What is New in Respiratory Medicine 2026',
    '2026-10-03',
    '196/what-is-new-in-respiratory-medicine-2026',
  ),
  // Teacher with a blocked nose for months (allergic rhinitis, the webinar's sponsored talk).
  // MediConf's own address for this event carries an older slug; it is the right page.
  '2610a2a8-fd8d-4303-b86a-6d02ed220876': webinar(
    'pearls',
    'Prescribing and Clinical Pearls for Primary Care',
    '2026-10-17',
    '174/testosterone-deficiency-and-male-sexual-dysfunction',
  ),
  // Parent requesting allergy testing for their child with eczema
  'a2c99c9a-4fc3-47fb-8236-bee72c3625e6': webinar(
    'eczema',
    'Atopic Eczema in Children: What Works in a 10-Minute Consultation',
    '2026-11-07',
    '180/atopic-eczema-in-children-what-works-in-a-10-minute-consultation',
  ),
  // South Asian man with pre-diabetes and cardiovascular risk after a health check
  '16c48616-d334-4d20-8af1-f17388f702b8': webinar(
    'diabetes',
    'Communicating Diabetes Risk & Therapeutic Messages to Patients',
    '2026-11-14',
    '187/communicating-diabetes-risk-therapeutic-messages-to-patients',
  ),
  // Disengaged 17-year-old with headaches in exam season
  'c72e0e6f-526c-4812-9515-85d4c9fbad59': webinar(
    'headache',
    'Managing Headaches and Migraine',
    '2026-11-21',
    '200/managing-headaches-and-migraine',
  ),
}

export function mediconfWebinarFor(stationId: string | null | undefined): MediconfWebinar | null {
  if (!stationId) return null
  return MEDICONF_WEBINARS[stationId] ?? null
}

/**
 * When the webinar is, in words: "Live webinar, Saturday 17 October 2026" until
 * it has run, then "Webinar held Saturday 3 October 2026". They run 09:30 to
 * 11:30 UK time, so midday UTC is safely after the end in either season.
 */
export function webinarWhen(webinar: MediconfWebinar, now: Date = new Date()): string {
  const day = new Date(`${webinar.date}T12:00:00Z`)
  // Built from parts: whether en-GB puts a comma after the weekday varies by
  // ICU version, and the server and the browser must print the same string.
  const parts = new Intl.DateTimeFormat('en-GB', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: 'Europe/London',
  }).formatToParts(day)
  const part = (type: Intl.DateTimeFormatPartTypes) => parts.find((p) => p.type === type)?.value ?? ''
  const label = `${part('weekday')} ${part('day')} ${part('month')} ${part('year')}`
  return now.getTime() < day.getTime() ? `Live webinar, ${label}` : `Webinar held ${label}`
}
