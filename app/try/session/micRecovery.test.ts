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
 * What IS pinned: what the guest screen SAYS when it is refused, and that it
 * says it the way the signed-in session screen does. "Try again" is the one
 * action that cannot work on a refused microphone: the browser remembers the
 * refusal (iOS Safari until the site's settings are reset), so connect()
 * re-throws the same error forever.
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
    // The signed-in label, without its dash.
    expect(GUEST).toContain(`{micProblem ? "I've fixed it, reload" : 'Try again'}`)
    expect(SIGNED_IN).toContain("I've fixed it")
  })

  it('says the same things the signed-in screen says', () => {
    // The two screens drifted once already. Both now key off errorKind and
    // both offer a reload rather than a retry that cannot succeed.
    expect(SIGNED_IN).toContain("const micProblem = errorKind !== null && errorKind !== 'connection'")
    expect(SIGNED_IN).toContain('micProblem ? window.location.reload() : connect()')
  })

  it('always shows the recovery hint, as the signed-in screen does', () => {
    const always = '<p className="text-[13px] leading-[1.65] text-muted mb-6">{hint}</p>'
    expect(SIGNED_IN).toContain(always)
    expect(GUEST).toContain(always)
    expect(GUEST).not.toContain('{micProblem && <p')
  })

  it('goes back to the five cases, never to the home page', () => {
    expect(GUEST).toMatch(/<Link href="\/free"[^>]*>\s*Back to cases\s*<\/Link>/)
    expect(GUEST).not.toContain('Back to Fourteen Fisherman')
    // Leaving mid-call lands on the cases too.
    expect(GUEST).toContain("router.push('/free')")
    expect(GUEST).not.toContain("router.push('/')")
  })
})

describe('the guest call screen is the signed-in call screen', () => {
  it('starts the clock on connect, not at the first word', () => {
    expect(GUEST).toContain('isConnected={isConnected}')
    expect(SIGNED_IN).toContain('isConnected={isConnected}')
    expect(GUEST).not.toContain('clockRunning')
  })

  it('carries the error in the top bar, beside the live marker', () => {
    const errorLine = '{error && <span className="text-[11px] text-danger">{error}</span>}'
    expect(SIGNED_IN).toContain(errorLine)
    expect(GUEST).toContain(errorLine)
    expect(GUEST).toContain('{isConnected && (')
  })

  it('shows the plain missing states, pointed at the cases', () => {
    const SESSION_PAGE = source('./[sessionId]/page.tsx')
    const STATION_PAGE = source('../station/[stationId]/page.tsx')
    expect(SESSION_PAGE).toContain('<p className="text-muted mb-4">Consultation not found</p>')
    expect(STATION_PAGE).toContain('<p className="text-muted mb-4">Station not found</p>')
    for (const page of [SESSION_PAGE, STATION_PAGE]) {
      expect(page).toContain('<Link href="/free" className="text-primary hover:underline text-sm">')
      expect(page).toContain('Back to cases')
    }
  })

  it('keeps the undashed reading line on the case details page', () => {
    const READING = source('../station/[stationId]/GuestReadingScreen.tsx')
    expect(READING).toContain(
      'as in the exam. Nothing happens at zero, so begin when you&rsquo;re ready.',
    )
  })
})
