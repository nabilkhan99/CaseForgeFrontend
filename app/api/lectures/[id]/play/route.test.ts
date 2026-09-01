import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'
import type { Entitlement } from '@/lib/commerce/entitlements'

/**
 * This is the only endpoint in the product that mints a credential against paid
 * content, and the credential outlives the request that made it: an hour of
 * unauthenticated access to the raw file, shareable by anyone holding the
 * string. So the assertion these tests actually care about is never the status
 * code — it is that `createSignedUrl` was not reached.
 */

const getServerEntitlement = vi.fn()
const getSupabaseAdmin = vi.fn()

vi.mock('@/lib/commerce/serverEntitlement', () => ({
  getServerEntitlement: () => getServerEntitlement(),
}))
vi.mock('@/lib/supabase/admin', () => ({
  getSupabaseAdmin: () => getSupabaseAdmin(),
}))

const { GET } = await import('./route')

const LECTURE_ID = '11111111-2222-3333-4444-555555555555'
const STORAGE_PATH = `videos/${LECTURE_ID}.mp4`

function call(id = LECTURE_ID) {
  return GET(new NextRequest(`http://localhost/api/lectures/${id}/play`), {
    params: Promise.resolve({ id }),
  })
}

function stubLecture(
  lecture: { id: string; storage_path: string | null; is_published: boolean } | null = {
    id: LECTURE_ID,
    storage_path: STORAGE_PATH,
    is_published: true,
  },
  lookupError: { message: string } | null = null,
) {
  const createSignedUrl = vi
    .fn()
    .mockResolvedValue({ data: { signedUrl: 'https://storage.example/signed?token=x' }, error: null })
  const maybeSingle = vi.fn().mockResolvedValue({ data: lecture, error: lookupError })

  getSupabaseAdmin.mockReturnValue({
    from: vi.fn(() => ({ select: vi.fn(() => ({ eq: vi.fn(() => ({ maybeSingle })) })) })),
    storage: { from: vi.fn(() => ({ createSignedUrl })) },
  })

  return { createSignedUrl }
}

function entitlement(overrides: Partial<Entitlement> = {}): Entitlement {
  return { state: 'active', hasLectures: false, ...overrides }
}

function signedIn(opts: {
  entitlement?: Entitlement
  bypass?: boolean
  allowed?: boolean
  failedOpen?: boolean
}) {
  getServerEntitlement.mockResolvedValue({
    user: { id: 'user-1', email: 'gp@example.com' },
    entitlement: opts.entitlement ?? entitlement(),
    bypass: opts.bypass ?? false,
    allowed: opts.allowed ?? true,
    failedOpen: opts.failedOpen ?? false,
    supabase: {},
  })
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe('GET /api/lectures/[id]/play', () => {
  it('signs a URL for an active Complete buyer', async () => {
    signedIn({ entitlement: entitlement({ hasLectures: true, plan: 'complete' }) })
    const { createSignedUrl } = stubLecture()

    const res = await call()
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.url).toContain('https://storage.example/signed')
    expect(createSignedUrl).toHaveBeenCalledWith(STORAGE_PATH, 3600)
  })

  it('signs for a bypass viewer (staged deployment or ADMIN_EMAILS)', async () => {
    signedIn({ entitlement: entitlement({ state: 'none' }), bypass: true })
    const { createSignedUrl } = stubLecture()

    expect((await call()).status).toBe(200)
    expect(createSignedUrl).toHaveBeenCalled()
  })

  it('never signs for a signed-out visitor', async () => {
    getServerEntitlement.mockResolvedValue({
      user: null,
      entitlement: entitlement({ state: 'none' }),
      bypass: false,
      allowed: false,
      failedOpen: false,
      supabase: {},
    })
    const { createSignedUrl } = stubLecture()

    expect((await call()).status).toBe(404)
    expect(createSignedUrl).not.toHaveBeenCalled()
  })

  it('never signs for Self-Study — the tier without lectures', async () => {
    signedIn({ entitlement: entitlement({ hasLectures: false, plan: 'self_study' }) })
    const { createSignedUrl } = stubLecture()

    expect((await call()).status).toBe(404)
    expect(createSignedUrl).not.toHaveBeenCalled()
  })

  it('never signs for a lapsed (read_only) Complete buyer', async () => {
    signedIn({
      entitlement: entitlement({ state: 'read_only', hasLectures: false, plan: 'complete' }),
      allowed: false,
    })
    const { createSignedUrl } = stubLecture()

    expect((await call()).status).toBe(404)
    expect(createSignedUrl).not.toHaveBeenCalled()
  })

  it('never signs when the entitlement lookup failed open', async () => {
    // The practice gate lets a DB blip through because a consultation is
    // transient. A signed URL is not: it survives the incident that made it.
    signedIn({
      entitlement: entitlement({ state: 'none' }),
      allowed: true,
      failedOpen: true,
    })
    const { createSignedUrl } = stubLecture()

    expect((await call()).status).toBe(404)
    expect(createSignedUrl).not.toHaveBeenCalled()
  })

  it('never signs when the lookup failed open for a real Complete buyer either', async () => {
    signedIn({
      entitlement: entitlement({ hasLectures: true, plan: 'complete' }),
      allowed: true,
      failedOpen: true,
    })
    const { createSignedUrl } = stubLecture()

    expect((await call()).status).toBe(404)
    expect(createSignedUrl).not.toHaveBeenCalled()
  })

  it('never signs for an unpublished lecture, even to an entitled user', async () => {
    signedIn({ entitlement: entitlement({ hasLectures: true }) })
    const { createSignedUrl } = stubLecture({
      id: LECTURE_ID,
      storage_path: STORAGE_PATH,
      is_published: false,
    })

    expect((await call()).status).toBe(404)
    expect(createSignedUrl).not.toHaveBeenCalled()
  })

  it('never signs a null storage path', async () => {
    signedIn({ entitlement: entitlement({ hasLectures: true }) })
    const { createSignedUrl } = stubLecture({
      id: LECTURE_ID,
      storage_path: null,
      is_published: true,
    })

    expect((await call()).status).toBe(404)
    expect(createSignedUrl).not.toHaveBeenCalled()
  })

  it('404s an unknown lecture with the same body as a forbidden one', async () => {
    signedIn({ entitlement: entitlement({ hasLectures: true }) })
    stubLecture(null)
    const unknown = await (await call()).json()

    signedIn({ entitlement: entitlement({ hasLectures: false }) })
    stubLecture()
    const forbidden = await (await call()).json()

    // Identical on purpose: distinguishing them is a tier oracle.
    expect(unknown).toEqual(forbidden)
  })

  it('400s a non-uuid id before any entitlement work', async () => {
    stubLecture()
    const res = await call('../../etc/passwd')
    expect(res.status).toBe(400)
    expect(getServerEntitlement).not.toHaveBeenCalled()
  })

  it('fails closed when the entitlement check throws', async () => {
    getServerEntitlement.mockRejectedValue(new Error('session unreadable'))
    const { createSignedUrl } = stubLecture()
    vi.spyOn(console, 'error').mockImplementation(() => {})

    expect((await call()).status).toBe(404)
    expect(createSignedUrl).not.toHaveBeenCalled()
  })

  it('500s rather than leaking on a lookup failure', async () => {
    signedIn({ entitlement: entitlement({ hasLectures: true }) })
    const { createSignedUrl } = stubLecture(null, { message: 'boom' })
    vi.spyOn(console, 'error').mockImplementation(() => {})

    expect((await call()).status).toBe(500)
    expect(createSignedUrl).not.toHaveBeenCalled()
  })
})
