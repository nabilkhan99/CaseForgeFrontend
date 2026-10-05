import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

/**
 * The dashboard's trial panel maps the five through THIS PERSON'S case index
 * by slot (stationsForAllowlist, tested in lib/stations), so once a free case
 * is replaced the panel still shows five cases, each the version this person
 * runs, rather than dropping the slot whose flagged id is not in their index.
 */
const source = readFileSync(join(__dirname, 'page.tsx'), 'utf8')

describe('dashboard trial panel', () => {
  it('maps the free ids through the person\'s index by slot', () => {
    expect(source).toContain("import { stationsForAllowlist } from '@/lib/stations/caseVersionsAllowlist'")
    expect(source).toMatch(/setTrialStations\(stationsForAllowlist\(freeIds, stationIndex\)\)/)
  })
})
