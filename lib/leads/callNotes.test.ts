import { describe, expect, it, vi } from 'vitest'

vi.mock('server-only', () => ({}))

const { buildRequestBody, CallNotesUnavailableError, chatConfigFromEnv, draftCallNotes } = await import('./callNotes')

const NOW = new Date('2026-10-04T10:45:00Z')
const INPUT = {
  notes: 'no answer',
  lead: { name: null, examOnFile: null, trial: null, consultations: 0, passes: 0, earlierCalls: [] },
  now: NOW,
}
const CONFIG = { endpoint: 'https://example.openai.azure.com', apiKey: 'test-key', deployment: 'gpt-5.4-mini', apiVersion: '2025-01-01-preview' }

const completion = (content: string) =>
  new Response(JSON.stringify({ choices: [{ message: { content } }] }), { status: 200 })

const GOOD = JSON.stringify({
  outcome: 'no_answer',
  points: [],
  facts: { first_name: null, exam: null, competitors: [], intent: 'unknown' },
  next_step: null,
})

describe('chatConfigFromEnv', () => {
  it('needs an endpoint, key and deployment', () => {
    expect(chatConfigFromEnv({ AZURE_OPENAI_CHAT_ENDPOINT: 'https://x.openai.azure.com/' } as unknown as NodeJS.ProcessEnv)).toBeNull()
    expect(
      chatConfigFromEnv({
        AZURE_OPENAI_CHAT_ENDPOINT: 'https://x.openai.azure.com/',
        AZURE_OPENAI_CHAT_API_KEY: 'k',
        AZURE_OPENAI_CHAT_DEPLOYMENT: 'gpt-5.4-mini',
      } as unknown as NodeJS.ProcessEnv),
    ).toEqual({ endpoint: 'https://x.openai.azure.com', apiKey: 'k', deployment: 'gpt-5.4-mini', apiVersion: '2025-01-01-preview' })
  })
})

describe('buildRequestBody', () => {
  it('asks a reasoning model for low effort and no temperature', () => {
    const body = buildRequestBody(INPUT, 'gpt-5.4-mini')
    expect(body).toMatchObject({ reasoning_effort: 'low', max_completion_tokens: 4000 })
    expect(body).not.toHaveProperty('temperature')
  })

  it('gives an older model a low temperature instead', () => {
    expect(buildRequestBody(INPUT, 'gpt-4.1-mini')).toMatchObject({ temperature: 0.2, max_tokens: 1200 })
  })

  it('demands strict structured output', () => {
    expect(buildRequestBody(INPUT, 'gpt-5.4-mini').response_format).toMatchObject({
      type: 'json_schema',
      json_schema: { name: 'call_record', strict: true },
    })
  })
})

describe('draftCallNotes', () => {
  it('posts to the deployment with the key in a header and returns the parsed draft', async () => {
    const fetchImpl = vi.fn(async () => completion(GOOD))
    const draft = await draftCallNotes(INPUT, CONFIG, { fetchImpl })
    expect(draft).toMatchObject({ outcome: 'no_answer', model: 'gpt-5.4-mini' })
    const [url, init] = fetchImpl.mock.calls[0] as unknown as [string, RequestInit]
    expect(url).toBe('https://example.openai.azure.com/openai/deployments/gpt-5.4-mini/chat/completions?api-version=2025-01-01-preview')
    expect((init.headers as Record<string, string>)['api-key']).toBe('test-key')
  })

  it('reports a busy model in words the caller can act on', async () => {
    const fetchImpl = vi.fn(async () => new Response('slow down', { status: 429 }))
    vi.spyOn(console, 'error').mockImplementation(() => {})
    await expect(draftCallNotes(INPUT, CONFIG, { fetchImpl })).rejects.toThrow('The AI is busy. Try again in a minute.')
  })

  it('gives up cleanly when the model is too slow', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    const fetchImpl = vi.fn(
      (_url: string, init?: RequestInit) =>
        new Promise<Response>((_resolve, reject) => {
          init?.signal?.addEventListener('abort', () => reject(Object.assign(new Error('aborted'), { name: 'AbortError' })))
        }),
    )
    await expect(draftCallNotes(INPUT, CONFIG, { fetchImpl: fetchImpl as unknown as typeof fetch, timeoutMs: 10 })).rejects.toThrow(
      'The AI took too long. Try again.',
    )
  })

  it('turns an unusable reply into an error, not a broken draft', async () => {
    const fetchImpl = vi.fn(async () => completion('{"outcome":"perhaps"}'))
    await expect(draftCallNotes(INPUT, CONFIG, { fetchImpl })).rejects.toBeInstanceOf(CallNotesUnavailableError)
  })
})
