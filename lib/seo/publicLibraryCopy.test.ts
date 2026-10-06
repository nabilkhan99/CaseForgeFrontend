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

/**
 * The /sca-cases share image is a fixed PNG, so it prints no count at all: it
 * said "79 free SCA stations" long after the bank grew. Its alt text describes
 * what the image shows and is count-free too, and the declared size is the file's.
 */
describe('the /sca-cases share image', () => {
  const page = read('app/sca-cases/page.tsx')
  const start = page.indexOf('image: {')
  const imageBlock = page.slice(start, page.indexOf('}', start))

  it('points at the PNG with alt text that describes it and prints no number', () => {
    expect(imageBlock).toContain("url: '/og/sca-cases.png'")
    const alt = imageBlock.match(/alt:\s*'([^']+)'/)?.[1]
    expect(alt).toBe(
      'Free SCA practice cases built from the RCGP curriculum: candidate brief, patient script, marking scheme and learning points',
    )
    expect(alt).not.toMatch(/\d/)
  })

  it('declares the PNG at its real pixel size', () => {
    const png = readFileSync(fileURLToPath(new URL('../../public/og/sca-cases.png', import.meta.url)))
    // PNG IHDR: width and height are big-endian uint32s at byte offsets 16 and 20.
    expect(imageBlock).toContain(`width: ${png.readUInt32BE(16)},`)
    expect(imageBlock).toContain(`height: ${png.readUInt32BE(20)},`)
  })
})
