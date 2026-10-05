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
const HOOK = withoutComments(source('../../hooks/useRealtimeSession.ts'))
const SERVER_BRIEF = withoutComments(source('../../lib/clinical-master/serverBrief.ts'))

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

describe('the brief page, when its own read cannot show the case', () => {
  const effect = BRIEF.slice(BRIEF.indexOf('async function fetchStation'), BRIEF.indexOf('if (stationId) fetchStation();'))

  it('keeps the browser read as the fast path for a plain live case', () => {
    expect(effect).toContain(".from('stations')")
    expect(effect).toContain("s.lifecycle === 'live' && !s.replaces_station_id")
    // The route is consulted only off the fast path.
    const routeCall = effect.indexOf('await fetchServerBrief(stationId)')
    expect(routeCall).toBeGreaterThan(effect.indexOf('if (!plainLive) {'))
    expect(effect.match(/await fetchServerBrief\(/g)).toHaveLength(1)
  })

  it('asks the server route through the shared reader (lib/clinical-master/serverBrief)', () => {
    expect(BRIEF).toContain("import { fetchServerBrief } from '@/lib/clinical-master/serverBrief'")
    expect(SERVER_BRIEF).toContain('`/api/clinical-master/station-brief/${encodeURIComponent(stationId)}`')
  })

  it('forwards a version refusal that names another case, keeping `from`', () => {
    expect(SERVER_BRIEF).toContain('body?.code === CASE_VERSION_REFUSED')
    expect(SERVER_BRIEF).toContain('target && target !== stationId')
    expect(effect).toContain('`/clinical-master/station/${server.target}?from=${from}`')
    expect(effect).toContain('router.replace(')
  })

  it('renders the refusal sentence when there is nowhere to forward', () => {
    expect(effect).toContain('setRefusal(server.message)')
    expect(BRIEF).toContain("{refusal ?? 'Station not found'}")
  })

  it('renders the server\'s brief when it allows the case', () => {
    expect(effect).toContain('setStation(server.station)')
  })

  it('falls back to the browser read when the server cannot answer', () => {
    const unavailable = effect.slice(effect.indexOf("if (server.kind === 'brief')"))
    expect(unavailable).toContain('toStationBrief(s, domain?.name)')
  })
})

describe('the session page, when its own read cannot see the case (an admin\'s draft)', () => {
  const effect = SESSION.slice(SESSION.indexOf('async function fetchStation'), SESSION.indexOf('fetchStation();'))

  it('keeps the browser read first, and asks the server only when it comes back empty', () => {
    expect(effect).toContain(".from('stations')")
    const browserHit = effect.indexOf('if (data) {')
    const serverCall = effect.indexOf('await fetchServerBrief(stationId)')
    expect(browserHit).toBeGreaterThan(0)
    expect(serverCall).toBeGreaterThan(browserHit)
  })

  it('takes everything connect() waits for from the server\'s brief', () => {
    const brief = effect.slice(effect.indexOf("if (server.kind === 'brief')"))
    for (const field of ['id', 'title', 'patient_name', 'consultation_duration_seconds']) {
      expect(brief).toContain(`${field}: server.station.${field}`)
    }
    expect(SESSION).toContain("sessionState === 'startable' && station &&")
  })

  it('sends a version refusal to the brief, which forwards or explains', () => {
    expect(effect).toContain("server.kind === 'forward' || server.kind === 'refused'")
    expect(effect).toContain('`/clinical-master/station/${target}?from=${from}`')
  })

  it('says so, instead of waiting forever, when nobody can load the case', () => {
    expect(effect).toContain('setStationUnavailable(true)')
    expect(SESSION).toContain('if (stationUnavailable && !station)')
  })
})

describe('the realtime hook, when the token endpoint refuses', () => {
  it('still surfaces the body\'s sentence as `error`', () => {
    expect(HOOK).toContain('body.error || `Token request failed: ${res.statusText}`')
  })

  it('carries the body\'s code and redirect target through the throw', () => {
    expect(HOOK).toContain("typeof body.code === 'string' ? body.code : null")
    expect(HOOK).toContain("typeof body.redirectStationId === 'string' ? body.redirectStationId : null")
    expect(HOOK).toContain('setErrorCode(err instanceof TokenRequestError ? err.code : null)')
    expect(HOOK).toContain('setErrorRedirectStationId(err instanceof TokenRequestError ? err.redirectStationId : null)')
  })

  it('clears them on every new connect, and returns them alongside `error`', () => {
    const connect = HOOK.slice(HOOK.indexOf('const connect = useCallback'))
    expect(connect.indexOf('setErrorCode(null)')).toBeLessThan(connect.indexOf('fetch(tokenEndpoint'))
    const returned = HOOK.slice(HOOK.lastIndexOf('return {'))
    expect(returned).toContain('errorCode,')
    expect(returned).toContain('errorRedirectStationId,')
  })
})

describe('the session page, when the token route refuses the case', () => {
  it('recognises the version refusals and the station mismatch by their codes, not their sentences', () => {
    expect(SESSION).toContain('new Set([CASE_VERSION_REFUSED, STATION_MISMATCH])')
    expect(SESSION).toContain('CASE_REFUSAL_CODES.has(errorCode)')
    expect(SESSION).not.toContain('runRefusalMessage')
    expect(SESSION).not.toContain('STATION_MISMATCH_MESSAGE')
  })

  it('offers the brief (which forwards) instead of a "Try again" that can only be refused', () => {
    const screen = SESSION.slice(SESSION.indexOf('CASE_REFUSAL_CODES.has(errorCode)'))
    const end = screen.indexOf('if (error && !isConnected) {')
    const refusal = screen.slice(0, end)
    expect(refusal).toContain('errorRedirectStationId ?? stationId')
    expect(refusal).toContain('`/clinical-master/station/${briefStationId}')
    expect(refusal).not.toContain('connect()')
  })

  it('leaves every other error on the existing connection screen', () => {
    const refusalAt = SESSION.indexOf('CASE_REFUSAL_CODES.has(errorCode)')
    const genericAt = SESSION.indexOf('if (error && !isConnected) {')
    expect(refusalAt).toBeGreaterThan(0)
    expect(refusalAt).toBeLessThan(genericAt)
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
