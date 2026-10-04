import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

/**
 * The PCCS group inside "Further reading", checked against source.
 *
 * There is no DOM test runner in this project (vitest runs in `node`), so the
 * group cannot be rendered. What can be pinned is what would otherwise fail
 * silently: that the links leave the referrer intact so PCCS can see where its
 * visitors came from, that the copy is honest about the member login the
 * modules sit behind, and that clicks are counted. Where the section shows is
 * FurtherReading.test.ts; which case gets which module is
 * lib/partners/pccsAcademy.test.ts.
 */

function source(relativePath: string): string {
  return readFileSync(fileURLToPath(new URL(relativePath, import.meta.url)), 'utf8')
}

/** Comments discuss the rules; only the code and copy are bound by them. */
function withoutComments(code: string): string {
  return code.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/^\s*\/\/.*$/gm, ' ')
}

const GROUP = withoutComments(source('./PccsReadingGroup.tsx'))

describe('the PCCS group', () => {
  it('lists the modules it is handed', () => {
    expect(GROUP).toContain("from '@/lib/partners/pccsAcademy'")
    expect(GROUP).toMatch(/modules\.map\(/)
  })

  it('opens PCCS in a new tab and lets the referrer through', () => {
    // `noreferrer` would hide fourteenfisherman.com from PCCS's analytics, and
    // being able to see the visitors we send is half the point for them.
    expect(GROUP).toContain('target="_blank"')
    expect(GROUP).toContain('rel="noopener"')
    expect(GROUP).not.toContain('noreferrer')
  })

  it('says plainly that the modules need a free PCCS account', () => {
    expect(GROUP).toContain('Free for practising healthcare professionals')
    expect(GROUP).toContain('PCCS account')
    expect(GROUP).toContain('PCCS_JOIN_URL')
  })

  it('counts the clicks, by module and by surface', () => {
    expect(GROUP).toContain("trackEvent('pccs_module_clicked'")
    expect(GROUP).toMatch(/module: module\.key/)
    expect(GROUP).toMatch(/surface/)
  })

  it('keeps em dashes out of the copy', () => {
    expect(GROUP).not.toContain('—')
  })
})
