import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { toPickerStations } from '@/lib/trial/freeStationPicks'

/**
 * The two pages the free door is now made of, checked against their source.
 *
 * There is no DOM test runner in this project (vitest runs in `node`, and
 * nothing here pulls in jsdom), so a page cannot be rendered and asserted on.
 * What CAN be pinned is the wiring — which module the page lists stations
 * from, that each Start carries the station's own href, and that the form is
 * on /free/open and nowhere else. The same readFileSync trick
 * lib/commerce/pricingFeatures.test.ts uses for the pricing grid, for the same
 * reason: an off-by-one here does not throw, it just quietly offers the wrong
 * thing on the most-linked page on the site.
 */

function source(relativePath: string): string {
  return readFileSync(fileURLToPath(new URL(relativePath, import.meta.url)), 'utf8')
}

/** Comments discuss the copy rules; only the copy itself is bound by them. */
function withoutComments(code: string): string {
  return code.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/^\s*\/\/.*$/gm, ' ')
}

const FREE_PAGE = source('./page.tsx')
const OPEN_PAGE = source('./open/page.tsx')
const PICKER = source('../../components/free/FreePicker.tsx')
const OPEN_VIEW = source('../../components/free/FreeOpen.tsx')

describe('/free lists the five stations', () => {
  it('resolves them on the server, from the free-trial flag in order', () => {
    // `listFreeStations` is the module that filters on `is_free_trial` and
    // orders by `free_trial_order` — see lib/trial/freeStationPicks.test.ts.
    expect(FREE_PAGE).toContain("from '@/lib/trial/freeStationPicks'")
    expect(FREE_PAGE).toContain('listFreeStations(getSupabaseAdmin())')
    expect(FREE_PAGE).toContain('<FreePicker stations={stations}')
  })

  it('links every Start to the free account form with that station on it', () => {
    const stations = toPickerStations([
      { id: 'aaaaaaaa-0000-0000-0000-000000000001', title: 'A case' },
      { id: 'bbbbbbbb-0000-0000-0000-000000000002', title: 'Another case' },
    ])
    for (const station of stations) {
      expect(station.href).toBe(`/free/start?station=${station.id}`)
    }
    // And the row renders that href rather than composing its own.
    expect(PICKER).toContain('href={station.href}')
  })

  it('emphasises the first row without hiding the rest', () => {
    expect(PICKER).toContain('Most people start here')
    expect(withoutComments(PICKER)).toContain('const first = index === 0')
  })

  it('says what pressing Start actually does', () => {
    expect(PICKER).toContain('Start makes your free account, then opens that case')
  })

  it('no longer promises a verdict before anything is asked for', () => {
    // The guest lane is gone: the account comes first and the verdict follows
    // it by minutes. Leaving the old sentence up would be selling a door that
    // is not there.
    const copy = withoutComments(FREE_PAGE + PICKER)
    expect(copy).not.toContain('before we ask for anything')
    expect(copy).toContain('Your first verdict is minutes away')
  })

  it('still answers the two guest bounces older links can carry', () => {
    // Retired links and cached pages can still arrive with ?guest=limit or
    // ?guest=unavailable on them.
    expect(FREE_PAGE).toContain('guestNotice(params)')
    expect(PICKER).toContain('limit:')
    expect(PICKER).toContain('unavailable:')
  })
})

describe('/free asks for nothing', () => {
  it('carries no form of its own', () => {
    for (const file of [FREE_PAGE, PICKER]) {
      expect(file).not.toContain('FreeSignUpBox')
      expect(file).not.toContain('<input')
    }
  })

  it('never says sign up', () => {
    for (const file of [FREE_PAGE, PICKER]) {
      expect(withoutComments(file).toLowerCase()).not.toMatch(/sign[ -]up/)
    }
  })

  it('says "no card" once, in the pill, and nowhere else', () => {
    const copy = withoutComments(FREE_PAGE + PICKER).toLowerCase()
    expect(copy.match(/no card/g) ?? []).toHaveLength(1)
    expect(PICKER).toContain('<Pill>Five free stations · no card</Pill>')
  })

  it('sends somebody who already has an address to the form instead', () => {
    expect(FREE_PAGE).toContain('openDashboardHref(params)')
    expect(FREE_PAGE).toContain('redirect(handoff)')
    expect(PICKER).toContain('href="/free/open"')
  })
})

describe('/free/open is the form', () => {
  it('renders it, with the prefill from the query', () => {
    expect(OPEN_PAGE).toContain('openPrefill(await searchParams)')
    expect(OPEN_PAGE).toContain('<FreeOpen initialEmail={email} codeAlreadySent={codeAlreadySent} />')
    expect(OPEN_VIEW).toContain(
      '<FreeSignUpBox initialEmail={initialEmail} codeAlreadySent={codeAlreadySent} />',
    )
  })

  it('says what it is and what it will do', () => {
    expect(OPEN_VIEW).toContain('Open your dashboard')
    expect(OPEN_VIEW).toContain('Enter the email you used and we will send a 6-digit code.')
  })

  it('offers the picker to somebody who has not started', () => {
    expect(OPEN_VIEW).toContain('href="/free"')
  })
})
