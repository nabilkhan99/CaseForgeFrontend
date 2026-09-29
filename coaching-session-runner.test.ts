import { createHash } from 'node:crypto'
import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it, vi } from 'vitest'
import nextConfig from './next.config.js'
import { config as middlewareConfig } from './middleware'

/**
 * The coaching station runners, pinned.
 *
 * A tutor opens /coaching-session/mock-<N> in Chrome and shares the tab with
 * the student in a Google Meet coaching session. Each batch is a finished,
 * self-contained HTML file served untouched from public/coaching-session/, so
 * it gets no site chrome, no analytics and no login. It must stay out of
 * search, and a signed-in tutor must never be bounced off it by the auth
 * middleware. None of that fails visibly: the first evidence would be a tutor
 * mid-session or a runner in Google. So it is asserted here.
 */

const RUNNER_DIR = join(__dirname, 'public', 'coaching-session')
const ROBOTS_META = '<meta name="robots" content="noindex, nofollow">'

// sha256 of ~/Downloads/station-runner-batch-1.html, the runner exactly as
// it was handed over. mock-1.html is that file plus the one robots line.
const BATCH_1_SOURCE_SHA256 = 'e62faa736384191de2a1f2c80637f288a7ff2b7b80b2c7acdbd36ae2017ef866'

// next.config.js is CommonJS; the async factory is the public shape.
const config = nextConfig as unknown as {
  rewrites: () => Promise<{ source: string; destination: string }[]>
}

// The sitemap's case list comes from Supabase. It only ever yields
// /sca-cases/<slug> paths, so an empty list keeps this test offline without
// hiding anything that could put a runner in the sitemap.
vi.mock('@/lib/cases/publicCases', () => ({
  getPublicCasesForList: async () => [],
}))

describe('the /coaching-session/mock-<N> rewrite', () => {
  it('maps every batch to its static file', async () => {
    const rewrites = await config.rewrites()
    expect(rewrites).toContainEqual({
      source: '/coaching-session/:mock(mock-\\d+)',
      destination: '/coaching-session/:mock.html',
    })
  })
})

describe('the runner files in public/coaching-session', () => {
  const files = readdirSync(RUNNER_DIR)

  it('include batch 1', () => {
    expect(files).toContain('mock-1.html')
  })

  it.each(files)('%s is named mock-<N>.html and carries the robots noindex', (file) => {
    // Anything else in the folder would be served at its raw /…html path with
    // no rewrite to name it, and no guarantee it is kept out of search.
    expect(file).toMatch(/^mock-\d+\.html$/)
    expect(readFileSync(join(RUNNER_DIR, file), 'utf8')).toContain(ROBOTS_META)
  })
})

describe('mock-1.html', () => {
  it('is the handed-over runner plus the one robots line, byte for byte', () => {
    const served = readFileSync(join(RUNNER_DIR, 'mock-1.html'))
    const lines = served.toString('utf8').split('\n')

    // The robots line sits directly after the viewport meta, exactly once.
    expect(lines[4]).toMatch(/^<meta name="viewport" /)
    expect(lines[5]).toBe(ROBOTS_META)
    expect(lines.filter((line) => line === ROBOTS_META)).toHaveLength(1)

    const withoutRobots = Buffer.from(
      [...lines.slice(0, 5), ...lines.slice(6)].join('\n'),
      'utf8',
    )
    const sha256 = createHash('sha256').update(withoutRobots).digest('hex')
    expect(sha256).toBe(BATCH_1_SOURCE_SHA256)
  })
})

describe('the middleware matcher', () => {
  const matcher = new RegExp('^' + middlewareConfig.matcher[0] + '$')

  it.each(['/coaching-session/mock-1', '/coaching-session/mock-12'])(
    'skips %s, so a signed-in tutor is never redirected off the runner',
    (path) => {
      expect(matcher.test(path)).toBe(false)
    },
  )

  it.each(['/coaching-session', '/dashboard', '/clinical-master/station/x'])(
    'still runs on %s',
    (path) => {
      expect(matcher.test(path)).toBe(true)
    },
  )
})

describe('the sitemap', () => {
  it('never lists a coaching runner', async () => {
    const { default: sitemap } = await import('./app/sitemap')
    const urls = (await sitemap()).map((entry) => entry.url)
    // Guard against a vacuous pass: the booking page itself is listed.
    expect(urls).toContain('https://www.fourteenfisherman.com/coaching-session')
    expect(urls.filter((url) => url.includes('/coaching-session/mock'))).toEqual([])
  })
})
