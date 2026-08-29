import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { Entitlement } from '@/lib/commerce/entitlements'

/**
 * The lecture list is the only surface that decides, for a whole tier, whether
 * the paid course is visible. These pin the branch table: who gets the content,
 * who gets the tease, and that the tease never leaks more than a title.
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

const ROWS = [
  {
    id: 'aaaaaaaa-0000-0000-0000-000000000001',
    title: 'Opening the consultation',
    description: 'How the first ninety seconds decide the mark.',
    sort_order: 1,
    duration_seconds: 1800,
  },
  {
    id: 'aaaaaaaa-0000-0000-0000-000000000002',
    title: 'Shared management plans',
    description: 'Turning options into an agreed plan.',
    sort_order: 2,
    duration_seconds: 2400,
  },
]

function stubLectureTable(result: { data: unknown; error: unknown }) {
  const limit = vi.fn().mockResolvedValue(result)
  const order = vi.fn(() => ({ limit }))
  const eq = vi.fn(() => ({ order }))
  const select = vi.fn(() => ({ eq }))
  const from = vi.fn(() => ({ select }))
  getSupabaseAdmin.mockReturnValue({ from })
  return { from, select, eq, order, limit }
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
  stubLectureTable({ data: ROWS, error: null })
})

describe('GET /api/lectures', () => {
  it('401s when there is no session', async () => {
    getServerEntitlement.mockResolvedValue({
      user: null,
      entitlement: entitlement({ state: 'none' }),
      bypass: false,
      allowed: false,
      failedOpen: false,
      supabase: {},
    })

    const res = await GET()
    expect(res.status).toBe(401)
  })

  it('serves the full list to an active Complete user', async () => {
    signedIn({ entitlement: entitlement({ hasLectures: true, plan: 'complete' }) })

    const res = await GET()
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.locked).toBe(false)
    expect(body.lectures).toHaveLength(2)
    expect(body.lectures[0]).toEqual({
      id: ROWS[0].id,
      title: ROWS[0].title,
      description: ROWS[0].description,
      sortOrder: 1,
      durationSeconds: 1800,
    })
  })

  it('teases Self-Study with titles and durations — no description', async () => {
    signedIn({ entitlement: entitlement({ hasLectures: false, plan: 'self_study' }) })

    const res = await GET()
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.locked).toBe(true)
    expect(body.lectures.map((l: { title: string }) => l.title)).toEqual([
      ROWS[0].title,
      ROWS[1].title,
    ])
    for (const [i, lecture] of body.lectures.entries()) {
      expect(lecture.description).toBeNull()
      // Minutes are the pitch ("8 hours of teaching"); they leak nothing.
      expect(lecture.durationSeconds).toBe(ROWS[i].duration_seconds)
    }
  })

  it('locks a lapsed Complete user out of playback but still shows the course', async () => {
    // read_only: hasLectures is false by construction once access lapses.
    signedIn({
      entitlement: entitlement({ state: 'read_only', hasLectures: false, plan: 'complete' }),
      allowed: false,
    })

    const body = await (await GET()).json()
    expect(body.locked).toBe(true)
    // The banner branches on this: renew, not upgrade to what they already own.
    expect(body.state).toBe('read_only')
    expect(body.unavailable).toBe(false)
  })

  it('reports state so the lock copy can tell upgrade from renew', async () => {
    signedIn({ entitlement: entitlement({ state: 'active', plan: 'self_study' }) })
    expect((await (await GET()).json()).state).toBe('active')

    signedIn({ entitlement: entitlement({ state: 'none' }), allowed: false })
    expect((await (await GET()).json()).state).toBe('none')
  })

  it('fails CLOSED when the entitlement lookup degraded, even though it granted', async () => {
    // getServerEntitlement fails open so a DB blip cannot stop practice. A
    // signed URL outlives the blip, so lectures must not follow it open.
    signedIn({
      entitlement: entitlement({ state: 'none', hasLectures: false }),
      allowed: true,
      failedOpen: true,
    })

    const body = await (await GET()).json()
    expect(body.locked).toBe(true)
    expect(body.unavailable).toBe(true)
    expect(body.lectures[0].description).toBeNull()
  })

  it('fails closed on a degraded lookup even for a real Complete buyer', async () => {
    signedIn({
      entitlement: entitlement({ hasLectures: true, plan: 'complete' }),
      allowed: true,
      failedOpen: true,
    })

    expect((await (await GET()).json()).locked).toBe(true)
  })

  it('fails closed on a degraded lookup even with bypass set', async () => {
    signedIn({ bypass: true, allowed: true, failedOpen: true })

    expect((await (await GET()).json()).locked).toBe(true)
  })

  it('caps the public list the same way the admin list is capped', async () => {
    signedIn({ entitlement: entitlement({ hasLectures: true }) })
    const { limit } = stubLectureTable({ data: ROWS, error: null })

    await GET()
    expect(limit).toHaveBeenCalledWith(200)
  })

  it('unlocks a bypass viewer (staged deployment or ADMIN_EMAILS) with no purchase', async () => {
    signedIn({ entitlement: entitlement({ state: 'none' }), bypass: true, allowed: true })

    const body = await (await GET()).json()
    expect(body.locked).toBe(false)
    expect(body.lectures[0].description).toBe(ROWS[0].description)
  })

  it('never returns a storage path or a URL, locked or not', async () => {
    signedIn({ entitlement: entitlement({ hasLectures: true }) })
    const unlocked = JSON.stringify(await (await GET()).json())

    signedIn({ entitlement: entitlement({ hasLectures: false }) })
    const locked = JSON.stringify(await (await GET()).json())

    for (const payload of [unlocked, locked]) {
      expect(payload).not.toContain('storage_path')
      expect(payload).not.toContain('signedUrl')
      expect(payload).not.toContain('url')
    }
  })

  it('only ever selects published lectures', async () => {
    signedIn({ entitlement: entitlement({ hasLectures: true }) })
    const { eq } = stubLectureTable({ data: ROWS, error: null })

    await GET()
    expect(eq).toHaveBeenCalledWith('is_published', true)
  })

  it('500s rather than serving an empty course on a query failure', async () => {
    signedIn({ entitlement: entitlement({ hasLectures: true }) })
    stubLectureTable({ data: null, error: { message: 'boom' } })
    vi.spyOn(console, 'error').mockImplementation(() => {})

    const res = await GET()
    expect(res.status).toBe(500)
  })
})
