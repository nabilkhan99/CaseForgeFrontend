import { describe, expect, it } from 'vitest'

/**
 * The two endpoints that used to spend Azure minutes for nobody.
 *
 * `/api/try/create-session` opened a `clinical_sessions` row with a null
 * `user_id`; `/api/try/realtime-token` minted an anonymous Azure gpt-realtime
 * ephemeral key against it. Free stations run in a free account now, so both are
 * closed — and closed is a thing worth a test, because the failure mode if one
 * of them came back is not an error anybody sees. It is a bill.
 *
 * They answer rather than 404 for the tab that has been open since this
 * morning: a sentence saying where the trial went, and a 410 that says the
 * resource is finished rather than missing.
 */

const { POST: createSession } = await import('./create-session/route')
const { POST: realtimeToken } = await import('./realtime-token/route')

describe.each([
  ['create-session', createSession],
  ['realtime-token', realtimeToken],
])('/api/try/%s', (_name, handler) => {
  it('is 410 Gone', async () => {
    const response = await handler()
    expect(response.status).toBe(410)
  })

  it('says where the trial went', async () => {
    const body = (await (await handler()).json()) as { error: string; start: string }
    expect(body.error).toBe('guest_trial_retired')
    expect(body.start).toBe('/free/start')
  })

  it('is never cached', async () => {
    const response = await handler()
    expect(response.headers.get('cache-control')).toBe('no-store')
  })
})
