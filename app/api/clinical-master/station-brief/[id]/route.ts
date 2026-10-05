import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getSupabaseAdmin } from '@/lib/supabase/admin';
import {
  caseVersionRefusalBody,
  gateStationRun,
  isAdminEmail,
  toVersionedStation,
} from '@/lib/stations/caseVersionsServer';
import {
  STATION_BRIEF_COLUMNS,
  toStationBrief,
  type StationBriefRow,
} from '@/lib/clinical-master/stationBrief';

/**
 * The brief page's fallback read, for the versions of a case the browser
 * cannot see.
 *
 * The brief page reads `stations` in the browser, under RLS. That covers every
 * live case, which today is every case. It does not cover the two versions the
 * case-version rule (lib/stations/caseVersions.ts) cares about:
 *
 *  - a DRAFT, which only the service role can read, but which an admin must be
 *    able to open to try before approving it;
 *  - an ARCHIVED case, which RLS shows only to someone with a consultation on
 *    it, so a non-keeper following an old link sees "Station not found" when
 *    there is a replacement to send them to.
 *
 * This route reads the station with the service role and applies the same
 * gate as create-session and realtime-token (gateStationRun), so the brief and
 * the doors behind it can never disagree:
 *
 *   allowed                       → 200 { station }, exactly what the page renders
 *   wrong version, somewhere to go → 403 refusal body with redirectStationId
 *   wrong version, nowhere to go   → 403 refusal body, its sentence to show
 *   draft for a non-admin          → 404, the same answer as an id that names
 *                                    nothing, so a draft's id cannot be probed
 *
 * The page calls it only when its own read comes back empty or names a case
 * that is not plain-live, so today it is never called.
 */

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const NOT_FOUND = { error: 'Station not found', code: 'station_not_found' } as const;

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Station ids are uuids; anything else would only come back from Postgres
  // as a cast error, which is not the person's problem to read.
  const { id } = await params;
  if (!UUID_RE.test(id)) {
    return NextResponse.json(NOT_FOUND, { status: 404 });
  }

  const service = getSupabaseAdmin();
  const { data: row, error } = await service
    .from('stations')
    .select(`${STATION_BRIEF_COLUMNS}, lifecycle, replaces_station_id`)
    .eq('id', id)
    .maybeSingle();
  if (error) {
    console.error('[station-brief] station lookup failed', error);
    return NextResponse.json({ error: 'Could not load this case. Try again.' }, { status: 500 });
  }
  if (!row) {
    return NextResponse.json(NOT_FOUND, { status: 404 });
  }

  const station = row as StationBriefRow & { domain_id: string | null; lifecycle: unknown; replaces_station_id: unknown };
  const gate = await gateStationRun(service, toVersionedStation(station), {
    userId: user.id,
    isAdmin: isAdminEmail(user.email),
  });
  if (!gate.allowed) {
    // A draft is nobody's but the admins': answer as if it did not exist.
    if (gate.reason === 'draft') {
      return NextResponse.json(NOT_FOUND, { status: 404 });
    }
    return NextResponse.json(caseVersionRefusalBody(gate), { status: 403 });
  }

  // The domain's name is a label; a failed read falls back to the page's own
  // default rather than failing a brief that is otherwise ready.
  let domainName: string | null = null;
  if (station.domain_id) {
    const { data: domain } = await service
      .from('domains')
      .select('name')
      .eq('id', station.domain_id)
      .maybeSingle();
    domainName = (domain as { name?: string } | null)?.name ?? null;
  }

  return NextResponse.json({ station: toStationBrief(station, domainName) });
}
