import { existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import {
  MEDICONF_INTRO,
  MEDICONF_LOGO,
  MEDICONF_REGISTER_URL,
  MEDICONF_RESOURCES,
  mediconfResourcesFor,
  type MediconfResource,
} from './mediconf'

/**
 * MediConf "further reading": the learning resources MediConf choose for each
 * case.
 *
 * MediConf have not sent their list yet, so the shipped map is empty and these
 * tests run the lookup and the entry rules against a fixture shaped like the
 * mock-up. The same rules run over the shipped map, so whatever is added to it
 * later is checked on the way in.
 */

type ResourceMap = Readonly<Record<string, readonly MediconfResource[]>>

const CASE = {
  teenHeadache: 'c72e0e6f-526c-4812-9515-85d4c9fbad59',
  preDiabetesRisk: '16c48616-d334-4d20-8af1-f17388f702b8',
  unlinked: 'dc09415f-53cf-4f02-97ab-4ca6971f0cde',
} as const

const HEADACHE: MediconfResource = {
  key: 'headache-migraine-primary-care',
  title: 'Headache and migraine in primary care',
  url: 'https://www.mediconf.co.uk/resources/headache-and-migraine',
}

const FIXTURE: ResourceMap = {
  [CASE.teenHeadache]: [
    HEADACHE,
    {
      key: 'medication-overuse-headache',
      title: 'Medication overuse headache',
      url: 'https://www.mediconf.co.uk/resources/medication-overuse-headache',
    },
  ],
  [CASE.preDiabetesRisk]: [
    {
      key: 'communicating-diabetes-risk',
      title: 'Communicating diabetes risk',
      url: 'https://mediconf.co.uk/resources/communicating-diabetes-risk',
    },
  ],
}

const STATION_ID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/
const KEY = /^[a-z0-9]+(?:-[a-z0-9]+)*$/
const MEDICONF_HOSTS = new Set(['www.mediconf.co.uk', 'mediconf.co.uk'])

/** Everything wrong with a resource map, one line per problem. Empty means it is fit to ship. */
function problemsWith(resources: ResourceMap): string[] {
  const problems: string[] = []
  const urlByKey = new Map<string, string>()

  for (const [stationId, list] of Object.entries(resources)) {
    if (!STATION_ID.test(stationId)) problems.push(`${stationId}: not a station id`)
    if (list.length === 0) problems.push(`${stationId}: empty list (drop the entry instead)`)

    const keysHere = new Set<string>()
    for (const resource of list) {
      const where = `${stationId} / ${resource.key}`
      if (!KEY.test(resource.key)) problems.push(`${where}: key is not lowercase-hyphenated`)
      if (keysHere.has(resource.key)) problems.push(`${where}: key listed twice on one case`)
      keysHere.add(resource.key)

      const seenUrl = urlByKey.get(resource.key)
      if (seenUrl !== undefined && seenUrl !== resource.url) {
        problems.push(`${where}: key already names a different resource`)
      }
      urlByKey.set(resource.key, resource.url)

      if (resource.title.trim() === '' || resource.title !== resource.title.trim()) {
        problems.push(`${where}: title is empty or padded`)
      }
      if (resource.title.includes('—')) problems.push(`${where}: em dash in the title`)

      let url: URL | null = null
      try {
        url = new URL(resource.url)
      } catch {
        problems.push(`${where}: url does not parse`)
      }
      if (url && (url.protocol !== 'https:' || !MEDICONF_HOSTS.has(url.hostname))) {
        problems.push(`${where}: url is not https on mediconf.co.uk`)
      }
    }
  }
  return problems
}

describe('which resources a case links', () => {
  it('lists a case\'s resources in the order given', () => {
    expect(mediconfResourcesFor(CASE.teenHeadache, FIXTURE).map((resource) => resource.key)).toEqual([
      'headache-migraine-primary-care',
      'medication-overuse-headache',
    ])
  })

  it('answers nothing for a case with no resources, or for no case at all', () => {
    expect(mediconfResourcesFor(CASE.unlinked, FIXTURE)).toEqual([])
    expect(mediconfResourcesFor(null, FIXTURE)).toEqual([])
    expect(mediconfResourcesFor(undefined, FIXTURE)).toEqual([])
    expect(mediconfResourcesFor('', FIXTURE)).toEqual([])
  })

  it('reads the shipped map when not handed one', () => {
    for (const stationId of [...Object.keys(MEDICONF_RESOURCES), CASE.teenHeadache, CASE.unlinked]) {
      expect(mediconfResourcesFor(stationId)).toEqual(MEDICONF_RESOURCES[stationId] ?? [])
    }
  })
})

describe('the entries', () => {
  it('ships nothing that breaks the rules', () => {
    expect(problemsWith(MEDICONF_RESOURCES)).toEqual([])
  })

  it('accepts entries shaped like the documented example', () => {
    expect(problemsWith(FIXTURE)).toEqual([])
  })

  it.each<[string, ResourceMap]>([
    ['a station id that is not one', { 'headache-case': [HEADACHE] }],
    ['an empty list', { [CASE.teenHeadache]: [] }],
    ['a key that is not lowercase-hyphenated', { [CASE.teenHeadache]: [{ ...HEADACHE, key: 'Headache Migraine' }] }],
    ['one key twice on a case', { [CASE.teenHeadache]: [HEADACHE, HEADACHE] }],
    [
      'one key for two different resources',
      {
        [CASE.teenHeadache]: [HEADACHE],
        [CASE.preDiabetesRisk]: [{ ...HEADACHE, url: 'https://www.mediconf.co.uk/resources/other' }],
      },
    ],
    ['a blank title', { [CASE.teenHeadache]: [{ ...HEADACHE, title: '  ' }] }],
    ['an em dash in a title', { [CASE.teenHeadache]: [{ ...HEADACHE, title: 'Headache — in primary care' }] }],
    ['an http link', { [CASE.teenHeadache]: [{ ...HEADACHE, url: 'http://www.mediconf.co.uk/resources/x' }] }],
    ['a link off MediConf', { [CASE.teenHeadache]: [{ ...HEADACHE, url: 'https://example.com/headache' }] }],
    ['a link that does not parse', { [CASE.teenHeadache]: [{ ...HEADACHE, url: 'mediconf.co.uk/x' }] }],
  ])('rejects %s', (_label, resources) => {
    expect(problemsWith(resources)).toHaveLength(1)
  })
})

describe('what the group says about MediConf', () => {
  it('opens with the line agreed in the mock-up', () => {
    expect(MEDICONF_INTRO).toBe(
      'From MediConf: free live CPD for primary care, practical, relevant and ready to apply in practice.',
    )
  })

  it('sends "Register with MediConf" to their registration page', () => {
    expect(MEDICONF_REGISTER_URL).toBe('https://www.mediconf.co.uk/register')
  })

  it('shows the logo MediConf gave us, from a file that exists', () => {
    expect(MEDICONF_LOGO.src).toBe('/partners/mediconf-logo.png')
    const file = fileURLToPath(new URL(`../../public${MEDICONF_LOGO.src}`, import.meta.url))
    expect(existsSync(file)).toBe(true)
  })
})
