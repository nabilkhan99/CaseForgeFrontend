import 'server-only'
import type { SupabaseClient } from '@supabase/supabase-js'

/**
 * Which case a one-click guest consultation opens on.
 *
 * `/try/talk` takes an optional `?station=`, which is how a public case page
 * says "practise THIS one". Everything else — the landing page's "talk to a
 * patient first", a bare link, a link whose station has since been retired —
 * has to land on something sensible without asking the visitor to choose,
 * because the whole point of this door is that there is no picker.
 *
 * Three steps, in order:
 *
 *   1. the station asked for, if it is active;
 *   2. otherwise the first recommended "Start here" case, by `free_trial_order`;
 *   3. otherwise any active case at all.
 *
 * Step 3 is not a nicety. Until Ishaq picks the five, `is_free_trial` may be
 * carried by nothing at all on a given deployment, and a door that 404s because
 * a flag has not been set yet is worse than a door that opens the first case in
 * the bank.
 *
 * ALWAYS `is_active = true`, never `visibleStationStates()`: the guest funnel
 * and the public case pages show the live bank only (see
 * lib/stations/visibility.ts), so a staged station cannot be reached by an
 * anonymous link on a preview deployment.
 */

/** PostgREST's "column does not exist", which is the pre-migration state. */
const UNDEFINED_COLUMN = '42703'

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/**
 * A `?station=` that is not a UUID is dropped rather than passed to PostgREST,
 * which answers a malformed uuid comparison with a 400 rather than no rows.
 */
export function asStationId(raw: string | null | undefined): string | null {
  const value = raw?.trim()
  return value && UUID_RE.test(value) ? value : null
}

type Admin = SupabaseClient

async function requestedStation(admin: Admin, stationId: string): Promise<string | null> {
  const { data, error } = await admin
    .from('stations')
    .select('id')
    .eq('id', stationId)
    .eq('is_active', true)
    .maybeSingle()
  if (error) {
    console.error('[try/talk] requested station lookup failed', error)
    return null
  }
  return (data as { id: string } | null)?.id ?? null
}

/**
 * The first "Start here" case.
 *
 * Ordered by `free_trial_order` where the column exists and by title where it
 * does not — `20260906_trial_grants.sql` adds it, and between the deploy and
 * the migration PostgREST answers a select naming it with 42703. The same
 * fail-soft `lib/supabase/queries/trialStations.ts` makes, for the same reason,
 * and here it matters more: this is a door, not a section of a page.
 */
async function firstRecommended(admin: Admin): Promise<string | null> {
  const ordered = await admin
    .from('stations')
    .select('id')
    .eq('is_free_trial', true)
    .eq('is_active', true)
    .order('free_trial_order', { ascending: true, nullsFirst: false })
    .order('title', { ascending: true })
    .limit(1)

  if (!ordered.error) {
    return (ordered.data as { id: string }[] | null)?.[0]?.id ?? null
  }
  if ((ordered.error as { code?: string }).code !== UNDEFINED_COLUMN) {
    console.error('[try/talk] recommended station lookup failed', ordered.error)
  }

  const plain = await admin
    .from('stations')
    .select('id')
    .eq('is_free_trial', true)
    .eq('is_active', true)
    .order('title', { ascending: true })
    .limit(1)
  return (plain.data as { id: string }[] | null)?.[0]?.id ?? null
}

async function anyActive(admin: Admin): Promise<string | null> {
  const { data } = await admin
    .from('stations')
    .select('id')
    .eq('is_active', true)
    .order('title', { ascending: true })
    .limit(1)
  return (data as { id: string }[] | null)?.[0]?.id ?? null
}

/** The station a one-click consultation should open, or null if the bank is empty. */
export async function pickGuestStationId(
  admin: Admin,
  requested: string | null | undefined,
): Promise<string | null> {
  const asked = asStationId(requested)
  if (asked) {
    const found = await requestedStation(admin, asked)
    if (found) return found
  }
  return (await firstRecommended(admin)) ?? (await anyActive(admin))
}
