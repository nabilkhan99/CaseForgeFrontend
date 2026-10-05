import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { guideArticles } from '@/lib/guides/articles'

/**
 * The public library's size in reader-facing copy.
 *
 * The free library said "79" long after it had grown to 200 cases. Where the
 * code can see the live list (the /sca-cases title and description, the "part
 * of a free library of N" line on every case page) the copy prints the live
 * count; static guide copy says 200, the size the bank is held at.
 *
 * Source assertions, as elsewhere in this repo: vitest runs in `node` with no
 * DOM to render pages into.
 */

const read = (path: string) => readFileSync(fileURLToPath(new URL(`../../${path}`, import.meta.url)), 'utf8')

const STATIC_COPY = [
  'app/guides/page.tsx',
  'app/guides/[slug]/page.tsx',
  'components/guides/GuideTimeline.tsx',
  'lib/guides/scaPillarGuide.ts',
]

/** A number of cases/stations, written as "79 SCA practice cases", "library of 79", "79 cases" and the like. */
const STALE_COUNT = /\b79\b(?=[^.]{0,40}\b(cases|stations)\b)|\b(library|has|of|contains)\s+79\b/i

describe('no copy still claims the library has 79 cases', () => {
  it.each(STATIC_COPY)('%s', (path) => {
    expect(read(path)).not.toMatch(STALE_COUNT)
  })

  it('in any guide article', () => {
    for (const article of guideArticles) {
      expect(JSON.stringify(article), article.slug).not.toMatch(STALE_COUNT)
    }
  })

  it('on /sca-cases or a case page', () => {
    expect(read('app/sca-cases/page.tsx')).not.toMatch(/\b79\b/)
    expect(read('components/cases/CaseDetailPageClient.tsx')).not.toMatch(STALE_COUNT)
  })
})

describe('copy that can see the live list prints its real size', () => {
  it('/sca-cases builds its title and description from the live count', () => {
    const page = read('app/sca-cases/page.tsx')
    expect(page).toContain('export async function generateMetadata')
    expect(page).toContain('publicLibrarySize((await getPublicCasesForList()).length)')
    expect(page).toContain('${count} RCGP Curriculum Cases')
    expect(page).toContain('${count} free SCA practice cases')
  })

  it('a case page is handed the live count and prints it', () => {
    expect(read('app/sca-cases/[slug]/page.tsx')).toContain('libraryCaseCount={await getLiveCaseCount()}')
    expect(read('components/cases/CaseDetailPageClient.tsx')).toContain(
      'part of a free library of {publicLibrarySize(libraryCaseCount)} SCA practice cases',
    )
  })

  it('static guide copy says 200', () => {
    expect(read('lib/guides/scaPillarGuide.ts')).toContain('our case library has 200 SCA practice cases')
    expect(read('components/guides/GuideTimeline.tsx')).toContain('200 practice cases with marking schemes')
  })
})
