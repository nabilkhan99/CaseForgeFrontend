import { describe, expect, it, vi } from 'vitest'
import { fetchServerBrief } from './serverBrief'

/** How the brief and session pages read the station-brief route's answers. */

function answer(status: number, body: unknown) {
  return vi.fn(async () => new Response(JSON.stringify(body), { status })) as unknown as typeof fetch
}

const BRIEF = {
  id: 'D',
  title: 'Draft case',
  patient_name: 'Sam Patel',
  candidate_instructions: 'Read the notes.',
  reading_duration_seconds: 180,
  consultation_duration_seconds: 600,
  domain_name: 'Older adults',
}

describe('fetchServerBrief', () => {
  it('returns the brief, with everything the session page needs to connect', async () => {
    const fetcher = answer(200, { station: BRIEF })
    const result = await fetchServerBrief('D', fetcher)
    expect(result).toEqual({ kind: 'brief', station: BRIEF })
    expect(fetcher).toHaveBeenCalledWith('/api/clinical-master/station-brief/D')
  })

  it('forwards to the version the route names', async () => {
    const result = await fetchServerBrief('OLD', answer(403, { code: 'case_version_refused', error: 'x', redirectStationId: 'NEW' }))
    expect(result).toEqual({ kind: 'forward', target: 'NEW' })
  })

  it('is a refusal with the sentence when there is nowhere to forward', async () => {
    const result = await fetchServerBrief('GONE', answer(403, { code: 'case_version_refused', error: 'Replaced.' }))
    expect(result).toEqual({ kind: 'refused', message: 'Replaced.' })
  })

  it('is unavailable for a 404, a 503 try-again and a network failure', async () => {
    expect(await fetchServerBrief('X', answer(404, { code: 'station_not_found' }))).toEqual({ kind: 'unavailable' })
    expect(await fetchServerBrief('X', answer(503, { code: 'case_version_unavailable' }))).toEqual({ kind: 'unavailable' })
    const broken = vi.fn(async () => {
      throw new Error('offline')
    }) as unknown as typeof fetch
    expect(await fetchServerBrief('X', broken)).toEqual({ kind: 'unavailable' })
  })
})
