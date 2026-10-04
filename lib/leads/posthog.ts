import 'server-only'

import type { BrowsingData } from './assemble'
import type { Signals } from './heat'

/**
 * Browsing signals for the lead list, from PostHog's HogQL API. Optional: with
 * no `POSTHOG_PERSONAL_API_KEY` the list works without them and says so.
 *
 * A PostHog person is a browser, not a human (identify() is never called);
 * emails ride on the gate and trial events, which is how a browser is tied to
 * a lead. Same queries as the customer-lead-report skill's collector,
 * including its two hard-won fixes: an explicit LIMIT (HogQL silently returns
 * 100 rows without one) and coalescing to '' before comparing (HogQL treats
 * NULL != '' as true and would sweep every anonymous browser in).
 */

const SINCE = "toDateTime('2026-05-01 00:00:00')"
const LIMIT = 10_000
const CACHE_MS = 10 * 60_000
const TIMEOUT_MS = 15_000

interface PostHogConfig {
  host: string
  projectId: string
  apiKey: string
}

let cache: { at: number; data: BrowsingData } | null = null

export function posthogConfigFromEnv(env: NodeJS.ProcessEnv = process.env): PostHogConfig | null {
  const apiKey = env.POSTHOG_PERSONAL_API_KEY?.trim()
  const projectId = env.POSTHOG_PROJECT_ID?.trim()
  if (!apiKey || !projectId) return null
  return { apiKey, projectId, host: (env.POSTHOG_HOST?.trim() || 'https://us.posthog.com').replace(/\/+$/, '') }
}

async function hogql(config: PostHogConfig, query: string): Promise<{ columns: string[]; results: unknown[][] }> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS)
  try {
    const response = await fetch(`${config.host}/api/projects/${encodeURIComponent(config.projectId)}/query/`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${config.apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ query: { kind: 'HogQLQuery', query } }),
      signal: controller.signal,
      cache: 'no-store',
    })
    if (!response.ok) throw new Error(`PostHog ${response.status}`)
    const body = (await response.json()) as { columns?: string[]; results?: unknown[][] }
    if (!body.columns || !body.results) throw new Error('PostHog returned no results')
    if (body.results.length >= LIMIT) throw new Error('PostHog hit the row limit')
    return { columns: body.columns, results: body.results }
  } finally {
    clearTimeout(timer)
  }
}

const toNumber = (value: unknown): number => (typeof value === 'number' ? value : Number(value) || 0)

function toSignals(row: Record<string, unknown>): Signals {
  const lastSeen = typeof row.last_seen_utc === 'string' && row.last_seen_utc ? `${row.last_seen_utc.replace(' ', 'T')}Z` : null
  return {
    pricingViews: toNumber(row.pricing_views),
    billingToggles: toNumber(row.billing_toggles),
    checkoutStarts: toNumber(row.checkout_starts),
    paywallHits: toNumber(row.paywall_hits),
    guideViews: toNumber(row.guide_views),
    casebankViews: toNumber(row.casebank_views),
    studyBudget: toNumber(row.study_budget),
    portfolioCases: toNumber(row.portfolio_cases),
    guestSessions: toNumber(row.guest_sessions),
    activeDays: toNumber(row.active_days),
    lastSeen: lastSeen && Number.isFinite(Date.parse(lastSeen)) ? new Date(lastSeen).toISOString() : null,
  }
}

async function fetchBrowsing(config: PostHogConfig): Promise<BrowsingData> {
  const map = await hogql(
    config,
    `SELECT lower(coalesce(properties.email, properties.user_email, '')) AS e, groupUniqArray(toString(person_id))
     FROM events WHERE coalesce(properties.email, properties.user_email, '') != '' AND timestamp >= ${SINCE}
     GROUP BY e LIMIT ${LIMIT}`,
  )
  const pidsByEmail = new Map<string, string[]>()
  for (const [email, pids] of map.results) {
    if (typeof email === 'string' && email && Array.isArray(pids)) pidsByEmail.set(email, pids.map(String))
  }
  const ids = [...new Set([...pidsByEmail.values()].flat())].filter((id) => /^[0-9a-f-]{36}$/i.test(id))
  if (ids.length === 0) return { pidsByEmail, byBrowser: new Map() }

  const signals = await hogql(
    config,
    `SELECT toString(person_id) AS pid,
       toString(toTimeZone(max(timestamp), 'UTC')) AS last_seen_utc,
       uniq(toDate(toTimeZone(timestamp, 'Europe/London'))) AS active_days,
       countIf(event = 'pricing_viewed') AS pricing_views,
       countIf(event = 'pricing_billing_toggled') AS billing_toggles,
       countIf(event = 'checkout_started') AS checkout_starts,
       countIf(event = 'trial_wall_hit') AS paywall_hits,
       countIf(event = '$pageview' AND properties.$pathname LIKE '/guides%') AS guide_views,
       countIf(event = '$pageview' AND properties.$pathname LIKE '/sca-cases%') AS casebank_views,
       countIf(event = '$pageview' AND (properties.$pathname LIKE '/study-budget%' OR properties.$pathname LIKE '/course-spec%'))
         + countIf(event LIKE 'study_budget%') AS study_budget,
       countIf(event = 'case_submitted') AS portfolio_cases,
       uniqIf(properties.$pathname, event = '$pageview' AND properties.$pathname LIKE '/try/session/%') AS guest_sessions
     FROM events
     WHERE person_id IN (${ids.map((id) => `'${id}'`).join(',')}) AND timestamp >= ${SINCE}
     GROUP BY pid LIMIT ${LIMIT}`,
  )
  const byBrowser = new Map<string, Signals>()
  for (const values of signals.results) {
    const row = Object.fromEntries(signals.columns.map((column, i) => [column, values[i]]))
    byBrowser.set(String(row.pid), toSignals(row))
  }
  return { pidsByEmail, byBrowser }
}

/**
 * Browsing data, cached for ten minutes per server instance. Null when PostHog
 * is not configured or fails: the list is still useful without it.
 */
export async function loadBrowsing(now: Date = new Date(), fresh = false): Promise<BrowsingData | null> {
  const config = posthogConfigFromEnv()
  if (!config) return null
  if (!fresh && cache && now.getTime() - cache.at < CACHE_MS) return cache.data
  try {
    const data = await fetchBrowsing(config)
    cache = { at: now.getTime(), data }
    return data
  } catch (error: unknown) {
    console.error('[admin-leads] posthog unavailable', error instanceof Error ? error.message : error)
    return cache?.data ?? null
  }
}
