import { describe, expect, it } from 'vitest'
import { classifyMicError, micRecoveryHint } from './micErrors'

const domErr = (name: string) => Object.assign(new Error('x'), { name })

describe('classifyMicError', () => {
  it('maps a denied permission to mic_denied', () => {
    expect(classifyMicError(domErr('NotAllowedError')).kind).toBe('mic_denied')
  })
  it('maps a missing device to mic_missing', () => {
    expect(classifyMicError(domErr('NotFoundError')).kind).toBe('mic_missing')
  })
  it('maps a busy device to mic_busy', () => {
    expect(classifyMicError(domErr('NotReadableError')).kind).toBe('mic_busy')
  })
  it('never surfaces a raw DOMException message for known kinds', () => {
    expect(classifyMicError(domErr('NotAllowedError')).message).not.toBe('x')
  })
})

describe('micRecoveryHint', () => {
  it('gives iOS users the Settings path', () => {
    expect(micRecoveryHint('mic_denied', 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) Safari')).toMatch(/Settings/)
  })
  it('gives desktop Chrome the address-bar path', () => {
    expect(micRecoveryHint('mic_denied', 'Mozilla/5.0 (Macintosh) Chrome/120 Safari/537')).toMatch(/address bar/)
  })
})
