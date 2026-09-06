import { beforeEach, describe, expect, it, vi } from 'vitest'

/**
 * Marking now starts here rather than on the feedback page, so the rules about
 * *when* it starts are pinned here too. The failure this fixes is a closed tab:
 * before, the run was requested by the report's poll, so nobody who never
 * reached the report was ever marked.
 */

const mocks = vi.hoisted(() => ({
  update: vi.fn(),
  triggerMarking: vi.fn(),
  admin: { marker: 'service-role-client' },
}))

vi.mock('server-only', () => ({}))

vi.mock('@/lib/supabase/admin', () => ({
  getSupabaseAdmin: () => mocks.admin,
}))

vi.mock('@/lib/clinical-master/triggerMarking', () => ({
  triggerMarking: mocks.triggerMarking,
}))

const { POST } = await import('./route')

/** Records the write so the status transition can be asserted on. */
function stubUpdate(error: { message: string } | null = null) {
  mocks.update.mockImplementation((values: Record<string, unknown>) => {
    const builder = {
      values,
      eqs: [] as Array<[string, string]>,
      eq(column: string, value: string) {
        builder.eqs.push([column, value])
        return builder
      },
      then: (resolve: (r: unknown) => unknown) =>
        Promise.resolve({ error }).then(resolve),
    }
    return builder
  })
}

function post(body: unknown) {
  return POST({ json: async () => body } as never)
}

const TRANSCRIPT = [
  { speaker: 'candidate', text: 'What brings you in?', start_ms: 1_000 },
  { speaker: 'patient', text: 'Headaches.', start_ms: 4_000 },
]

beforeEach(() => {
  vi.clearAllMocks()
  vi.spyOn(console, 'error').mockImplementation(() => {})
  stubUpdate()
  mocks.triggerMarking.mockResolvedValue({ triggered: true })
  Object.assign(mocks.admin, { from: () => ({ update: mocks.update }) })
})

describe('POST /api/clinical-master/save-transcript', () => {
  it('starts marking on a final save', async () => {
    const response = await post({ sessionId: 'session-1', transcript: TRANSCRIPT })

    expect(await response.json()).toEqual({ status: 'processing' })
    expect(mocks.update.mock.results[0].value.values).toEqual({
      transcript: TRANSCRIPT,
      status: 'processing',
    })
    // The service-role client is handed straight down: the claim writes to a
    // row a guest session has no other way to touch.
    expect(mocks.triggerMarking).toHaveBeenCalledWith({
      admin: mocks.admin,
      sessionId: 'session-1',
    })
  })

  it('does not start marking on an interim checkpoint', async () => {
    // Interim saves land mid-consultation. Marking one would grade a
    // consultation that is still happening.
    const response = await post({
      sessionId: 'session-1',
      transcript: TRANSCRIPT,
      final: false,
    })

    expect(await response.json()).toEqual({ status: 'processing' })
    expect(mocks.update.mock.results[0].value.values).toEqual({ transcript: TRANSCRIPT })
    expect(mocks.triggerMarking).not.toHaveBeenCalled()
  })

  it('does not start marking when nothing was captured', async () => {
    // Nothing to grade. generate-feedback reports this as 'no_transcript',
    // which is a better answer than paying Azure to agree.
    await post({ sessionId: 'session-1', transcript: [] })

    expect(mocks.triggerMarking).not.toHaveBeenCalled()
  })

  it('still saves the transcript when starting marking throws', async () => {
    // The transcript is the irreplaceable half of this request; marking can be
    // retaken from the feedback page, a lost transcript cannot be recovered.
    mocks.triggerMarking.mockRejectedValue(new Error('azure unreachable'))

    const response = await post({ sessionId: 'session-1', transcript: TRANSCRIPT })

    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({ status: 'processing' })
  })

  it('does not start marking when the save itself failed', async () => {
    stubUpdate({ message: 'row is locked' })

    const response = await post({ sessionId: 'session-1', transcript: TRANSCRIPT })

    expect(response.status).toBe(500)
    expect(mocks.triggerMarking).not.toHaveBeenCalled()
  })

  it('rejects a request with no session or transcript', async () => {
    expect((await post({ transcript: TRANSCRIPT })).status).toBe(400)
    expect((await post({ sessionId: 'session-1' })).status).toBe(400)
    expect(mocks.triggerMarking).not.toHaveBeenCalled()
  })

  it('skips an empty interim save without touching the row', async () => {
    const response = await post({
      sessionId: 'session-1',
      transcript: [],
      final: false,
    })

    expect(await response.json()).toEqual({ status: 'skipped-empty' })
    expect(mocks.update).not.toHaveBeenCalled()
    expect(mocks.triggerMarking).not.toHaveBeenCalled()
  })
})
