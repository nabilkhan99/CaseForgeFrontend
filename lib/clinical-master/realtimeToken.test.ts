import { describe, expect, it } from 'vitest'
import { laneFromEndpoint, resolveTargets } from './realtimeToken'
import { DEFAULT_TRANSCRIPTION_MODEL } from './realtimeSession'

const US = 'https://fourteenfisherman-voice-us.openai.azure.com'
const EU = 'https://fourteenfisherman-voice-eu.openai.azure.com'

/** Both lanes credentialled, US in the primary slot — the Lever 1 arrangement. */
const bothLanes = {
  AZURE_OPENAI_REALTIME_ENDPOINT: US,
  AZURE_OPENAI_REALTIME_API_KEY: 'us-key',
  AZURE_OPENAI_REALTIME_DEPLOYMENT: 'gpt-realtime-2',
  AZURE_OPENAI_REALTIME_TRANSCRIPTION_MODEL: 'gpt-4o-transcribe',
  AZURE_OPENAI_REALTIME_FALLBACK_ENDPOINT: EU,
  AZURE_OPENAI_REALTIME_FALLBACK_API_KEY: 'eu-key',
  AZURE_OPENAI_REALTIME_FALLBACK_DEPLOYMENT: 'gpt-realtime-2',
  AZURE_OPENAI_REALTIME_FALLBACK_TRANSCRIPTION_MODEL: 'gpt-realtime-whisper',
}

/** A copy of `bothLanes` with some variables unset, as a leaner env would be. */
const without = (...keys: Array<keyof typeof bothLanes>): Record<string, string | undefined> => {
  const env: Record<string, string | undefined> = { ...bothLanes }
  for (const key of keys) delete env[key]
  return env
}

describe('laneFromEndpoint', () => {
  it('names the Azure resource behind a full endpoint URL', () => {
    expect(laneFromEndpoint(US)).toBe('fourteenfisherman-voice-us')
  })
  it('ignores a trailing slash or path', () => {
    expect(laneFromEndpoint(`${EU}/openai/v1/`)).toBe('fourteenfisherman-voice-eu')
  })
  it('tolerates a missing scheme', () => {
    expect(laneFromEndpoint('fourteenfisherman-voice-us.openai.azure.com')).toBe(
      'fourteenfisherman-voice-us',
    )
  })
  it('never throws on junk — a mint must not fail over a log label', () => {
    expect(laneFromEndpoint('')).toBe('unknown')
    expect(laneFromEndpoint('https://')).toBe('unknown')
  })
})

describe('resolveTargets', () => {
  it('returns nothing when no credentials are configured', () => {
    expect(resolveTargets({})).toEqual([])
  })

  it('orders primary before fallback and labels each with its resource', () => {
    const targets = resolveTargets(bothLanes)
    expect(targets.map((t) => [t.origin, t.lane])).toEqual([
      ['primary', 'fourteenfisherman-voice-us'],
      ['fallback', 'fourteenfisherman-voice-eu'],
    ])
  })

  it('lets the primary transcription model be swapped with the lane', () => {
    // The Central US resource has no whisper deployment, so moving it into the
    // primary slot has to move gpt-4o-transcribe with it.
    expect(resolveTargets(bothLanes)[0].transcriptionModel).toBe('gpt-4o-transcribe')
    expect(resolveTargets(bothLanes)[1].transcriptionModel).toBe('gpt-realtime-whisper')
  })

  it('falls back to whisper for the primary when the env var is unset', () => {
    const env = without('AZURE_OPENAI_REALTIME_TRANSCRIPTION_MODEL')
    expect(resolveTargets(env)[0].transcriptionModel).toBe(DEFAULT_TRANSCRIPTION_MODEL)
  })

  it('skips the primary unless endpoint, key and deployment are all set', () => {
    const env = without('AZURE_OPENAI_REALTIME_DEPLOYMENT')
    expect(resolveTargets(env).map((t) => t.origin)).toEqual(['fallback'])
  })

  it('skips the fallback when its key is missing, leaving the primary alone', () => {
    const env = without('AZURE_OPENAI_REALTIME_FALLBACK_API_KEY')
    expect(resolveTargets(env).map((t) => t.origin)).toEqual(['primary'])
  })

  it('defaults the fallback deployment and transcriber when unset', () => {
    const env = without(
      'AZURE_OPENAI_REALTIME_FALLBACK_DEPLOYMENT',
      'AZURE_OPENAI_REALTIME_FALLBACK_TRANSCRIPTION_MODEL',
    )
    const fallback = resolveTargets(env)[1]
    expect(fallback.deployment).toBe('gpt-realtime-2')
    expect(fallback.transcriptionModel).toBe('gpt-4o-transcribe')
  })

  it('gives the primary the tighter deadline so a dead lane fails over fast', () => {
    const [primary, fallback] = resolveTargets(bothLanes)
    expect(primary.timeoutMs).toBeLessThan(fallback.timeoutMs)
  })
})
