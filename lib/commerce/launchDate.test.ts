import { afterEach, describe, expect, it, vi } from 'vitest'
import { ACCESS_LAUNCH_DATE } from './entitlements'
import { effectiveLaunchDate } from './launchDate'

describe('effectiveLaunchDate', () => {
  afterEach(() => vi.unstubAllEnvs())

  it('is the real launch day on production even with an override set', () => {
    vi.stubEnv('NEXT_PUBLIC_SHOW_STAGED_STATIONS', '1')
    vi.stubEnv('NEXT_PUBLIC_VERCEL_ENV', 'production')
    vi.stubEnv('NEXT_PUBLIC_ACCESS_OPENS_OVERRIDE', '2026-08-01')
    expect(effectiveLaunchDate()).toEqual(ACCESS_LAUNCH_DATE)
  })

  it('honours a well-formed override on a staged deployment', () => {
    vi.stubEnv('NEXT_PUBLIC_SHOW_STAGED_STATIONS', '1')
    vi.stubEnv('NEXT_PUBLIC_VERCEL_ENV', 'preview')
    vi.stubEnv('NEXT_PUBLIC_ACCESS_OPENS_OVERRIDE', '2026-08-22')
    expect(effectiveLaunchDate().toISOString()).toBe('2026-08-22T00:00:00.000Z')
  })

  it('ignores a malformed override', () => {
    vi.stubEnv('NEXT_PUBLIC_SHOW_STAGED_STATIONS', '1')
    vi.stubEnv('NEXT_PUBLIC_VERCEL_ENV', 'preview')
    vi.stubEnv('NEXT_PUBLIC_ACCESS_OPENS_OVERRIDE', 'tomorrow')
    expect(effectiveLaunchDate()).toEqual(ACCESS_LAUNCH_DATE)
  })
})
