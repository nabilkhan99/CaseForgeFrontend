import React, { createElement } from 'react'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'
import MediconfReadingGroup from './MediconfReadingGroup'
import { MEDICONF_INTRO, MEDICONF_REGISTER_URL, type MediconfResource } from '@/lib/partners/mediconf'

// Vitest compiles JSX with the classic runtime (Next uses the automatic one),
// so the component's JSX needs React in scope when it renders.
;(globalThis as { React?: typeof React }).React = React

// Clicks cannot happen in a static render; keep the analytics client out of it.
vi.mock('@/lib/analytics', () => ({ trackEvent: vi.fn() }))

/**
 * The MediConf group inside "Further reading", drawn from a fixture.
 *
 * The shipped resource map is empty until MediConf send their list, so the
 * group is rendered here from resources shaped like the agreed mock-up: the
 * intro line with the logo, one row per resource labelled "MediConf learning
 * resource", and the account small print with the register link.
 */

const RESOURCES: readonly MediconfResource[] = [
  {
    key: 'headache-migraine-primary-care',
    title: 'Headache and migraine in primary care',
    url: 'https://www.mediconf.co.uk/resources/headache-and-migraine',
  },
  {
    key: 'medication-overuse-headache',
    title: 'Medication overuse headache',
    url: 'https://www.mediconf.co.uk/resources/medication-overuse-headache',
  },
]

const html = renderToStaticMarkup(
  createElement(MediconfReadingGroup, {
    resources: RESOURCES,
    stationId: 'c72e0e6f-526c-4812-9515-85d4c9fbad59',
    surface: 'case_page',
  }),
)

/** Visible text: React's text-node separators removed, tags flattened to spaces. */
function text(markup: string): string {
  return markup
    .replace(/<!-- -->/g, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

/** Every <a ...> opening tag in the markup. */
function anchors(markup: string): string[] {
  return markup.match(/<a [^>]*>/g) ?? []
}

function source(relativePath: string): string {
  return readFileSync(fileURLToPath(new URL(relativePath, import.meta.url)), 'utf8')
}

/** Comments discuss the rules; only the code and copy are bound by them. */
function withoutComments(code: string): string {
  return code
    .replace(/\{\/\*[\s\S]*?\*\/\}/g, ' ')
    .replace(/\/\*[\s\S]*?\*\//g, ' ')
    .replace(/^\s*\/\/.*$/gm, ' ')
}

describe('the MediConf group', () => {
  it('opens with MediConf\'s intro line and their logo', () => {
    expect(text(html)).toContain(MEDICONF_INTRO)
    expect(html).toMatch(/<img[^>]*alt="MediConf"/)
    expect(html).toContain('mediconf-logo.png')
    // The line comes before the logo in the markup, so it is read first.
    expect(html.indexOf(MEDICONF_INTRO)).toBeLessThan(html.indexOf('alt="MediConf"'))
  })

  it('lists each resource, in order, as a MediConf learning resource', () => {
    const visible = text(html)
    expect(visible).toContain('Headache and migraine in primary care MediConf learning resource')
    expect(visible).toContain('Medication overuse headache MediConf learning resource')
    expect(visible.indexOf('Headache and migraine')).toBeLessThan(visible.indexOf('Medication overuse'))
  })

  it('links each row to the resource itself', () => {
    const hrefs = anchors(html).map((tag) => tag.match(/href="([^"]+)"/)?.[1])
    expect(hrefs).toEqual([...RESOURCES.map((resource) => resource.url), MEDICONF_REGISTER_URL])
  })

  it('opens MediConf in a new tab and lets the referrer through', () => {
    for (const tag of anchors(html)) {
      expect(tag).toContain('target="_blank"')
      expect(tag).toContain('rel="noopener"')
      expect(tag).not.toContain('noreferrer')
    }
  })

  it('says plainly that the resources need a free MediConf account, and where to get one', () => {
    expect(text(html)).toContain(
      'Free for primary care professionals. You need a MediConf account to access these. Register with MediConf',
    )
  })

  it('keeps em dashes out of the copy', () => {
    expect(text(html)).not.toContain('—')
    expect(withoutComments(source('./MediconfReadingGroup.tsx'))).not.toContain('—')
  })

  it('counts the clicks, by resource and by surface', () => {
    const group = withoutComments(source('./MediconfReadingGroup.tsx'))
    expect(group).toContain("trackEvent('mediconf_resource_clicked'")
    expect(group).toMatch(/resource: resource\.key/)
    expect(group).toMatch(/station_id: stationId \?\? ''/)
    expect(group).toMatch(/surface,/)
  })
})
