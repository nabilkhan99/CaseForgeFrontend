/**
 * Turn a failed getUserMedia into something a trainee can act on.
 *
 * The raw DOMException message ("Permission denied", "Not supported") used to
 * be shown verbatim under "Connection problem" with a "Try again" button —
 * which can never succeed on a denied mic, because browsers remember the
 * denial (iOS Safari permanently until the site's settings are reset).
 */
export type SessionErrorKind = 'mic_denied' | 'mic_missing' | 'mic_busy' | 'mic_unsupported' | 'connection'

export class MicError extends Error {
  constructor(
    public readonly kind: SessionErrorKind,
    message: string,
  ) {
    super(message)
    this.name = 'MicError'
  }
}

export function classifyMicError(err: unknown): MicError {
  const name = err instanceof DOMException || err instanceof Error ? err.name : ''
  switch (name) {
    case 'NotAllowedError':
    case 'PermissionDeniedError':
    case 'SecurityError':
      return new MicError('mic_denied', 'Microphone access was blocked.')
    case 'NotFoundError':
    case 'DevicesNotFoundError':
      return new MicError('mic_missing', 'No microphone was found on this device.')
    case 'NotReadableError':
    case 'TrackStartError':
    case 'AbortError':
      return new MicError('mic_busy', 'Your microphone is in use by another app.')
    case 'NotSupportedError':
    case 'TypeError':
      return new MicError('mic_unsupported', 'This browser cannot capture audio here.')
    default:
      return new MicError('mic_unsupported', err instanceof Error ? err.message : 'Could not access the microphone.')
  }
}

/** Per-platform "how to turn it back on" copy. */
export function micRecoveryHint(kind: SessionErrorKind, userAgent: string): string {
  const ua = userAgent.toLowerCase()
  const ios = /iphone|ipad|ipod/.test(ua)
  const safari = /safari/.test(ua) && !/chrome|crios|android/.test(ua)
  const android = /android/.test(ua)

  switch (kind) {
    case 'mic_denied':
      if (ios)
        return 'Open Settings → Safari → Microphone and allow it, or tap the "AA" icon in the address bar → Website Settings → Microphone → Allow. Then reload this page.'
      if (safari)
        return 'In Safari choose Safari → Settings for this Website, set Microphone to Allow, then reload this page.'
      if (android)
        return 'Tap the lock icon in the address bar → Permissions → Microphone → Allow, then reload this page.'
      return 'Click the lock or camera icon in the address bar, set Microphone to Allow, then reload this page.'
    case 'mic_missing':
      return 'Plug in or enable a microphone (headphones with a mic work well), then reload this page.'
    case 'mic_busy':
      return 'Close any app or tab that is using your microphone (calls, recorders, other consultations), then reload this page.'
    case 'mic_unsupported':
      return 'Try the latest Chrome, Safari or Edge over https. Private browsing modes sometimes block audio.'
    default:
      return 'Check your internet connection and try again.'
  }
}
