import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  extensionForMimeType,
  pickRecorderMimeType,
  startSessionRecorder,
} from './sessionRecorder'

/** Install a MediaRecorder stub that supports exactly the given MIME types. */
function stubMediaRecorder(supported: readonly string[]) {
  const ctor = vi.fn()
  Object.assign(ctor, {
    isTypeSupported: (type: string) => supported.includes(type),
  })
  vi.stubGlobal('MediaRecorder', ctor)
  return ctor
}

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('pickRecorderMimeType', () => {
  it('returns null when the browser has no MediaRecorder', () => {
    vi.stubGlobal('MediaRecorder', undefined)
    expect(pickRecorderMimeType()).toBeNull()
  })

  it('prefers Opus in WebM when everything is supported', () => {
    stubMediaRecorder(['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4'])
    expect(pickRecorderMimeType()).toBe('audio/webm;codecs=opus')
  })

  it('falls back to Safari mp4 when WebM is unavailable', () => {
    stubMediaRecorder(['audio/mp4'])
    expect(pickRecorderMimeType()).toBe('audio/mp4')
  })

  it('returns null when nothing is supported', () => {
    stubMediaRecorder([])
    expect(pickRecorderMimeType()).toBeNull()
  })

  it('survives an isTypeSupported that throws', () => {
    const ctor = vi.fn()
    Object.assign(ctor, {
      isTypeSupported: (type: string) => {
        if (type !== 'audio/mp4') throw new Error('older WebKit')
        return true
      },
    })
    vi.stubGlobal('MediaRecorder', ctor)
    expect(pickRecorderMimeType()).toBe('audio/mp4')
  })
})

describe('extensionForMimeType', () => {
  it('maps each container to its file extension', () => {
    expect(extensionForMimeType('audio/webm;codecs=opus')).toBe('webm')
    expect(extensionForMimeType('audio/webm')).toBe('webm')
    expect(extensionForMimeType('audio/mp4')).toBe('m4a')
    expect(extensionForMimeType('audio/ogg;codecs=opus')).toBe('ogg')
  })

  it('ignores case and surrounding whitespace', () => {
    expect(extensionForMimeType(' AUDIO/MP4 ; codecs=aac')).toBe('m4a')
  })

  it('defaults to webm for anything unrecognised', () => {
    expect(extensionForMimeType('audio/flac')).toBe('webm')
    expect(extensionForMimeType('')).toBe('webm')
  })
})

describe('startSessionRecorder', () => {
  it('returns null rather than throwing when recording is unsupported', () => {
    vi.stubGlobal('MediaRecorder', undefined)
    expect(startSessionRecorder({} as MediaStream)).toBeNull()
  })

  it('returns null when there is no AudioContext to mix with', () => {
    stubMediaRecorder(['audio/webm;codecs=opus'])
    vi.stubGlobal('window', {})
    expect(startSessionRecorder({} as MediaStream)).toBeNull()
  })

  it('returns null when constructing the audio graph throws', () => {
    stubMediaRecorder(['audio/webm;codecs=opus'])
    vi.stubGlobal('window', {
      AudioContext: class {
        constructor() {
          throw new Error('no audio device')
        }
      },
    })
    expect(startSessionRecorder({} as MediaStream)).toBeNull()
  })
})
