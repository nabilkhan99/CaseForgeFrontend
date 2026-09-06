import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

/**
 * `trial_station_completed` — the middle step of the whole funnel.
 *
 * Its `index` is what answers "how many of the five do people actually run",
 * and there are exactly two ways to get it wrong: count a REFRESH of a report
 * as another station, or take the number from the client instead of the
 * server's derived count. Both are pinned here.
 *
 * `@/lib/analytics` is mocked away: it initialises PostHog and reads the
 * Supabase session, neither of which belongs in a unit test of a counting rule.
 */

const mocks = vi.hoisted(() => ({
  trackEvent: vi.fn(async () => {}),
  fetch: vi.fn(),
  store: new Map<string, string>(),
}))

vi.mock('@/lib/analytics', () => ({ trackEvent: mocks.trackEvent }))

const { reportTrialStationCompleted, TRIAL_STATION_COMPLETED } = await import('./trialEvents')

/** A browser, as much of one as this function touches. */
function stubWindow() {
  vi.stubGlobal('window', {
    sessionStorage: {
      getItem: (key: string) => mocks.store.get(key) ?? null,
      setItem: (key: string, value: string) => {
        mocks.store.set(key, value)
      },
    },
  })
  vi.stubGlobal('fetch', mocks.fetch)
}

function subscriptionReturns(body: unknown, ok = true) {
  mocks.fetch.mockResolvedValue({ ok, json: async () => body })
}

beforeEach(() => {
  vi.clearAllMocks()
  mocks.store.clear()
  stubWindow()
})

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('reportTrialStationCompleted', () => {
  it('reports the index the SERVER counted, with the verdict', async () => {
    subscriptionReturns({ trial: { state: 'trial', used: 3 } })

    await reportTrialStationCompleted('session-1', 'Bare Fail')

    expect(mocks.trackEvent).toHaveBeenCalledWith(TRIAL_STATION_COMPLETED, {
      index: 3,
      verdict: 'Bare Fail',
    })
  })

  it('says nothing for an account that is not on a trial', async () => {
    subscriptionReturns({ trial: null })
    await reportTrialStationCompleted('session-1', 'Pass')
    expect(mocks.trackEvent).not.toHaveBeenCalled()
  })

  it('says nothing when the caller is not signed in', async () => {
    subscriptionReturns({ error: 'Unauthorized' }, false)
    await reportTrialStationCompleted('session-1', 'Pass')
    expect(mocks.trackEvent).not.toHaveBeenCalled()
  })

  it('reports a session once, however many times the report is opened', async () => {
    subscriptionReturns({ trial: { state: 'trial', used: 2 } })

    await reportTrialStationCompleted('session-1', 'Fail')
    await reportTrialStationCompleted('session-1', 'Fail')
    await reportTrialStationCompleted('session-2', 'Fail')

    expect(mocks.trackEvent).toHaveBeenCalledTimes(2)
  })

  it('never reports index 0 — a session that predates the grant still happened', async () => {
    subscriptionReturns({ trial: { state: 'trial', used: 0 } })
    await reportTrialStationCompleted('session-1', 'Bare Pass')
    expect(mocks.trackEvent).toHaveBeenCalledWith(TRIAL_STATION_COMPLETED, {
      index: 1,
      verdict: 'Bare Pass',
    })
  })

  it('stays silent when the lookup itself fails', async () => {
    mocks.fetch.mockRejectedValue(new Error('offline'))
    await reportTrialStationCompleted('session-1', 'Pass')
    expect(mocks.trackEvent).not.toHaveBeenCalled()
  })
})
