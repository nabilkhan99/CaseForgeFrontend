/**
 * The case-version rule at the server's doors: who may START or RE-RUN which
 * version of a case, and where to send someone who asked for the wrong one.
 *
 * The rule itself lives in caseVersions.ts (decideCanRun, redirectTargetFor);
 * this file only gathers what it needs on the server — the station's version
 * columns, the person's keeper rows, the live replacement of an old case — and
 * shapes the answer for a route. Callers pass the SERVICE-ROLE client: drafts
 * are invisible to every other role, and a 404 for a draft would be a lie to
 * the admin trying it out. Because the service role reads everything, the
 * userId passed in is what scopes the keeper read, so it must be the signed-in
 * user's own id.
 *
 * Cheap on purpose. Today every case is live and replaces nothing, so the gate
 * answers without a single extra query beyond the station row: keepers are
 * only read when the case is archived or is somebody's replacement, and the
 * replacement map only when an archived case is actually being refused.
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import { parseAdminEmails } from '@/lib/admin/guard';
import {
    decideCanRun,
    isStationLifecycle,
    redirectTargetFor,
    runRefusalMessage,
    type RunRefusal,
    type VersionedStation,
} from '@/lib/stations/caseVersions';
import { loadKeptStationIds, loadReplacementMap } from '@/lib/stations/caseVersionsData';
import { CASE_VERSION_REFUSED } from '@/lib/stations/caseVersionCodes';

export { CASE_VERSION_REFUSED } from '@/lib/stations/caseVersionCodes';

/** The person asking. `userId` is null for a signed-out (guest) viewer. */
export interface RunViewer {
    userId: string | null;
    isAdmin: boolean;
}

export type CaseVersionGate =
    | { allowed: true }
    | { allowed: false; reason: RunRefusal; message: string; redirectStationId: string | null };

/**
 * True when this email is on the ADMIN_EMAILS allowlist. The same allowlist
 * and normalisation as lib/admin/guard, without a second auth round trip:
 * every caller here already has the signed-in user in hand.
 */
export function isAdminEmail(email: string | null | undefined): boolean {
    const normalised = email?.trim().toLowerCase();
    if (!normalised) return false;
    return parseAdminEmails(process.env.ADMIN_EMAILS).has(normalised);
}

/**
 * A station row's version columns, narrowed. A lifecycle the module does not
 * recognise is read as a draft — FAIL CLOSED: an unknown state is runnable by
 * admins only, never by everyone.
 */
export function toVersionedStation(row: {
    id: string;
    lifecycle?: unknown;
    replaces_station_id?: unknown;
}): VersionedStation {
    return {
        id: row.id,
        lifecycle: isStationLifecycle(row.lifecycle) ? row.lifecycle : 'draft',
        replaces_station_id: typeof row.replaces_station_id === 'string' ? row.replaces_station_id : null,
    };
}

/** May this viewer run this station? With the version they should run instead when not. */
export async function gateStationRun(
    service: SupabaseClient,
    station: VersionedStation,
    viewer: RunViewer,
): Promise<CaseVersionGate> {
    if (viewer.isAdmin) return { allowed: true };

    // Keepers matter only to an archived case or to a replacement. A draft is
    // refused to every non-admin whoever they are, and a plain live case is
    // open to all: neither needs the read.
    const keeperRelevant =
        station.lifecycle === 'archived' || (station.lifecycle === 'live' && station.replaces_station_id !== null);
    const keptIds =
        keeperRelevant && viewer.userId ? await loadKeptStationIds(service, viewer.userId) : new Set<string>();

    const decision = decideCanRun(station, { keptIds, isAdmin: false });
    if (decision.allowed) return decision;

    const replacementOf =
        decision.reason === 'archived_not_kept' ? await loadReplacementMap(service, [station.id]) : new Map<string, string>();
    return {
        allowed: false,
        reason: decision.reason,
        message: runRefusalMessage(decision.reason),
        redirectStationId: redirectTargetFor(station, decision.reason, replacementOf),
    };
}

export type StationRunLookup =
    | { found: false; failed: boolean }
    | { found: true; station: VersionedStation; gate: CaseVersionGate };

/**
 * Load a station by id (service role) and gate it. `found: false` with
 * `failed: false` is an id that does not exist; `failed: true` is a read that
 * errored, which a caller must not mistake for either answer.
 */
export async function loadStationRunDecision(
    service: SupabaseClient,
    stationId: string,
    viewer: RunViewer,
): Promise<StationRunLookup> {
    const { data, error } = await service
        .from('stations')
        .select('id, lifecycle, replaces_station_id')
        .eq('id', stationId)
        .maybeSingle();
    if (error) {
        console.error('[caseVersions] station lookup failed', error);
        return { found: false, failed: true };
    }
    if (!data) return { found: false, failed: false };
    const station = toVersionedStation(data as { id: string; lifecycle: unknown; replaces_station_id: unknown });
    return { found: true, station, gate: await gateStationRun(service, station, viewer) };
}

/**
 * The JSON body of a case-version refusal. `error` is the person-facing
 * sentence (the session page's hook shows `error` as-is, as the guest lane's
 * refusals do); `code` is what a client branches on.
 */
export function caseVersionRefusalBody(gate: Extract<CaseVersionGate, { allowed: false }>) {
    return {
        error: gate.message,
        code: CASE_VERSION_REFUSED,
        reason: gate.reason,
        ...(gate.redirectStationId ? { redirectStationId: gate.redirectStationId } : {}),
    };
}

/**
 * Which case a "practise this again" link should open for this viewer: the
 * station itself when they may run it, else the version of that slot they do
 * see, else (nothing better to offer) the station itself, whose brief page
 * then explains the refusal.
 */
export async function practiseStationIdFor(
    service: SupabaseClient,
    station: VersionedStation,
    viewer: RunViewer,
): Promise<string> {
    const gate = await gateStationRun(service, station, viewer);
    if (gate.allowed) return station.id;
    return gate.redirectStationId ?? station.id;
}
