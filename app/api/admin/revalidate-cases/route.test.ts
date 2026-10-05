import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

/**
 * /api/admin/revalidate-cases: who may clear the public case caches, and what
 * gets cleared. Two doors (an admin session, or the service-role key as a
 * bearer token for a CLI) and everyone else refused before anything runs.
 */

const mocks = vi.hoisted(() => ({
  isAdmin: vi.fn(),
  revalidatePath: vi.fn(),
}))

vi.mock('@/lib/admin/guard', () => ({ isAdmin: () => mocks.isAdmin() }))
vi.mock('next/cache', () => ({
  revalidatePath: (...args: unknown[]) => mocks.revalidatePath(...args),
}))

const { POST } = await import('./route')

const SERVICE_KEY = 'service-role-key-for-tests'
const ORIGINAL_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY

function post(headers: Record<string, string> = {}) {
  return POST(new Request('http://localhost/api/admin/revalidate-cases', { method: 'POST', headers }))
}

beforeEach(() => {
  mocks.isAdmin.mockReset().mockResolvedValue(false)
  mocks.revalidatePath.mockReset()
  process.env.SUPABASE_SERVICE_ROLE_KEY = SERVICE_KEY
})

afterEach(() => {
  process.env.SUPABASE_SERVICE_ROLE_KEY = ORIGINAL_KEY
})

describe('who may revalidate', () => {
  it('lets a signed-in admin in', async () => {
    mocks.isAdmin.mockResolvedValue(true)
    const res = await post()
    expect(res.status).toBe(200)
    expect(mocks.revalidatePath).toHaveBeenCalled()
  })

  it('lets a CLI in with the service-role key as a bearer token, without a session', async () => {
    const res = await post({ Authorization: `Bearer ${SERVICE_KEY}` })
    expect(res.status).toBe(200)
    expect(mocks.isAdmin).not.toHaveBeenCalled()
    expect(mocks.revalidatePath).toHaveBeenCalled()
  })

  it.each([
    ['no credentials', {}],
    ['a wrong bearer token', { Authorization: 'Bearer not-the-key' }],
    ['a prefix of the key', { Authorization: `Bearer ${SERVICE_KEY.slice(0, 10)}` }],
    ['the key without the Bearer scheme', { Authorization: SERVICE_KEY }],
  ])('refuses %s and clears nothing', async (_label, headers) => {
    const res = await post(headers)
    expect(res.status).toBe(403)
    expect(mocks.revalidatePath).not.toHaveBeenCalled()
  })

  it('refuses a bearer token when the service key is unset, even an empty one', async () => {
    delete process.env.SUPABASE_SERVICE_ROLE_KEY
    const res = await post({ Authorization: 'Bearer ' })
    expect(res.status).toBe(403)
    expect(mocks.revalidatePath).not.toHaveBeenCalled()
  })
})

describe('what gets refreshed', () => {
  it('clears the case list, every case page, old id addresses, the sitemap and /free', async () => {
    mocks.isAdmin.mockResolvedValue(true)
    const res = await post()
    const body = await res.json()

    expect(mocks.revalidatePath.mock.calls).toEqual([
      ['/sca-cases'],
      ['/sca-cases/[slug]', 'page'],
      ['/cases/[id]', 'page'],
      ['/sitemap.xml'],
      ['/free'],
    ])
    expect(body.revalidated).toEqual(['/sca-cases', '/sca-cases/[slug]', '/cases/[id]', '/sitemap.xml', '/free'])
  })

  it('reports a failure as a 500 rather than a false success', async () => {
    mocks.isAdmin.mockResolvedValue(true)
    mocks.revalidatePath.mockImplementation(() => {
      throw new Error('boom')
    })
    vi.spyOn(console, 'error').mockImplementation(() => {})
    const res = await post()
    expect(res.status).toBe(500)
  })
})
