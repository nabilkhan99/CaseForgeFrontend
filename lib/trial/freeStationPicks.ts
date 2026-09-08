import type { SupabaseClient } from '@supabase/supabase-js'

/**
 * The five cases /free offers, in the order Ishaq put them in.
 *
 * `/free` is a picker now rather than a form: the consultation is the call to
 * action, and identity is asked for at the reveal after the first station. So
 * the page's whole job is to name five cases well enough that one of them is
 * obviously worth twelve minutes, and this module is what it names them from.
 *
 * Deliberately a peer of `lib/trial/guestStation.ts` rather than part of it.
 * That module answers "which ONE station does a bare /try/talk open", which is
 * a door's fallback chain; this one answers "which five are on offer, and what
 * does each row say", which is a page's content. They read the same flag and
 * must not diverge on the ordering — hence the same `free_trial_order` /
 * `title` pair, and the same fail-soft when the column is not there yet.
 *
 * No `import 'server-only'`: this takes an admin client as an argument and
 * holds no secret of its own, so `PickerStation` can be imported as a type by
 * the client component that renders the list.
 */

/** PostgREST's "column does not exist" — the pre-migration state. */
const UNDEFINED_COLUMN = '42703'

/** What a station runs for when the row does not say. Every SCA case is 12. */
export const DEFAULT_STATION_MINUTES = 12

/**
 * The modality that is worth calling out on a row.
 *
 * Video is the SCA default and saying so on four rows out of five would be
 * noise; a telephone case is the one a trainee might deliberately pick, or
 * deliberately avoid, so it is the one that gets a word.
 */
const TELEPHONE = 'telephone'

const COLUMNS = 'id, title, consultation_type, consultation_duration_seconds, domains(name)'

/** One row of the picker: everything the list renders, already resolved. */
export interface PickerStation {
  id: string
  /** The hook. The station title is written as a one-line presentation. */
  title: string
  /** "<domain> · 12 min", plus " · telephone" when it is a phone call. */
  meta: string
  href: string
}

/**
 * Where a "Start" button goes. One place, so the list and its test agree.
 *
 * /free/start, not the retired one-click guest door: every free station is sat
 * inside an account now, and the station rides through the sign-up in the query
 * so the trainee lands on the case they clicked rather than on a dashboard.
 */
export function startHref(stationId: string): string {
  return `/free/start?station=${encodeURIComponent(stationId)}`
}

/** Whole minutes from a duration in seconds, falling back to the SCA's twelve. */
export function stationMinutes(seconds: unknown): number {
  const value = typeof seconds === 'number' ? seconds : Number(seconds)
  if (!Number.isFinite(value) || value <= 0) return DEFAULT_STATION_MINUTES
  return Math.max(1, Math.round(value / 60))
}

/** PostgREST returns an embedded one-to-one as an object or a one-element array. */
function domainName(embedded: unknown): string | null {
  const value = Array.isArray(embedded) ? embedded[0] : embedded
  const name = (value as { name?: unknown } | null | undefined)?.name
  return typeof name === 'string' && name.trim() !== '' ? name.trim() : null
}

/** The line under a title: where the case sits, how long it runs, how it runs. */
export function stationMeta(row: unknown): string {
  const record = (row ?? {}) as Record<string, unknown>
  const parts: string[] = []

  const domain = domainName(record.domains)
  if (domain) parts.push(domain)

  parts.push(`${stationMinutes(record.consultation_duration_seconds)} min`)

  if (String(record.consultation_type ?? '').toLowerCase() === TELEPHONE) {
    parts.push(TELEPHONE)
  }

  return parts.join(' · ')
}

/**
 * Database rows to picker rows, in the order they arrived.
 *
 * Ordering belongs to the query — `free_trial_order`, which is the whole point
 * of the column — so this preserves it rather than re-sorting. A row with no
 * title is dropped: the title IS the row here, and a station offering a bare
 * "Start" button next to nothing is worse than four stations.
 */
export function toPickerStations(rows: unknown): PickerStation[] {
  if (!Array.isArray(rows)) return []

  const stations: PickerStation[] = []
  for (const row of rows) {
    const record = (row ?? {}) as Record<string, unknown>
    const id = typeof record.id === 'string' ? record.id : null
    const title = typeof record.title === 'string' ? record.title.trim() : ''
    if (!id || title === '') continue
    stations.push({ id, title, meta: stationMeta(record), href: startHref(id) })
  }
  return stations
}

/**
 * The stations flagged `is_free_trial`, ordered by `free_trial_order`.
 *
 * ALWAYS `is_active = true`, never `visibleStationStates()`: /free is the
 * public mouth of the guest funnel, so a staged station must not be reachable
 * from it on a preview deployment (see lib/stations/visibility.ts).
 *
 * Fails soft twice over, because this is a page's only content:
 *
 *   - `free_trial_order` does not exist until 20260906_trial_grants.sql is
 *     applied, and PostgREST answers a select ordering on it with 42703. The
 *     retry drops the clause and orders by title, so between a deploy and its
 *     migration the picker lists the same five in a different order rather
 *     than showing nothing.
 *   - Anything else returns an empty list. The page has a line for that; a
 *     throw would be a 500 on the most-linked page on the site.
 */
export async function listFreeStations(admin: SupabaseClient): Promise<PickerStation[]> {
  const base = () => admin.from('stations').select(COLUMNS).eq('is_free_trial', true).eq('is_active', true)

  const ordered = await base()
    // Nulls last, so a station flagged but not yet ordered still appears —
    // after the ordered ones — rather than jumping the queue or vanishing.
    .order('free_trial_order', { ascending: true, nullsFirst: false })
    .order('title', { ascending: true })

  if (!ordered.error) return toPickerStations(ordered.data)

  if ((ordered.error as { code?: string }).code !== UNDEFINED_COLUMN) {
    console.error('[free] station list failed', ordered.error)
    return []
  }

  const plain = await base().order('title', { ascending: true })
  if (plain.error) {
    console.error('[free] station list failed', plain.error)
    return []
  }
  return toPickerStations(plain.data)
}
