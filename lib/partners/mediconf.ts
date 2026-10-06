/**
 * MediConf "further reading": the MediConf learning resources each case links.
 *
 * MediConf run free live CPD for primary care. From autumn 2026 they signpost
 * GP trainees from their webinars to our free cases (Rebecca McConnell, 30 Sept
 * 2026), and in return the cases that match their webinar topics link MediConf
 * in "Further reading", the same way PCCS modules are linked
 * (lib/partners/pccsAcademy.ts). What we told MediConf the block would be:
 *
 *  - links to MediConf learning RESOURCES, chosen by MediConf. Not our pick of
 *    their webinar pages.
 *  - "Free for primary care professionals. You need a MediConf account to
 *    access these.", with a link to register. Without that a trainee meets a
 *    login wall and reasonably concludes the link is broken.
 *
 * MediConf have not sent their list yet, so the map below ships EMPTY and the
 * MediConf group renders on no case. Any case may carry resources, not only
 * the free five.
 *
 * Kept in code, keyed by station id, like PCCS_FURTHER_READING: rows of
 * editorial judgement that should be reviewed in a diff and guarded by a test
 * (mediconf.test.ts checks every entry).
 *
 * ADDING RESOURCES. One entry per case, keyed by the station id of the case's
 * LIVE version (a case replaced in the case bank rewrite has a new id).
 * Resources show in the order listed. For example:
 *
 *   export const MEDICONF_RESOURCES = {
 *     // Disengaged 17-year-old with headaches in exam season
 *     'c72e0e6f-526c-4812-9515-85d4c9fbad59': [
 *       {
 *         key: 'headache-migraine-primary-care',
 *         title: 'Headache and migraine in primary care',
 *         url: 'https://www.mediconf.co.uk/<the resource's address>',
 *       },
 *     ],
 *   }
 *
 *  - key: short, lowercase, hyphenated and never changed once live. The click
 *    analytics (mediconf_resource_clicked) count by it. The same resource on
 *    two cases keeps the same key.
 *  - title: MediConf's own title for the resource.
 *  - url: the resource itself, https, on mediconf.co.uk.
 *
 * The five free cases, matched to MediConf's autumn 2026 webinar topics
 * (4 Oct 2026), are the likely first homes:
 *
 *   bd366981-204e-46dd-a3e3-b220d6c7e110  third reliever inhaler in 2 months (respiratory)
 *   2610a2a8-fd8d-4303-b86a-6d02ed220876  teacher with a blocked nose (allergic rhinitis)
 *   a2c99c9a-4fc3-47fb-8236-bee72c3625e6  allergy testing for a child with eczema
 *   16c48616-d334-4d20-8af1-f17388f702b8  pre-diabetes and cardiovascular risk (also has PCCS)
 *   c72e0e6f-526c-4812-9515-85d4c9fbad59  17-year-old with headaches in exam season
 */

export interface MediconfResource {
  /** Stable analytics name: lowercase and hyphenated, e.g. 'headache-migraine-primary-care'. */
  key: string
  /** MediConf's own title for the resource. */
  title: string
  url: string
}

/** The line that introduces the group: MediConf's strapline, as agreed in the mock-up. */
export const MEDICONF_INTRO =
  'From MediConf: free live CPD for primary care, practical, relevant and ready to apply in practice.'

/** MediConf's account registration page, where the "Register with MediConf" link goes. */
export const MEDICONF_REGISTER_URL = 'https://www.mediconf.co.uk/register'

/**
 * The logo MediConf gave permission to use on our site (with Rebecca's email,
 * 30 Sept 2026), trimmed to its artwork on a transparent ground.
 */
export const MEDICONF_LOGO = {
  src: '/partners/mediconf-logo.png',
  width: 640,
  height: 153,
} as const

/** Station id -> the MediConf resources it links, in display order. Empty until MediConf send their list. */
export const MEDICONF_RESOURCES: Readonly<Record<string, readonly MediconfResource[]>> = {}

export function mediconfResourcesFor(
  stationId: string | null | undefined,
  resources: Readonly<Record<string, readonly MediconfResource[]>> = MEDICONF_RESOURCES,
): readonly MediconfResource[] {
  if (!stationId) return []
  return resources[stationId] ?? []
}
