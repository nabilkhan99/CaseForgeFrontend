import 'server-only'

import { buildCallNotesUserMessage, CALL_NOTES_SCHEMA, CALL_NOTES_SYSTEM_PROMPT, type CallNotesInput } from './callNotesPrompt'
import { DraftParseError, parseCallDraft } from './callNotesParse'
import type { CallDraft } from './types'

/**
 * Ask Azure OpenAI to tidy one call's notes. Server-only: the key never
 * reaches a browser.
 *
 * Uses the chat model on the backend's Azure resource (the one marking and
 * the portfolio tool already use), with strict structured outputs. Admin use
 * only, two callers, so there is no retry loop: a failure comes back to the
 * caller as an error they can retry, or they save the notes as written.
 */

export const DEFAULT_API_VERSION = '2025-01-01-preview'
/** Well inside the route's maxDuration, so a slow model fails cleanly instead of being killed. */
export const DEFAULT_TIMEOUT_MS = 25_000

export interface ChatConfig {
  endpoint: string
  apiKey: string
  deployment: string
  apiVersion: string
}

/** The AI could not produce a draft. The message is safe to show the caller. */
export class CallNotesUnavailableError extends Error {}

export function chatConfigFromEnv(env: NodeJS.ProcessEnv = process.env): ChatConfig | null {
  const endpoint = env.AZURE_OPENAI_CHAT_ENDPOINT?.trim().replace(/\/+$/, '')
  const apiKey = env.AZURE_OPENAI_CHAT_API_KEY?.trim()
  const deployment = env.AZURE_OPENAI_CHAT_DEPLOYMENT?.trim()
  if (!endpoint || !apiKey || !deployment) return null
  return { endpoint, apiKey, deployment, apiVersion: env.AZURE_OPENAI_CHAT_API_VERSION?.trim() || DEFAULT_API_VERSION }
}

/** Reasoning models (gpt-5, o-series) reject temperature and max_tokens. */
function isReasoningModel(deployment: string): boolean {
  return /^(gpt-5|o\d)/i.test(deployment)
}

export function buildRequestBody(input: CallNotesInput, deployment: string): Record<string, unknown> {
  const tuning = isReasoningModel(deployment)
    ? { max_completion_tokens: 4000, reasoning_effort: 'low' }
    : { max_tokens: 1200, temperature: 0.2 }
  return {
    messages: [
      { role: 'system', content: CALL_NOTES_SYSTEM_PROMPT },
      { role: 'user', content: buildCallNotesUserMessage(input) },
    ],
    response_format: {
      type: 'json_schema',
      json_schema: { name: 'call_record', strict: true, schema: CALL_NOTES_SCHEMA },
    },
    ...tuning,
  }
}

interface ChatCompletion {
  choices?: Array<{ message?: { content?: string | null; refusal?: string | null } }>
}

export async function draftCallNotes(
  input: CallNotesInput,
  config: ChatConfig,
  options: { fetchImpl?: typeof fetch; timeoutMs?: number } = {},
): Promise<CallDraft> {
  const fetchImpl = options.fetchImpl ?? fetch
  const url = `${config.endpoint}/openai/deployments/${encodeURIComponent(config.deployment)}/chat/completions?api-version=${encodeURIComponent(config.apiVersion)}`
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), options.timeoutMs ?? DEFAULT_TIMEOUT_MS)

  let response: Response
  try {
    response = await fetchImpl(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'api-key': config.apiKey },
      body: JSON.stringify(buildRequestBody(input, config.deployment)),
      signal: controller.signal,
    })
  } catch (error: unknown) {
    const timedOut = error instanceof Error && error.name === 'AbortError'
    console.error('[lead-call-notes] request failed', timedOut ? 'timeout' : error)
    throw new CallNotesUnavailableError(timedOut ? 'The AI took too long. Try again.' : 'Could not reach the AI.')
  } finally {
    clearTimeout(timer)
  }

  if (!response.ok) {
    console.error('[lead-call-notes] azure error', response.status, (await response.text().catch(() => '')).slice(0, 300))
    throw new CallNotesUnavailableError(response.status === 429 ? 'The AI is busy. Try again in a minute.' : 'The AI returned an error.')
  }

  const completion = (await response.json().catch(() => ({}))) as ChatCompletion
  const message = completion.choices?.[0]?.message
  if (!message?.content) {
    throw new CallNotesUnavailableError(message?.refusal ? 'The AI declined to read those notes.' : 'The AI returned nothing.')
  }
  try {
    return parseCallDraft(message.content, config.deployment, input.now)
  } catch (error: unknown) {
    if (error instanceof DraftParseError) throw new CallNotesUnavailableError(error.message)
    throw error
  }
}
