import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

/**
 * `trial_station_completed` — the middle step of the whole funnel.
 *
 * Its `index` answers "how many of the five do people actually try" and its
 * `attempt` answers the question the whole offer now turns on: "does a second
 * run at the same case score better". There are exactly two ways to get either
 * wrong: count a REFRESH of a report as another consultation, or take the
 * number from the client instead of the server's derived count. Both are pinned
 * here.
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
  it('reports the counts the SERVER derived, with the verdict', async () => {
    subscriptionReturns({
      trial: { state: 'trial', casesTried: 3, attemptsByStation: { 'st-2': 4 } },
    })

    await reportTrialStationCompleted('session-1', 'Bare Fail', 'st-2')

    expect(mocks.trackEvent).toHaveBeenCalledWith(TRIAL_STATION_COMPLETED, {
      index: 3,
      verdict: 'Bare Fail',
      attempt: 4,
    })
  })

  it('reports attempt 1 when the station is not known', async () => {
    // The caller has the station id off the feedback payload, but a report
    // rendered before that lands must still produce a usable row rather than
    // an `attempt: 0` nobody can filter on.
    subscriptionReturns({ trial: { state: 'trial', casesTried: 1, attemptsByStation: {} } })

    await reportTrialStationCompleted('session-1', 'Pass')

    expect(mocks.trackEvent).toHaveBeenCalledWith(TRIAL_STATION_COMPLETED, {
      index: 1,
      verdict: 'Pass',
      attempt: 1,
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
    subscriptionReturns({ trial: { state: 'trial', casesTried: 2, attemptsByStation: {} } })

    await reportTrialStationCompleted('session-1', 'Fail')
    await reportTrialStationCompleted('session-1', 'Fail')
    await reportTrialStationCompleted('session-2', 'Fail')

    expect(mocks.trackEvent).toHaveBeenCalledTimes(2)
  })

  it('never reports index 0 — a consultation the count missed still happened', async () => {
    subscriptionReturns({ trial: { state: 'trial', casesTried: 0, attemptsByStation: {} } })
    await reportTrialStationCompleted('session-1', 'Bare Pass', 'st-1')
    expect(mocks.trackEvent).toHaveBeenCalledWith(TRIAL_STATION_COMPLETED, {
      index: 1,
      verdict: 'Bare Pass',
      attempt: 1,
    })
  })

  it('stays silent when the lookup itself fails', async () => {
    mocks.fetch.mockRejectedValue(new Error('offline'))
    await reportTrialStationCompleted('session-1', 'Pass')
    expect(mocks.trackEvent).not.toHaveBeenCalled()
  })
})
