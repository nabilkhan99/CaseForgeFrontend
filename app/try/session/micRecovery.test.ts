import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

/**
 * A refused microphone must not end the guest funnel. Pinned against source
 * because vitest runs in `node` here and neither a React hook nor a call
 * screen can be rendered.
 *
 * The ORDER inside `connect()` (ask for the microphone before or after minting
 * the key) is deliberately left as it is on main: the voice hook is shared with
 * every paid consultation, and it is not changed from the trial branch.
 *
 * What IS pinned: what the guest screen SAYS when it is refused. The signed-in
 * session screen has read `errorKind` since the mic errors were classified; the
 * guest screen ignored it and offered "Try again", which is precisely the one
 * action that cannot work — the browser remembers the refusal (iOS Safari until
 * the site's settings are reset), so connect() re-throws the same error forever.
 */

function source(relativePath: string): string {
  return readFileSync(fileURLToPath(new URL(relativePath, import.meta.url)), 'utf8')
}

const GUEST = source('./[sessionId]/GuestCallScreen.tsx')
const SIGNED_IN = source('../../clinical-master/session/[sessionId]/page.tsx')

describe('the brief is read before the call, not during it', () => {
  const CONNECTING = source('../../../components/clinical-master/ConnectingScreen.tsx')
  const TALK = source('../../try/talk/route.ts')

  it('opens the guest on the case details page, not straight into the call', () => {
    expect(TALK).toContain('`/try/station/${stationId}?session=${sessionId}`')
    expect(TALK).not.toContain("leave(req, `/try/session/${sessionId}`)")
  })

  it('keeps the call screen to the call', () => {
    for (const gone of ['Read the full brief first', 'End whenever you like', 'brief={brief}']) {
      expect(GUEST, gone).not.toContain(gone)
    }
  })

  it('uses the same connecting screen as the signed-in session', () => {
    expect(CONNECTING).not.toContain('brief?:')
    expect(SIGNED_IN).not.toContain('brief={')
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
