import { describe, expect, it } from 'vitest'
import { NextRequest } from 'next/server'
import { GET } from './route'

/**
 * The retired one-click door.
 *
 * `/try/talk` used to open an anonymous consultation as a side effect of a GET.
 * It now carries the visitor to /free/start, where an account is made before
 * anybody talks to a patient. Two things are worth pinning, because both fail
 * silently rather than loudly:
 *
 *  1. it still ANSWERS. The path is in ads, in sent emails and in every public
 *     case page cached before today; a 404 there is a lost trainee and nothing
 *     in the product would report it.
 *  2. the STATION survives the hop. A link to a specific case that lands on a
 *     generic form has quietly become a different link.
 */

function get(url: string): Promise<Response> {
  return GET(new NextRequest(new Request(url, { method: 'GET' })))
}

const ORIGIN = 'https://www.fourteenfisherman.com'

describe('/try/talk', () => {
  it('redirects to the free account form', async () => {
    const response = await get(`${ORIGIN}/try/talk`)

    expect(response.status).toBe(307)
    expect(response.headers.get('location')).toBe(`${ORIGIN}/free/start`)
  })

  it('is temporary, so where it points can be changed again', async () => {
    // 308 would be cached by browsers for as long as they liked — including on
    // the machine of whoever is testing the next change to this route.
    const response = await get(`${ORIGIN}/try/talk`)
    expect(response.status).toBe(307)
    expect(response.headers.get('cache-control')).toBe('no-store')
  })

  it('carries the station through, so a case link still opens that case', async () => {
    const station = '2b0d9a5e-0000-4000-8000-000000000000'
    const response = await get(`${ORIGIN}/try/talk?station=${station}`)

    expect(response.headers.get('location')).toBe(`${ORIGIN}/free/start?station=${station}`)
  })

  it('leaves everything else in the query behind', async () => {
    // utm tags belong to the page the link was on. Only the station changes
    // what happens on the far side of the form.
    const response = await get(`${ORIGIN}/try/talk?utm_source=ads&ref=abc`)
    expect(response.headers.get('location')).toBe(`${ORIGIN}/free/start`)
  })

  it('opens nothing, whoever asks', async () => {
    // The prefetch guard is gone because there is nothing left to guard: this
    // handler reads no database, writes no row and sets no cookie. A crawler,
    // an unfurler and a router prefetch all get the same redirect.
    const response = await get(`${ORIGIN}/try/talk`)
    expect(response.headers.get('set-cookie')).toBeNull()
  })
})
