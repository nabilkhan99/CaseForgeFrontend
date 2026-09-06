import { describe, expect, it } from 'vitest'
import nextConfig from './next.config.js'

/**
 * The /try → /free redirect, pinned.
 *
 * `/try` is in ads, in sent emails, in the hero of every cached copy of the old
 * landing page and in people's history, so it has to move rather than 404 — and
 * it has to move WITHOUT taking its children with it. `/try/talk`,
 * `/try/session/[id]` and `/try/feedback/[id]` are the live guest funnel: a
 * `/try/:path*` source, which is the obvious way to write this, would redirect
 * somebody out of a consultation they are in the middle of and would make every
 * report link in every sent email dead.
 *
 * Nothing in the product fails visibly if that regresses — the funnel simply
 * stops, and the first evidence is a support message. So the shape of the rule
 * is asserted here rather than left to review.
 */

interface Redirect {
  source: string
  destination: string
  permanent: boolean
}

// next.config.js is CommonJS; the async factories are the public shape.
const config = nextConfig as unknown as {
  redirects: () => Promise<Redirect[]>
  rewrites: () => Promise<{ source: string; destination: string }[]>
}

/** Next's own matcher semantics, for the paths this test cares about. */
function matches(source: string, path: string): boolean {
  if (source.includes(':')) {
    // `:param` matches one segment; `:param*` matches the rest of the path.
    const pattern = source.replace(/:[A-Za-z]+\*/g, '.*').replace(/:[A-Za-z]+/g, '[^/]+')
    return new RegExp(`^${pattern}$`).test(path)
  }
  return source === path
}

describe('/try', () => {
  it('permanently redirects to /free', async () => {
    const redirects = await config.redirects()
    expect(redirects).toContainEqual({
      source: '/try',
      destination: '/free',
      permanent: true,
    })
  })

  it.each([
    '/try/talk',
    '/try/talk/',
    '/try/feedback/2b0d9a5e-0000-4000-8000-000000000000',
    '/try/session/2b0d9a5e-0000-4000-8000-000000000000',
    '/try/station/2b0d9a5e-0000-4000-8000-000000000000',
  ])('leaves %s alone — it is the live guest funnel', async (path) => {
    const redirects = await config.redirects()
    const hit = redirects.find((rule) => matches(rule.source, path))
    expect(hit, `${path} must not be redirected`).toBeUndefined()
  })

  it('carries no query of its own, so Next forwards the caller’s', async () => {
    // Next appends the incoming query string to any destination that does not
    // name one — which is how ?ref= and every utm tag survive the hop. A
    // destination with its own query would silently drop them.
    const redirects = await config.redirects()
    const rule = redirects.find((item) => item.source === '/try')
    expect(rule?.destination).not.toContain('?')
  })
})

describe('the rest of the redirect table still stands', () => {
  it.each([
    ['/dashboard/history', '/dashboard/development'],
    ['/dashboard/trend', '/dashboard/development'],
    ['/sca-cases/examination-expected', '/sca-cases/remote-triage-acute-headache'],
  ])('%s → %s', async (source, destination) => {
    const redirects = await config.redirects()
    expect(redirects).toContainEqual({ source, destination, permanent: true })
  })
})

describe('the azure rewrite allowlist', () => {
  it('is untouched by the trial work', async () => {
    // It is an explicit allowlist, not a wildcard: an unlisted path falls
    // through to Next's own /api routes and 404s. Nothing in the five-station
    // build proxies to Azure, so nothing here should have moved.
    const rewrites = await config.rewrites()
    const azure = rewrites.filter((rule) => rule.destination.includes('azurewebsites.net'))
    expect(azure.map((rule) => rule.source).sort()).toEqual([
      '/api/capabilities',
      '/api/generate-review',
      '/api/improve-review',
      '/api/improve-section',
      '/api/portfolio-playground/generate-review',
      '/api/portfolio-playground/prompt',
      '/api/select-capabilities',
      '/api/select-experience-groups',
    ])
  })
})
