import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { fetchSubscriptionOnce } from './subscriptionFetch'

/**
 * The one property worth pinning: it dedupes the REQUEST and not the ANSWER.
 *
 * Caching the answer for the life of a tab would be a way for somebody who has
 * just paid to keep seeing a paywall, which is exactly the failure this route
 * exists to prevent.
 */

const stub = vi.fn()

beforeEach(() => {
  vi.clearAllMocks()
  vi.stubGlobal('fetch', stub)
})

afterEach(() => {
  vi.unstubAllGlobals()
})

/** A fetch whose promise only settles when the test says so. */
function deferred() {
  let release: (value: unknown) => void = () => {}
  const promise = new Promise((resolve) => {
    release = resolve
  })
  return { promise, release }
}

describe('fetchSubscriptionOnce', () => {
  it('makes one request for callers that mount together', async () => {
    // The station brief page mounts useCohortAllowlist and useTrialStatus in
    // the same tick, and for a trial account that route is four DB round trips.
    const { promise, release } = deferred()
    stub.mockReturnValue(promise)

    const first = fetchSubscriptionOnce()
    const second = fetchSubscriptionOnce()
    release({ ok: true, json: async () => ({ state: 'none' }) })

    expect(await first).toEqual({ state: 'none' })
    expect(await second).toEqual({ state: 'none' })
    expect(stub).toHaveBeenCalledTimes(1)
  })

  it('fetches again once the first has settled', async () => {
    // A later mount — after a checkout, after a grant is stamped — must see the
    // new state rather than a copy of the old one.
    stub.mockResolvedValue({ ok: true, json: async () => ({ state: 'none' }) })
    await fetchSubscriptionOnce()
    await fetchSubscriptionOnce()
    expect(stub).toHaveBeenCalledTimes(2)
  })

  it('answers null rather than rejecting when the request fails', async () => {
    stub.mockRejectedValue(new Error('offline'))
    expect(await fetchSubscriptionOnce()).toBeNull()
  })

  it('answers null for a signed-out caller', async () => {
    stub.mockResolvedValue({ ok: false, json: async () => ({ error: 'Unauthorized' }) })
    expect(await fetchSubscriptionOnce()).toBeNull()
  })
})
