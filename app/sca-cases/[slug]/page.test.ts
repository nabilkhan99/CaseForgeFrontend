import * as React from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createFakeSupabase, type FakeSupabase } from '@/lib/testing/fakeSupabase'

/**
 * The public case addresses once cases start being replaced.
 *
 *  - A live case's slug renders its page, exactly as before.
 *  - An archived case's old slug (stations.archived_slug) forwards permanently
 *    to its live replacement's page, at the address the replacement's own page
 *    uses (slug overrides included).
 *  - An archived case with no live replacement, and a slug nobody ever had, 404.
 *  - The same for old /cases/[id] addresses.
 *
 * Runs the real pages and lib/cases/publicCases.ts against an in-memory
 * service-role client; only Next's navigation throws and the client component
 * are stubbed.
 */

// vitest compiles the page's JSX with the classic runtime (tsconfig keeps JSX
// for Next), which expects a global React.
vi.stubGlobal('React', React)

const mocks = vi.hoisted(() => ({ getSupabaseAdmin: vi.fn() }))

vi.mock('@/lib/supabase/admin', () => ({ getSupabaseAdmin: () => mocks.getSupabaseAdmin() }))
vi.mock('@/components/cases/CaseDetailPageClient', () => ({ default: () => null }))
vi.mock('next/navigation', () => ({
  notFound: () => {
    throw new Error('NEXT_NOT_FOUND')
  },
  permanentRedirect: (to: string) => {
    throw new Error(`NEXT_REDIRECT 308 ${to}`)
  },
}))

const slugPage = await import('./page')
const idPage = await import('../../cases/[id]/page')

const DOMAIN = { id: 'dom-1', name: 'Cardiovascular', description: null }

// The pre-diabetes case carries a slug override in lib/seo/cases.ts: forwarding
// must land on the overridden address, not a title-derived one.
const OVERRIDDEN_ID = '16c48616-d334-4d20-8af1-f17388f702b8'
const OVERRIDDEN_PATH = '/sca-cases/pre-diabetes-and-cardiovascular-risk-after-a-health-check'

const OLD_ID = '11111111-1111-4111-8111-111111111111'
const NEW_ID = '22222222-2222-4222-8222-222222222222'
const ORPHAN_ID = '33333333-3333-4333-8333-333333333333'
const MIDDLE_ID = '44444444-4444-4444-8444-444444444444'
const LIVE_ID = '55555555-5555-4555-8555-555555555555'

function station(over: Record<string, unknown>) {
  return {
    patient_name: 'Pat',
    patient_age: 50,
    consultation_type: 'face_to_face',
    consultation_duration_seconds: 720,
    domain_id: DOMAIN.id,
    lifecycle: 'live',
    is_active: true,
    replaces_station_id: null,
    archived_slug: null,
    seo_description: null,
    ...over,
  }
}

const archived = (over: Record<string, unknown>) => station({ lifecycle: 'archived', is_active: false, ...over })

let fake: FakeSupabase

function seed(stations: Record<string, unknown>[]) {
  fake = createFakeSupabase({ stations, domains: [DOMAIN] })
  mocks.getSupabaseAdmin.mockReturnValue(fake)
}

async function renderSlug(slug: string): Promise<string> {
  try {
    await slugPage.default({ params: Promise.resolve({ slug }) })
    return 'PAGE'
  } catch (error: unknown) {
    return (error as Error).message
  }
}

async function renderId(id: string): Promise<string> {
  try {
    await idPage.default({ params: Promise.resolve({ id }) })
    return 'PAGE'
  } catch (error: unknown) {
    return (error as Error).message
  }
}

beforeEach(() => {
  seed([
    station({ id: LIVE_ID, title: 'Patient with gout' }),
    // Old case replaced by a live one whose address is an override.
    archived({ id: OLD_ID, title: 'Patient with impaired fasting glycaemia', archived_slug: 'impaired-fasting-glycaemia' }),
    station({ id: OVERRIDDEN_ID, title: 'Pre-diabetes after a health check', replaces_station_id: OLD_ID }),
    // Archived with nothing live in its place (its replacement is a draft).
    archived({ id: ORPHAN_ID, title: 'Patient with eczema', archived_slug: 'eczema' }),
    station({ id: NEW_ID, title: 'Patient with atopic eczema', lifecycle: 'draft', is_active: false, replaces_station_id: ORPHAN_ID }),
  ])
})

describe('/sca-cases/[slug]', () => {
  it('renders a live case at its own slug, as it always has', async () => {
    expect(await renderSlug('gout')).toBe('PAGE')
  })

  it("forwards an archived case's old slug permanently to its replacement's page", async () => {
    expect(await renderSlug('impaired-fasting-glycaemia')).toBe(`NEXT_REDIRECT 308 ${OVERRIDDEN_PATH}`)
  })

  it('404s an archived case whose replacement is not live yet', async () => {
    expect(await renderSlug('eczema')).toBe('NEXT_NOT_FOUND')
  })

  it('404s a slug no case ever had', async () => {
    expect(await renderSlug('no-such-case')).toBe('NEXT_NOT_FOUND')
  })

  it('serves a live case that has taken an archived slug, rather than forwarding it', async () => {
    seed([
      station({ id: LIVE_ID, title: 'Patient with gout' }),
      archived({ id: OLD_ID, title: 'Old gout case', archived_slug: 'gout' }),
      station({ id: NEW_ID, title: 'Patient with tophaceous gout', replaces_station_id: OLD_ID }),
    ])
    expect(await renderSlug('gout')).toBe('PAGE')
  })

  it('follows a replaced replacement through to the case live today', async () => {
    seed([
      archived({ id: OLD_ID, title: 'First gout case', archived_slug: 'first-gout' }),
      archived({ id: MIDDLE_ID, title: 'Second gout case', archived_slug: 'second-gout', replaces_station_id: OLD_ID }),
      station({ id: LIVE_ID, title: 'Patient with gout', replaces_station_id: MIDDLE_ID }),
    ])
    expect(await renderSlug('first-gout')).toBe('NEXT_REDIRECT 308 /sca-cases/gout')
    expect(await renderSlug('second-gout')).toBe('NEXT_REDIRECT 308 /sca-cases/gout')
  })

  it('404s rather than erroring when the forwarding lookup fails', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    const realFrom = fake.from
    let calls = 0
    // The first stations read (the live list) succeeds; the archived lookup fails.
    fake.from = (table: string) => {
      if (table === 'stations' && ++calls === 2) fake.failOn.stations = { message: 'down' }
      return realFrom(table)
    }
    expect(await renderSlug('impaired-fasting-glycaemia')).toBe('NEXT_NOT_FOUND')
  })

  it('leaves unknown slugs able to reach the page (dynamicParams)', () => {
    expect(slugPage.dynamicParams).toBe(true)
  })

  it('pre-builds only live slugs', async () => {
    const params = await slugPage.generateStaticParams()
    expect(params.map((p) => p.slug).sort()).toEqual(
      ['gout', 'pre-diabetes-and-cardiovascular-risk-after-a-health-check'].sort(),
    )
  })
})

describe('/cases/[id]', () => {
  it("forwards a live case's id to its slug, as it always has", async () => {
    expect(await renderId(LIVE_ID)).toBe('NEXT_REDIRECT 308 /sca-cases/gout')
  })

  it("forwards an archived case's id to its replacement's page", async () => {
    expect(await renderId(OLD_ID)).toBe(`NEXT_REDIRECT 308 ${OVERRIDDEN_PATH}`)
  })

  it('404s an archived id with no live replacement, a draft id, and junk', async () => {
    expect(await renderId(ORPHAN_ID)).toBe('NEXT_NOT_FOUND')
    expect(await renderId(NEW_ID)).toBe('NEXT_NOT_FOUND')
    expect(await renderId('not-a-uuid')).toBe('NEXT_NOT_FOUND')
  })

  it('leaves unknown ids able to reach the page (dynamicParams)', () => {
    expect(idPage.dynamicParams).toBe(true)
  })
})

describe('the page description', () => {
  const describeSlug = async (slug: string) =>
    (await slugPage.generateMetadata({ params: Promise.resolve({ slug }) }))

  it('uses the hand-written seo_description in the meta, Open Graph and Twitter descriptions', async () => {
    seed([station({ id: LIVE_ID, title: 'Patient with gout', seo_description: '  A man with a hot, swollen toe.  ' })])
    const meta = await describeSlug('gout')
    expect(meta.description).toBe('A man with a hot, swollen toe.')
    expect(meta.openGraph?.description).toBe('A man with a hot, swollen toe.')
    expect(meta.twitter?.description).toBe('A man with a hot, swollen toe.')
  })

  it("falls back to today's template when there is none", async () => {
    seed([station({ id: LIVE_ID, title: 'Patient with gout' })])
    const meta = await describeSlug('gout')
    expect(meta.description).toBe(
      'Free SCA practice case covering Gout. Candidate brief, patient script, marking scheme and learning points. Built from the RCGP curriculum for GP registrar exam preparation.',
    )
  })
})
