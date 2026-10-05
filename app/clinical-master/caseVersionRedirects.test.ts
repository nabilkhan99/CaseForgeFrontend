import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

/**
 * The client half of the case-version gates: a refusal sends the person to
 * the version of the case they DO see, never to a dead end or a price list.
 *
 * Source assertions, because vitest runs in `node` here and there is no DOM to
 * render the pages into. The server halves (create-session, realtime-token,
 * generate-feedback) have their own route tests.
 */

function source(relativePath: string): string {
  return readFileSync(fileURLToPath(new URL(relativePath, import.meta.url)), 'utf8')
}

/** Comments discuss the rules; only the code is bound by them. */
function withoutComments(code: string): string {
  return code
    .replace(/\{\/\*[\s\S]*?\*\/\}/g, ' ')
    .replace(/\/\*[\s\S]*?\*\//g, ' ')
    .replace(/^\s*\/\/.*$/gm, ' ')
}

const BRIEF = withoutComments(source('./station/[stationId]/page.tsx'))
const SESSION = withoutComments(source('./session/[sessionId]/page.tsx'))
const REPORT = withoutComments(source('../../components/clinical-master/FeedbackReport.tsx'))

describe('the brief page, when create-session refuses the version', () => {
  const branch = BRIEF.slice(BRIEF.indexOf('body?.code === CASE_VERSION_REFUSED'))

  it('branches on the shared code', () => {
    expect(BRIEF).toContain("import { CASE_VERSION_REFUSED } from '@/lib/stations/caseVersionCodes'")
  })

  it('forwards to the version the person does see, keeping `from`', () => {
    expect(branch).toContain('body.redirectStationId')
    expect(branch).toContain('router.replace(')
    expect(branch).toContain('`/clinical-master/station/${target}?from=${from}`')
  })

  it('never forwards to itself', () => {
    expect(branch).toContain('target && target !== stationId')
  })

  it('shows the refusal sentence when there is nowhere to forward', () => {
    expect(branch).toContain('setError(')
    expect(branch).toContain('body.error')
  })

  it('is handled before the generic 403, so a version refusal never reads as "buy a plan"', () => {
    const versionAt = BRIEF.indexOf('body?.code === CASE_VERSION_REFUSED')
    const pricingAt = BRIEF.indexOf("'/pricing?renew=true'")
    expect(versionAt).toBeGreaterThan(0)
    expect(versionAt).toBeLessThan(pricingAt)
  })
})

describe('the session page, when the token route refuses the case', () => {
  it('recognises the version refusals and the station mismatch by their sentences', () => {
    expect(SESSION).toContain('CASE_REFUSAL_REASONS.map(runRefusalMessage)')
    expect(SESSION).toContain('STATION_MISMATCH_MESSAGE')
  })

  it('offers the brief (which forwards) instead of a "Try again" that can only be refused', () => {
    const screen = SESSION.slice(SESSION.indexOf('CASE_REFUSAL_MESSAGES.has(error)'))
    const end = screen.indexOf('if (error && !isConnected) {')
    const refusal = screen.slice(0, end)
    expect(refusal).toContain('`/clinical-master/station/${stationId}')
    expect(refusal).not.toContain('connect()')
  })

  it('reopens itself on the session row\'s own case when the URL names another', () => {
    expect(SESSION).toContain(".select('status, station_id')")
    expect(SESSION).toContain('data.station_id !== stationId')
    expect(SESSION).toContain('router.replace(`/clinical-master/session/${sessionId}?')
  })
})

describe('the feedback report\'s link onward', () => {
  it('takes the route\'s practise target', () => {
    expect(REPORT).toContain('data.practiseStationId')
    expect(REPORT).toContain('setPractiseStationId(data.practiseStationId)')
    expect(REPORT).toContain('setFailedStationId(data.practiseStationId)')
  })

  it('points "Retry this case" at it, falling back to the case that was sat', () => {
    expect(REPORT).toContain('`/clinical-master/station/${practiseStationId ?? feedback.station_id}')
  })

  it('leaves further reading on the case that was sat', () => {
    expect(REPORT).toContain('<PccsFurtherReading stationId={feedback.station_id}')
  })
})
