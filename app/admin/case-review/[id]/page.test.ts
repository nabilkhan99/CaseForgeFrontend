import * as React from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createFakeSupabase, type FakeSupabase } from '@/lib/testing/fakeSupabase'

/**
 * /admin/case-review/[id], run for real against an in-memory service-role
 * client: lib/cases/publicCases.ts, the case review queries and the admin
 * gate are the real code. Stubbed: the session (lib/supabase/server), Next's
 * navigation throws, and the two client components, which only receive props.
 *
 *  - The gate runs before anything is read: signed out goes to sign-in,
 *    anyone not on ADMIN_EMAILS gets a 404.
 *  - A draft (hidden from the public read) renders, as do the old case it
 *    replaces whether that is live or archived.
 *  - What reaches the page component is exactly what /sca-cases/[slug] hands
 *    CaseDetailPageClient for the same case.
 */

// vitest compiles the page's JSX with the classic runtime (tsconfig keeps JSX
// for Next), which expects a global React.
vi.stubGlobal('React', React)

const mocks = vi.hoisted(() => ({
  getSupabaseAdmin: vi.fn(),
  user: null as { email: string } | null,
}))

vi.mock('@/lib/supabase/admin', () => ({ getSupabaseAdmin: () => mocks.getSupabaseAdmin() }))
vi.mock('@/lib/supabase/server', () => ({
  createClient: async () => ({ auth: { getUser: async () => ({ data: { user: mocks.user } }) } }),
}))
vi.mock('next/navigation', () => ({
  notFound: () => {
    throw new Error('NEXT_NOT_FOUND')
  },
  redirect: (to: string) => {
    throw new Error(`NEXT_REDIRECT ${to}`)
  },
  permanentRedirect: (to: string) => {
    throw new Error(`NEXT_REDIRECT 308 ${to}`)
  },
}))
vi.mock('@/components/admin/case-review/CaseReviewPreview', () => ({ default: function CaseReviewPreview() { return null } }))
vi.mock('@/components/cases/CaseDetailPageClient', () => ({ default: function CaseDetailPageClient() { return null } }))

const reviewPage = await import('./page')
const publicPage = await import('../../../sca-cases/[slug]/page')
const { default: CaseReviewPreview } = await import('@/components/admin/case-review/CaseReviewPreview')
const { default: CaseDetailPageClient } = await import('@/components/cases/CaseDetailPageClient')

const ADMIN = 'ishaq@example.org'
const DOMAIN = { id: 'dom-1', name: 'Dermatology', description: null }

const DRAFT_ID = '4101a48e-0f7a-4790-b370-d06a4fa3a87b'
const OLD_ID = '11111111-1111-4111-8111-111111111111'
const LIVE_ID = '22222222-2222-4222-8222-222222222222'
const LONE_DRAFT_ID = '33333333-3333-4333-8333-333333333333'

function station(over: Record<string, unknown>) {
  return {
    patient_name: 'Sam Patel',
    patient_age: 24,
    consultation_type: 'face_to_face',
    consultation_duration_seconds: 720,
    candidate_instructions: '**Situation:** Itchy skin.',
    station_script: 'You are Sam.',
    data_gathering: '| a | b |',
    clinical_management: '| c | d |',
    relating_to_others: '| e | f |',
    clinical_learning_points: 'Emollients first.',
    is_free_trial: false,
    seo_description: null,
    domain_id: DOMAIN.id,
    lifecycle: 'live',
    is_active: true,
    replaces_station_id: null,
    approved_at: null,
    approved_by: null,
    mark_scheme_structured: null,
    ...over,
  }
}

const CHECKLIST = {
  domains: [
    { domain: 'data_gathering', indicators: [1, 2, 3] },
    { domain: 'clinical_management', indicators: [1, 2] },
    { domain: 'relating_to_others', indicators: [1] },
  ],
}

let fake: FakeSupabase

function seed(oldLifecycle: 'live' | 'archived') {
  fake = createFakeSupabase({
    domains: [DOMAIN],
    case_keepers: [{ station_id: OLD_ID }, { station_id: OLD_ID }],
    stations: [
      station({ id: LIVE_ID, title: 'Patient with gout' }),
      station({ id: OLD_ID, title: 'Patient with eczema', lifecycle: oldLifecycle, is_active: oldLifecycle === 'live' }),
      station({
        id: DRAFT_ID,
        title: 'Young man with worsening eczema',
        lifecycle: 'draft',
        is_active: false,
        replaces_station_id: OLD_ID,
        seo_description: 'A young man whose eczema is back.',
        mark_scheme_structured: CHECKLIST,
      }),
      station({ id: LONE_DRAFT_ID, title: 'Patient with acne', lifecycle: 'draft', is_active: false }),
    ],
  })
  mocks.getSupabaseAdmin.mockReturnValue(fake)
}

type PreviewElement = { type: unknown; props: Record<string, any> } // eslint-disable-line @typescript-eslint/no-explicit-any

async function render(id: string): Promise<PreviewElement | string> {
  try {
    return (await reviewPage.default({ params: Promise.resolve({ id }) })) as unknown as PreviewElement
  } catch (error: unknown) {
    return (error as Error).message
  }
}

async function renderPreview(id: string): Promise<PreviewElement> {
  const result = await render(id)
  if (typeof result === 'string') throw new Error(`expected the page, got ${result}`)
  expect(result.type).toBe(CaseReviewPreview)
  return result
}

beforeEach(() => {
  vi.stubEnv('ADMIN_EMAILS', `someone@example.org, ${ADMIN.toUpperCase()}`)
  mocks.user = { email: ADMIN }
  mocks.getSupabaseAdmin.mockReset()
  seed('live')
})

describe('the admin gate', () => {
  it('sends a signed-out visitor to sign in, before any case is read', async () => {
    mocks.user = null
    expect(await render(DRAFT_ID)).toBe(
      `NEXT_REDIRECT /auth/sign-in?redirect=${encodeURIComponent(`/admin/case-review/${DRAFT_ID}`)}`,
    )
    expect(mocks.getSupabaseAdmin).not.toHaveBeenCalled()
  })

  it('404s a signed-in non-admin, before any case is read', async () => {
    mocks.user = { email: 'trainee@example.org' }
    expect(await render(DRAFT_ID)).toBe('NEXT_NOT_FOUND')
    expect(mocks.getSupabaseAdmin).not.toHaveBeenCalled()
  })

  it('404s everyone when ADMIN_EMAILS is unset', async () => {
    vi.stubEnv('ADMIN_EMAILS', '')
    expect(await render(DRAFT_ID)).toBe('NEXT_NOT_FOUND')
    expect(mocks.getSupabaseAdmin).not.toHaveBeenCalled()
  })
})

describe('what an admin sees', () => {
  it('renders a draft the public read cannot see', async () => {
    const { props } = await renderPreview(DRAFT_ID)
    expect(props.draft).toMatchObject({
      id: DRAFT_ID,
      title: 'Young man with worsening eczema',
      condition: 'Worsening Eczema',
      domain_name: 'Dermatology',
      candidate_instructions: '**Situation:** Itchy skin.',
      station_script: 'You are Sam.',
      clinical_learning_points: 'Emollients first.',
      seo_description: 'A young man whose eczema is back.',
    })
    expect(props.meta).toEqual({
      id: DRAFT_ID,
      approvedAt: null,
      approvedBy: null,
      replacesStationId: OLD_ID,
      replaces: { id: OLD_ID, title: 'Patient with eczema', lifecycle: 'live', keeperCount: 2 },
      checklist: { data_gathering: 3, clinical_management: 2, relating_to_others: 1 },
    })
  })

  it('carries the live library size for the footer line, as the public page does', async () => {
    const { props } = await renderPreview(DRAFT_ID)
    expect(props.libraryCaseCount).toBe(2)
  })

  it('loads the old case it replaces when that case is still live', async () => {
    const { props } = await renderPreview(DRAFT_ID)
    expect(props.old).toMatchObject({ id: OLD_ID, title: 'Patient with eczema', condition: 'Eczema', domain_name: 'Dermatology' })
  })

  it('loads the old case it replaces when that case is archived', async () => {
    seed('archived')
    const { props } = await renderPreview(DRAFT_ID)
    expect(props.old).toMatchObject({ id: OLD_ID, condition: 'Eczema' })
    expect(props.meta.replaces).toMatchObject({ lifecycle: 'archived' })
  })

  it('has no old case to show for a draft that replaces nothing', async () => {
    const { props } = await renderPreview(LONE_DRAFT_ID)
    expect(props.old).toBeNull()
    expect(props.meta).toMatchObject({ replacesStationId: null, replaces: null, checklist: null })
  })

  it('hands the page component exactly what the public case page hands it', async () => {
    const { props } = await renderPreview(DRAFT_ID)
    const publicTree = (await publicPage.default({ params: Promise.resolve({ slug: 'eczema' }) })) as unknown as {
      props: { children: PreviewElement[] }
    }
    const publicCasePage = publicTree.props.children.find((child) => child.type === CaseDetailPageClient)
    expect(publicCasePage?.props.caseData).toMatchObject({ id: OLD_ID })
    expect(props.old).toEqual(publicCasePage?.props.caseData)
  })
})

describe('what is not reviewed here', () => {
  it('404s a live case, an archived case, an unknown id and junk', async () => {
    seed('archived')
    for (const id of [LIVE_ID, OLD_ID, '99999999-9999-4999-8999-999999999999', 'not-a-uuid']) {
      expect(await render(id)).toBe('NEXT_NOT_FOUND')
    }
  })

  it('reads nothing for a malformed id', async () => {
    expect(await render('not-a-uuid')).toBe('NEXT_NOT_FOUND')
    expect(fake.calls).toHaveLength(0)
  })

  it('errors, rather than 404s, when the draft read fails', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    fake.failOn.stations = { message: 'down' }
    expect(await render(DRAFT_ID)).toContain('draft read failed')
  })

  it('is never indexed', () => {
    expect(reviewPage.metadata.robots).toEqual({ index: false, follow: false })
    expect(reviewPage.dynamic).toBe('force-dynamic')
  })
})
