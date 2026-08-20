import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

/**
 * The upload surface is the one place an admin action turns into a Storage
 * object key and a stamped row. These pin the three properties that keep a
 * client from choosing either: the extension whitelist, the refusal to
 * overwrite an existing video, and the path always being rebuilt server-side.
 */

const isAdmin = vi.fn()
const getSupabaseAdmin = vi.fn()

vi.mock('@/lib/admin/guard', () => ({
  isAdmin: () => isAdmin(),
}))
vi.mock('@/lib/supabase/admin', () => ({
  getSupabaseAdmin: () => getSupabaseAdmin(),
}))

const { POST, PUT, DELETE } = await import('./route')

const LECTURE_ID = '11111111-2222-3333-4444-555555555555'

function req(body: unknown, method = 'POST'): NextRequest {
  return new NextRequest('http://localhost/api/admin/lectures/upload-url', {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
}

interface StubOptions {
  lecture?: { id: string; storage_path: string | null } | null
  listed?: Array<{ name: string; metadata: { size: number } | null }>
  /** Rows the single-shot stamp claimed. Empty = another upload won the race. */
  stamped?: Array<{ id: string }>
}

function stubAdmin({
  lecture = { id: LECTURE_ID, storage_path: null },
  listed = [],
  stamped = [{ id: LECTURE_ID }],
}: StubOptions) {
  const createSignedUploadUrl = vi.fn().mockResolvedValue({
    data: { token: 'tok', signedUrl: 'https://storage.example/upload/sign/lectures/x?token=tok' },
    error: null,
  })
  const list = vi.fn().mockResolvedValue({ data: listed, error: null })
  const remove = vi.fn().mockResolvedValue({ data: [], error: null })
  const maybeSingle = vi.fn().mockResolvedValue({ data: lecture, error: null })
  // `update` serves both the conditional stamp (…eq…is…select) and the plain
  // updates DELETE makes (…eq, awaited directly), so the eq result has to be a
  // thenable that also carries `.is`.
  const update = vi.fn(() => ({
    eq: () => {
      const eqResult = Promise.resolve({ error: null }) as Promise<{ error: null }> & {
        is: () => { select: () => Promise<{ data: unknown; error: null }> }
      }
      eqResult.is = () => ({ select: () => Promise.resolve({ data: stamped, error: null }) })
      return eqResult
    },
  }))

  getSupabaseAdmin.mockReturnValue({
    from: vi.fn(() => ({
      select: vi.fn(() => ({ eq: vi.fn(() => ({ maybeSingle })) })),
      update,
    })),
    storage: { from: vi.fn(() => ({ createSignedUploadUrl, list, remove })) },
  })

  return { createSignedUploadUrl, list, update, remove }
}

beforeEach(() => {
  vi.clearAllMocks()
  isAdmin.mockResolvedValue(true)
})

describe('POST /api/admin/lectures/upload-url', () => {
  it('403s a non-admin before it looks anything up', async () => {
    isAdmin.mockResolvedValue(false)
    stubAdmin({})

    const res = await POST(req({ lectureId: LECTURE_ID, extension: 'mp4' }))
    expect(res.status).toBe(403)
    expect(getSupabaseAdmin).not.toHaveBeenCalled()
  })

  it('rejects an extension outside the whitelist', async () => {
    stubAdmin({})
    for (const extension of ['exe', 'svg', 'html', 'mkv']) {
      const res = await POST(req({ lectureId: LECTURE_ID, extension }))
      expect(res.status).toBe(415)
    }
  })

  it('rejects a lecture id that is not a uuid', async () => {
    stubAdmin({})
    const res = await POST(req({ lectureId: '../../etc/passwd', extension: 'mp4' }))
    expect(res.status).toBe(400)
  })

  it('404s an unknown lecture', async () => {
    stubAdmin({ lecture: null })
    const res = await POST(req({ lectureId: LECTURE_ID, extension: 'mp4' }))
    expect(res.status).toBe(404)
  })

  it('refuses to hand out an upload URL when a video is already stamped', async () => {
    const { createSignedUploadUrl } = stubAdmin({
      lecture: { id: LECTURE_ID, storage_path: `videos/${LECTURE_ID}.mp4` },
    })

    const res = await POST(req({ lectureId: LECTURE_ID, extension: 'mp4' }))
    expect(res.status).toBe(409)
    expect(createSignedUploadUrl).not.toHaveBeenCalled()
  })

  it('signs a path built from the lecture id, never from the client', async () => {
    const { createSignedUploadUrl } = stubAdmin({})

    const res = await POST(
      req({
        lectureId: LECTURE_ID,
        extension: 'mp4',
        // Ignored on purpose — the route has no path input at all.
        path: 'videos/../../public/pwned.mp4',
      }),
    )
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(createSignedUploadUrl).toHaveBeenCalledWith(`videos/${LECTURE_ID}.mp4`)
    expect(body.path).toBe(`videos/${LECTURE_ID}.mp4`)
  })
})

describe('PUT /api/admin/lectures/upload-url (confirm)', () => {
  const GOOD_PATH = `videos/${LECTURE_ID}.mp4`
  const BIG = { name: `${LECTURE_ID}.mp4`, metadata: { size: 40 * 1024 * 1024 } }

  it('403s a non-admin', async () => {
    isAdmin.mockResolvedValue(false)
    stubAdmin({})
    const res = await PUT(req({ lectureId: LECTURE_ID, path: GOOD_PATH }, 'PUT'))
    expect(res.status).toBe(403)
  })

  it('rejects a path that does not rebuild from the lecture id', async () => {
    const { update } = stubAdmin({ listed: [BIG] })

    for (const path of [
      'videos/00000000-0000-0000-0000-000000000000.mp4',
      `videos/${LECTURE_ID}.exe`,
      `../${LECTURE_ID}.mp4`,
      `videos/${LECTURE_ID}.mp4/../../secret`,
    ]) {
      const res = await PUT(req({ lectureId: LECTURE_ID, path }, 'PUT'))
      expect(res.status).toBe(400)
    }
    expect(update).not.toHaveBeenCalled()
  })

  it('404s when the object never landed, leaving storage_path null', async () => {
    const { update } = stubAdmin({ listed: [] })
    const res = await PUT(req({ lectureId: LECTURE_ID, path: GOOD_PATH }, 'PUT'))
    expect(res.status).toBe(404)
    expect(update).not.toHaveBeenCalled()
  })

  it('rejects an object too small to be a lecture', async () => {
    const { update } = stubAdmin({
      listed: [{ name: `${LECTURE_ID}.mp4`, metadata: { size: 2048 } }],
    })
    const res = await PUT(req({ lectureId: LECTURE_ID, path: GOOD_PATH }, 'PUT'))
    expect(res.status).toBe(400)
    expect(update).not.toHaveBeenCalled()
  })

  it('rejects a zero-byte object — the exact case the floor exists for', async () => {
    const { update } = stubAdmin({
      listed: [{ name: `${LECTURE_ID}.mp4`, metadata: { size: 0 } }],
    })
    const res = await PUT(req({ lectureId: LECTURE_ID, path: GOOD_PATH }, 'PUT'))
    expect(res.status).toBe(400)
    expect(update).not.toHaveBeenCalled()
  })

  it('rejects an object whose metadata never populated', async () => {
    const { update } = stubAdmin({ listed: [{ name: `${LECTURE_ID}.mp4`, metadata: null }] })
    const res = await PUT(req({ lectureId: LECTURE_ID, path: GOOD_PATH }, 'PUT'))
    expect(res.status).toBe(400)
    expect(update).not.toHaveBeenCalled()
  })

  it('stamps the rebuilt path once the object is confirmed', async () => {
    const { update } = stubAdmin({ listed: [BIG] })

    const res = await PUT(req({ lectureId: LECTURE_ID, path: GOOD_PATH }, 'PUT'))
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body).toMatchObject({ status: 'saved', path: GOOD_PATH })
    expect(update).toHaveBeenCalledWith(
      expect.objectContaining({ storage_path: GOOD_PATH }),
    )
  })

  it('409s the loser of a two-file race instead of reporting success', async () => {
    // Both tabs minted before either confirmed, so the conditional stamp
    // matches nothing for the second one — its file is orphaned, and saying
    // "saved" would leave an admin believing the wrong video is live.
    stubAdmin({ listed: [BIG], stamped: [] })

    const res = await PUT(req({ lectureId: LECTURE_ID, path: GOOD_PATH }, 'PUT'))
    expect(res.status).toBe(409)
    expect((await res.json()).error).toMatch(/already claimed/i)
  })

  it('stores a duration the browser measured', async () => {
    const { update } = stubAdmin({ listed: [BIG] })

    const res = await PUT(
      req({ lectureId: LECTURE_ID, path: GOOD_PATH, durationSeconds: 1834.4 }, 'PUT'),
    )
    expect(res.status).toBe(200)
    expect(update).toHaveBeenCalledWith(expect.objectContaining({ duration_seconds: 1834 }))
  })

  it('leaves duration_seconds alone when the browser could not read one', async () => {
    const { update } = stubAdmin({ listed: [BIG] })

    await PUT(req({ lectureId: LECTURE_ID, path: GOOD_PATH, durationSeconds: null }, 'PUT'))
    expect(update).toHaveBeenCalledWith(
      expect.not.objectContaining({ duration_seconds: expect.anything() }),
    )
  })

  it('refuses a duration outside a plausible lecture length', async () => {
    const { update } = stubAdmin({ listed: [BIG] })

    // NaN and Infinity are absent on purpose: JSON.stringify turns both into
    // null, which is the "browser could not read one" case, not a bad value.
    for (const durationSeconds of [0, -5, 36001, 'thirty']) {
      const res = await PUT(req({ lectureId: LECTURE_ID, path: GOOD_PATH, durationSeconds }, 'PUT'))
      expect(res.status).toBe(400)
    }
    expect(update).not.toHaveBeenCalled()
  })
})

describe('DELETE /api/admin/lectures/upload-url (replace / recover)', () => {
  it('403s a non-admin before it looks anything up', async () => {
    isAdmin.mockResolvedValue(false)
    stubAdmin({})
    const res = await DELETE(req({ lectureId: LECTURE_ID }, 'DELETE'))
    expect(res.status).toBe(403)
    expect(getSupabaseAdmin).not.toHaveBeenCalled()
  })

  it('404s an unknown lecture', async () => {
    const { remove } = stubAdmin({ lecture: null })
    const res = await DELETE(req({ lectureId: LECTURE_ID }, 'DELETE'))
    expect(res.status).toBe(404)
    expect(remove).not.toHaveBeenCalled()
  })

  it('unpublishes before the object goes, so a live lecture never points at nothing', async () => {
    const { update, remove } = stubAdmin({
      lecture: { id: LECTURE_ID, storage_path: `videos/${LECTURE_ID}.mp4` },
    })

    const res = await DELETE(req({ lectureId: LECTURE_ID }, 'DELETE'))
    expect(res.status).toBe(200)

    const unpublishCall = update.mock.invocationCallOrder[0]
    const removeCall = remove.mock.invocationCallOrder[0]
    expect(unpublishCall).toBeLessThan(removeCall)
    expect(update).toHaveBeenNthCalledWith(1, expect.objectContaining({ is_published: false }))
  })

  it('clears both the pointer and the duration once the object is gone', async () => {
    const { update } = stubAdmin({
      lecture: { id: LECTURE_ID, storage_path: `videos/${LECTURE_ID}.mp4` },
    })

    await DELETE(req({ lectureId: LECTURE_ID }, 'DELETE'))
    expect(update).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({ storage_path: null, duration_seconds: null }),
    )
  })

  it('removes every candidate key, recovering a PUT that landed without a confirm', async () => {
    // storage_path is null — the stuck case — so the extension is only
    // knowable from the bucket, and the row alone cannot say which file to drop.
    const { remove } = stubAdmin({ lecture: { id: LECTURE_ID, storage_path: null } })

    const res = await DELETE(req({ lectureId: LECTURE_ID }, 'DELETE'))
    expect(res.status).toBe(200)
    expect(remove).toHaveBeenCalledWith(
      expect.arrayContaining([`videos/${LECTURE_ID}.mp4`, `videos/${LECTURE_ID}.webm`]),
    )
  })

  it('rejects a lecture id that is not a uuid', async () => {
    stubAdmin({})
    const res = await DELETE(req({ lectureId: '../../videos' }, 'DELETE'))
    expect(res.status).toBe(400)
  })
})
