import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

/**
 * Content ops for the course. Two properties matter beyond the admin guard:
 * publishing a lecture with no video would list a row students cannot play, and
 * every field a human can get wrong has to be fixable from here — the whole
 * point of the page is that a typo does not need service-role DB access.
 */

const isAdmin = vi.fn()
const getSupabaseAdmin = vi.fn()

vi.mock('@/lib/admin/guard', () => ({
  isAdmin: () => isAdmin(),
}))
vi.mock('@/lib/supabase/admin', () => ({
  getSupabaseAdmin: () => getSupabaseAdmin(),
}))

const { GET, POST, PATCH } = await import('./route')

const LECTURE_ID = '11111111-2222-3333-4444-555555555555'

const ROW = {
  id: LECTURE_ID,
  title: 'Opening the consultation',
  description: 'How the first ninety seconds decide the mark.',
  sort_order: 1,
  duration_seconds: 1800,
  is_published: false,
  storage_path: null as string | null,
  created_at: '2026-08-21T00:00:00Z',
}

function req(body: unknown, method = 'POST'): NextRequest {
  return new NextRequest('http://localhost/api/admin/lectures', {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
}

interface StubOptions {
  rows?: unknown
  listError?: { message: string } | null
  existing?: { id: string; storage_path: string | null } | null
  returned?: unknown
}

function stubAdmin({
  rows = [ROW],
  listError = null,
  existing = { id: LECTURE_ID, storage_path: null },
  returned = ROW,
}: StubOptions = {}) {
  const limit = vi.fn().mockResolvedValue({ data: rows, error: listError })
  const order = vi.fn(() => ({ limit }))
  const maybeSingle = vi.fn().mockResolvedValue({ data: existing, error: null })
  const insertSingle = vi.fn().mockResolvedValue({ data: returned, error: null })
  const updateSingle = vi.fn().mockResolvedValue({ data: returned, error: null })

  // Typed through the generic rather than an unused parameter: the patch shapes
  // are asserted on, and an untyped stub makes `update.mock.calls[0][0]` never.
  type Row = Record<string, unknown>
  const insert = vi
    .fn<(row: Row) => { select: () => { single: typeof insertSingle } }>()
    .mockImplementation(() => ({ select: () => ({ single: insertSingle }) }))
  const update = vi
    .fn<(patch: Row) => { eq: () => { select: () => { single: typeof updateSingle } } }>()
    .mockImplementation(() => ({ eq: () => ({ select: () => ({ single: updateSingle }) }) }))
  const select = vi.fn(() => ({ order, eq: vi.fn(() => ({ maybeSingle })) }))

  getSupabaseAdmin.mockReturnValue({ from: vi.fn(() => ({ select, insert, update })) })

  return { limit, insert, update, select }
}

beforeEach(() => {
  vi.clearAllMocks()
  isAdmin.mockResolvedValue(true)
})

describe('GET /api/admin/lectures', () => {
  it('403s a non-admin before it touches the database', async () => {
    isAdmin.mockResolvedValue(false)
    stubAdmin()

    const res = await GET()
    expect(res.status).toBe(403)
    expect(getSupabaseAdmin).not.toHaveBeenCalled()
  })

  it('returns every lecture, drafts included, with hasVideo derived', async () => {
    stubAdmin({ rows: [ROW, { ...ROW, id: 'other', storage_path: 'videos/other.mp4' }] })

    const body = await (await GET()).json()
    expect(body.lectures).toHaveLength(2)
    expect(body.lectures[0].hasVideo).toBe(false)
    expect(body.lectures[1].hasVideo).toBe(true)
  })

  it('never leaks the storage path itself', async () => {
    stubAdmin({ rows: [{ ...ROW, storage_path: `videos/${LECTURE_ID}.mp4` }] })

    const payload = JSON.stringify(await (await GET()).json())
    expect(payload).not.toContain('storage_path')
    expect(payload).not.toContain('videos/')
  })

  it('caps the list', async () => {
    const { limit } = stubAdmin()
    await GET()
    expect(limit).toHaveBeenCalledWith(200)
  })

  it('500s rather than reporting an empty course on a query failure', async () => {
    stubAdmin({ rows: null, listError: { message: 'boom' } })
    vi.spyOn(console, 'error').mockImplementation(() => {})

    expect((await GET()).status).toBe(500)
  })
})

describe('POST /api/admin/lectures', () => {
  it('403s a non-admin before parsing the body', async () => {
    isAdmin.mockResolvedValue(false)
    stubAdmin()

    const res = await POST(req({ title: 'x' }))
    expect(res.status).toBe(403)
    expect(getSupabaseAdmin).not.toHaveBeenCalled()
  })

  it('creates an unpublished placeholder with no video', async () => {
    const { insert } = stubAdmin()

    const res = await POST(req({ title: '  Opening the consultation  ', sortOrder: 1 }))
    expect(res.status).toBe(201)
    expect(insert).toHaveBeenCalledWith(
      expect.objectContaining({ title: 'Opening the consultation', sort_order: 1 }),
    )
    expect((await res.json()).lecture.isPublished).toBe(false)
  })

  it('refuses a blank or oversized title', async () => {
    stubAdmin()
    for (const title of ['', '   ', 'x'.repeat(201)]) {
      expect((await POST(req({ title }))).status).toBe(400)
    }
  })

  it('refuses a fractional sort order', async () => {
    stubAdmin()
    expect((await POST(req({ title: 'A lecture', sortOrder: 1.5 }))).status).toBe(400)
  })
})

describe('PATCH /api/admin/lectures', () => {
  it('403s a non-admin before parsing the body', async () => {
    isAdmin.mockResolvedValue(false)
    stubAdmin()

    const res = await PATCH(req({ id: LECTURE_ID, isPublished: true }, 'PATCH'))
    expect(res.status).toBe(403)
    expect(getSupabaseAdmin).not.toHaveBeenCalled()
  })

  it('409s publishing a lecture with no video', async () => {
    const { update } = stubAdmin({ existing: { id: LECTURE_ID, storage_path: null } })

    const res = await PATCH(req({ id: LECTURE_ID, isPublished: true }, 'PATCH'))
    expect(res.status).toBe(409)
    expect(await res.json()).toMatchObject({ error: 'Upload a video before publishing' })
    expect(update).not.toHaveBeenCalled()
  })

  it('publishes once a video is stamped', async () => {
    const { update } = stubAdmin({
      existing: { id: LECTURE_ID, storage_path: `videos/${LECTURE_ID}.mp4` },
      returned: { ...ROW, is_published: true, storage_path: `videos/${LECTURE_ID}.mp4` },
    })

    const res = await PATCH(req({ id: LECTURE_ID, isPublished: true }, 'PATCH'))
    expect(res.status).toBe(200)
    expect(update).toHaveBeenCalledWith(expect.objectContaining({ is_published: true }))
  })

  it('unpublishing is never blocked by the video check', async () => {
    const { update } = stubAdmin({ existing: { id: LECTURE_ID, storage_path: null } })

    const res = await PATCH(req({ id: LECTURE_ID, isPublished: false }, 'PATCH'))
    expect(res.status).toBe(200)
    expect(update).toHaveBeenCalledWith(expect.objectContaining({ is_published: false }))
  })

  it('edits title, description and running order', async () => {
    const { update } = stubAdmin()

    const res = await PATCH(
      req(
        { id: LECTURE_ID, title: '  Corrected title  ', description: '  New blurb  ', sortOrder: 4 },
        'PATCH',
      ),
    )
    expect(res.status).toBe(200)
    expect(update).toHaveBeenCalledWith(
      expect.objectContaining({
        title: 'Corrected title',
        description: 'New blurb',
        sort_order: 4,
      }),
    )
  })

  it('changes only the fields it was given', async () => {
    const { update } = stubAdmin()

    await PATCH(req({ id: LECTURE_ID, sortOrder: 9 }, 'PATCH'))
    expect(Object.keys(update.mock.calls[0][0]).sort()).toEqual(['sort_order', 'updated_at'])
  })

  it('clears a description with null or an empty string', async () => {
    const { update } = stubAdmin()

    await PATCH(req({ id: LECTURE_ID, description: null }, 'PATCH'))
    expect(update).toHaveBeenNthCalledWith(1, expect.objectContaining({ description: null }))

    await PATCH(req({ id: LECTURE_ID, description: '   ' }, 'PATCH'))
    expect(update).toHaveBeenNthCalledWith(2, expect.objectContaining({ description: null }))
  })

  it('refuses an empty patch rather than reporting a no-op as saved', async () => {
    const { update } = stubAdmin()

    expect((await PATCH(req({ id: LECTURE_ID }, 'PATCH'))).status).toBe(400)
    expect(update).not.toHaveBeenCalled()
  })

  it('refuses a blank title, a non-boolean isPublished and a fractional order', async () => {
    stubAdmin()
    const bad = [
      { id: LECTURE_ID, title: '   ' },
      { id: LECTURE_ID, isPublished: 'yes' },
      { id: LECTURE_ID, sortOrder: 2.5 },
      { id: '', title: 'A lecture' },
    ]
    for (const body of bad) {
      expect((await PATCH(req(body, 'PATCH'))).status).toBe(400)
    }
  })

  it('404s an unknown lecture', async () => {
    stubAdmin({ existing: null })
    expect((await PATCH(req({ id: LECTURE_ID, title: 'x' }, 'PATCH'))).status).toBe(404)
  })
})
