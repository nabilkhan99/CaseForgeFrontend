import { afterEach, describe, expect, it, vi } from 'vitest'
import { isStagedDeployment, visibleStationStates } from './visibility'

afterEach(() => {
  vi.unstubAllEnvs()
})

/** Staged mode bypasses the entitlement gate, so every case here is a paywall case. */
describe('isStagedDeployment', () => {
  it('is off without the flag, whatever the environment', () => {
    vi.stubEnv('NEXT_PUBLIC_VERCEL_ENV', 'preview')
    expect(isStagedDeployment()).toBe(false)
  })

  it('is on for preview and development deployments', () => {
    vi.stubEnv('NEXT_PUBLIC_SHOW_STAGED_STATIONS', '1')
    vi.stubEnv('NEXT_PUBLIC_VERCEL_ENV', 'preview')
    expect(isStagedDeployment()).toBe(true)
    vi.stubEnv('NEXT_PUBLIC_VERCEL_ENV', 'development')
    expect(isStagedDeployment()).toBe(true)
  })

  it('refuses production even with the flag set', () => {
    vi.stubEnv('NEXT_PUBLIC_SHOW_STAGED_STATIONS', '1')
    vi.stubEnv('NEXT_PUBLIC_VERCEL_ENV', 'production')
    expect(isStagedDeployment()).toBe(false)
  })

  it('refuses an unrecognised environment rather than assuming it is safe', () => {
    // The allowlist is the point: a value nobody anticipated must not read as
    // "not production, therefore staged".
    vi.stubEnv('NEXT_PUBLIC_SHOW_STAGED_STATIONS', '1')
    vi.stubEnv('NEXT_PUBLIC_VERCEL_ENV', 'something-new')
    expect(isStagedDeployment()).toBe(false)
  })

  it('falls back to NODE_ENV when Vercel does not expose its own', () => {
    // NEXT_PUBLIC_VERCEL_ENV only exists when "expose System Environment
    // Variables" is on. Undefined must not mean "staged" on the live site.
    vi.stubEnv('NEXT_PUBLIC_SHOW_STAGED_STATIONS', '1')
    vi.stubEnv('NEXT_PUBLIC_VERCEL_ENV', '')
    vi.stubEnv('NODE_ENV', 'production')
    expect(isStagedDeployment()).toBe(false)
    vi.stubEnv('NODE_ENV', 'development')
    expect(isStagedDeployment()).toBe(true)
  })
})

describe('visibleStationStates', () => {
  it('shows only live stations by default', () => {
    expect(visibleStationStates()).toEqual([true])
  })

  it('adds staged stations on a staged deployment', () => {
    vi.stubEnv('NEXT_PUBLIC_SHOW_STAGED_STATIONS', '1')
    vi.stubEnv('NEXT_PUBLIC_VERCEL_ENV', 'preview')
    expect(visibleStationStates()).toEqual([true, false])
  })
})
