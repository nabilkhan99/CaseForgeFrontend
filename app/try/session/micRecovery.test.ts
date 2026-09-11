import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

/**
 * A refused microphone must not end the guest funnel. Two halves, both pinned
 * against source because vitest runs in `node` here and neither a React hook
 * nor a call screen can be rendered.
 *
 * HALF ONE — the ORDER inside `connect()`. The ephemeral-key mint is the one
 * request in this product that spends money without an account, and on the
 * guest lane it also moves the row to `live` and stamps a 2-minute cooldown on
 * the `ff_guest` cookie. Minting BEFORE asking for the microphone meant a
 * fumbled permission prompt spent the mint on a consultation that could never
 * start, and then the door refused "try again" for two minutes. The permission
 * is free to ask for and free to be refused, so it goes first.
 *
 * HALF TWO — what the guest screen SAYS when it is refused. The signed-in
 * session screen has read `errorKind` since the mic errors were classified; the
 * guest screen ignored it and offered "Try again", which is precisely the one
 * action that cannot work — the browser remembers the refusal (iOS Safari until
 * the site's settings are reset), so connect() re-throws the same error forever.
 */

function source(relativePath: string): string {
  return readFileSync(fileURLToPath(new URL(relativePath, import.meta.url)), 'utf8')
}

const HOOK = source('../../../hooks/useRealtimeSession.ts')
const GUEST = source('./[sessionId]/GuestCallScreen.tsx')
const SIGNED_IN = source('../../clinical-master/session/[sessionId]/page.tsx')

describe('connect() asks for the microphone before it spends anything', () => {
  it('calls getUserMedia ahead of the token fetch', () => {
    const mic = HOOK.indexOf('navigator.mediaDevices.getUserMedia(')
    const mint = HOOK.indexOf('await fetch(tokenEndpoint')
    expect(mic).toBeGreaterThan(-1)
    expect(mint).toBeGreaterThan(-1)
    expect(mic).toBeLessThan(mint)
  })

  it('still classifies the failure rather than reporting a connection error', () => {
    // The throw is what `setErrorKind` reads to tell a mic problem from a
    // transport one, and it has to survive the reordering.
    expect(HOOK).toContain('throw micErr instanceof MicError ? micErr : classifyMicError(micErr)')
    expect(HOOK).toContain("setErrorKind(err instanceof MicError ? err.kind : 'connection')")
  })

  it('leaves the rest of the handshake in its original order', () => {
    // Only the permission prompt moved. The recorder still starts on the
    // stream, the peer connection is still built after the key, and the mic
    // track is still added to it before the offer.
    const order = [
      'await fetch(tokenEndpoint',
      'startSessionRecorder(micStream)',
      'new RTCPeerConnection()',
      "pc.createDataChannel('oai-events')",
      'pc.addTrack(micTrackRef.current, micStream)',
      'await pc.createOffer()',
    ].map((needle) => {
      const at = HOOK.indexOf(needle)
      expect(at, needle).toBeGreaterThan(-1)
      return at
    })
    expect(order).toEqual([...order].sort((a, b) => a - b))
  })
})

describe('the guest call screen owns the mic-blocked state', () => {
  it('reads errorKind off the hook, as the signed-in screen does', () => {
    expect(GUEST).toContain('errorKind')
    expect(GUEST).toContain("import { micRecoveryHint } from '@/lib/clinical-master/micErrors'")
    expect(GUEST).toContain("const micProblem = errorKind !== null && errorKind !== 'connection'")
  })

  it('names the permission instead of blaming the connection', () => {
    for (const title of [
      "errorKind === 'mic_denied' ? 'Microphone blocked'",
      "errorKind === 'mic_missing' ? 'No microphone found'",
      "errorKind === 'mic_busy' ? 'Microphone in use'",
    ]) {
      expect(GUEST).toContain(title)
    }
    // And the same per-platform instructions the signed-in screen shows.
    expect(GUEST).toContain('micRecoveryHint(')
  })

  it('offers a reload for a mic problem and a retry only for a real one', () => {
    expect(GUEST).toContain('micProblem ? window.location.reload() : connect()')
    expect(GUEST).toContain("{micProblem ? 'Reload this page' : 'Try again'}")
  })

  it('says the same things the signed-in screen says', () => {
    // The two screens drifted once already. Both now key off errorKind and
    // both offer a reload rather than a retry that cannot succeed.
    expect(SIGNED_IN).toContain("const micProblem = errorKind !== null && errorKind !== 'connection'")
    expect(SIGNED_IN).toContain('micProblem ? window.location.reload() : connect()')
  })
})
