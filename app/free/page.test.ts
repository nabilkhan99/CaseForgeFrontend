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
const EXAMPLE = source('../../components/free/ExampleReport.tsx')

describe('/free lists the five cases', () => {
  it('resolves them on the server, from the free-trial flag in order', () => {
    // `listFreeStations` is the module that filters on `is_free_trial` and
    // orders by `free_trial_order` — see lib/trial/freeStationPicks.test.ts.
    expect(FREE_PAGE).toContain("from '@/lib/trial/freeStationPicks'")
    expect(FREE_PAGE).toContain('listFreeStations(getSupabaseAdmin())')
    expect(FREE_PAGE).toContain('<FreePicker stations={stations}')
  })

  it('links every Start straight into a consultation on that case', () => {
    const stations = toPickerStations([
      { id: 'aaaaaaaa-0000-0000-0000-000000000001', title: 'A case' },
      { id: 'bbbbbbbb-0000-0000-0000-000000000002', title: 'Another case' },
    ])
    for (const station of stations) {
      expect(station.href).toBe(`/try/talk?station=${station.id}`)
    }
    // And the row renders that href rather than composing its own.
    expect(PICKER).toContain('href={station.href}')
  })

  it('reaches that door with a plain anchor, never a prefetching Link', () => {
    // /try/talk opens a consultation as a side effect of a GET. The route
    // refuses prefetches itself, but five <Link>s in one viewport would fire
    // five refused requests on every visit to no purpose.
    const row = PICKER.slice(PICKER.indexOf('function StationRow'), PICKER.indexOf('function NoStations'))
    expect(row).toContain('<a\n          href={station.href}')
    expect(row).not.toContain('<Link')
  })

  it('emphasises the first row without hiding the rest', () => {
    expect(PICKER).toContain('Most people start here')
    expect(withoutComments(PICKER)).toContain('const first = index === 0')
  })

  it('says what pressing Start actually does', () => {
    expect(PICKER).toContain('Start opens a consultation now')
  })

  it('promises the verdict before anything is asked for, because it is', () => {
    // The guest lane is the door again: the consultation runs first and the
    // account is made afterwards, while it is being marked.
    const copy = withoutComments(FREE_PAGE + PICKER)
    expect(copy).toContain('before we ask for anything')
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
    expect(PICKER).toContain('<Pill>Five free cases · no card</Pill>')
  })

  it('sends somebody who already has an address to the form instead', () => {
    expect(FREE_PAGE).toContain('openDashboardHref(params)')
    expect(FREE_PAGE).toContain('redirect(handoff)')
    expect(PICKER).toContain('href="/free/open"')
  })
})

describe('/free counts cases, not stations', () => {
  it('titles and describes the page in the reader’s noun', () => {
    expect(FREE_PAGE).toContain("title: 'Five free SCA cases, marked | Fourteen Fisherman'")
    expect(withoutComments(FREE_PAGE)).not.toContain('free stations')
  })

  it('never counts stations at somebody who has not sat one', () => {
    // "Station" is the product's own word — the brief, the report, the
    // library. This page is read by people who know it from an exam
    // blueprint, if at all. (Identifiers keep it; `PickerStation` and
    // `StationRow` are not read by anybody but us.)
    const copy = withoutComments(FREE_PAGE + PICKER + EXAMPLE).toLowerCase()
    for (const phrase of ['free stations', 'five stations', '5 stations', 'a station', 'the station']) {
      expect(copy, phrase).not.toContain(phrase)
    }
  })

  it('says what the example is an example OF', () => {
    expect(EXAMPLE).toContain('What you get after a case, example')
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
