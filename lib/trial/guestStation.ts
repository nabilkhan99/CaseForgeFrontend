import 'server-only'
import type { SupabaseClient } from '@supabase/supabase-js'

/**
 * Which case a guest consultation may open on.
 *
 * The rule, in one sentence: a guest may run one of the five free cases and
 * nothing else. `stations.is_free_trial` is what marks them, `is_active` is
 * what keeps a retired or staged one out, and there is no third way in.
 *
 * `/try/talk` takes an optional `?station=`, which is how /free and a public
 * case page say "practise THIS one". It is a REQUEST, not an instruction:
 *
 *   1. the station asked for, when it is free and active;
 *   2. otherwise the first free case, by `free_trial_order`;
 *   3. otherwise nothing — the door sends the visitor to /free?guest=unavailable.
 *
 * There is deliberately no "any active station" fallback any more. The earlier
 * version of this file had one, on the reasoning that a door which 404s because
 * a flag has not been set yet is worse than a door that opens the first case in
 * the bank. That reasoning is now wrong in the one way that costs money: the
 * guest mint spends Azure realtime minutes with no account behind them, so a
 * fallback reaching past the five would make all 200 stations free to anyone
 * who could edit a query string. An empty free list is a configuration problem
 * with a page that says so, not a licence to open the paid bank.
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

/**
 * The requested station's id, but only if a guest is allowed to run it.
 *
 * Both filters, always. `is_active` alone was the old rule and it is the one
 * that let any of the 200 cases be started anonymously; `is_free_trial` is what
 * makes this the five.
 *
 * Exported because `/api/try/create-session` needs the same question answered
 * about an explicit station id — and must REFUSE rather than silently open a
 * different case, since the client has already been told which one it asked for.
 */
export async function freeStationId(
  admin: Admin,
  stationId: string | null | undefined,
): Promise<string | null> {
  const asked = asStationId(stationId)
  if (!asked) return null

  const { data, error } = await admin
    .from('stations')
    .select('id')
    .eq('id', asked)
    .eq('is_free_trial', true)
    .eq('is_active', true)
    .maybeSingle()
  if (error) {
    console.error('[try] requested station lookup failed', error)
    return null
  }
  return (data as { id: string } | null)?.id ?? null
}

/**
 * The first free case, in the order Ishaq put them in.
 *
 * Ordered by `free_trial_order` where the column exists and by title where it
 * does not — `20260906_trial_grants.sql` adds it, and between the deploy and
 * the migration PostgREST answers a select naming it with 42703. The same
 * fail-soft `lib/trial/freeStationPicks.ts` makes, for the same reason, and it
 * has to agree with that module: the picker lists the five in this order, so a
 * bare /try/talk opening a different one would contradict the page it came from.
 */
export async function firstFreeStationId(admin: Admin): Promise<string | null> {
  const base = () =>
    admin.from('stations').select('id').eq('is_free_trial', true).eq('is_active', true)

  const ordered = await base()
    .order('free_trial_order', { ascending: true, nullsFirst: false })
    .order('title', { ascending: true })
    .limit(1)

  if (!ordered.error) {
    return (ordered.data as { id: string }[] | null)?.[0]?.id ?? null
  }
  if ((ordered.error as { code?: string }).code !== UNDEFINED_COLUMN) {
    console.error('[try] free station lookup failed', ordered.error)
    return null
  }

  const plain = await base().order('title', { ascending: true }).limit(1)
  if (plain.error) {
    console.error('[try] free station lookup failed', plain.error)
    return null
  }
  return (plain.data as { id: string }[] | null)?.[0]?.id ?? null
}

/**
 * The station a one-click guest consultation should open.
 *
 * Null when no free case is available at all, which the caller answers with
 * /free?guest=unavailable rather than by reaching for a paid station.
 */
export async function pickGuestStationId(
  admin: Admin,
  requested: string | null | undefined,
): Promise<string | null> {
  return (await freeStationId(admin, requested)) ?? (await firstFreeStationId(admin))
}

/** Everything the call screen and the reading page need, in one shape. */
export interface GuestConsultationStation {
  id: string
  title: string | null
  patient_name: string | null
  patient_age: number | null
  candidate_instructions: string | null
  reading_duration_seconds: number | null
  consultation_duration_seconds: number | null
  domain_name: string | null
}

const STATION_COLUMNS =
  'id, title, patient_name, patient_age, candidate_instructions, reading_duration_seconds, consultation_duration_seconds, domains(name)'

function toStation(row: unknown): GuestConsultationStation | null {
  if (!row) return null
  const record = row as Record<string, unknown>
  const domains = record.domains as { name?: string } | { name?: string }[] | null
  const domain = Array.isArray(domains) ? domains[0] : domains
  return {
    id: String(record.id),
    title: (record.title as string) ?? null,
    patient_name: (record.patient_name as string) ?? null,
    patient_age: (record.patient_age as number) ?? null,
    candidate_instructions: (record.candidate_instructions as string) ?? null,
    reading_duration_seconds: (record.reading_duration_seconds as number) ?? null,
    consultation_duration_seconds: (record.consultation_duration_seconds as number) ?? null,
    domain_name: domain?.name ?? null,
  }
}

/**
 * The consultation behind a guest session id.
 *
 * The call screen resolves this on the SERVER, before it paints. It used to
 * fetch `/api/try/free-cases` in the browser and pick its station out of the
 * list — which meant two round trips before `connect()` could ask for the
 * microphone, and which could only ever find the four flagged cases. Reading
 * the row also means the station comes from the database rather than from a
 * query string the visitor can edit.
 *
 * Null when there is no such session, when it belongs to an account (a signed-in
 * consultation is not opened through the guest funnel), or when its station has
 * been retired.
 */
export async function loadGuestConsultation(
  admin: Admin,
  sessionId: string,
): Promise<GuestConsultationStation | null> {
  const { data: session } = await admin
    .from('clinical_sessions')
    .select('station_id, user_id')
    .eq('id', sessionId)
    .maybeSingle()

  const row = session as { station_id: string | null; user_id: string | null } | null
  if (!row || row.user_id || !row.station_id) return null

  const { data: station } = await admin
    .from('stations')
    .select(STATION_COLUMNS)
    .eq('id', row.station_id)
    .eq('is_active', true)
    .maybeSingle()

  return toStation(station)
}

/**
 * The same station shape, straight from a station id. Used by the reading page.
 *
 * Free-only, like everything else a guest can reach. The reading page ends in a
 * "Begin Consultation" button, and `create-session` behind it refuses a station
 * outside the five — so loading a locked case here would paint a brief the
 * visitor cannot act on and a button that fails. Better that the page says the
 * case is not available than that the button does.
 */
export async function loadFreeStation(
  admin: Admin,
  stationId: string,
): Promise<GuestConsultationStation | null> {
  const asked = asStationId(stationId)
  if (!asked) return null
  const { data } = await admin
    .from('stations')
    .select(STATION_COLUMNS)
    .eq('id', asked)
    .eq('is_free_trial', true)
    .eq('is_active', true)
    .maybeSingle()
  return toStation(data)
}
