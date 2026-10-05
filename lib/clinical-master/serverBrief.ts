/**
 * The server's view of a case (GET /api/clinical-master/station-brief/[id]),
 * for the versions of a case the browser's own read cannot see: a DRAFT (only
 * the service role reads it; an admin must be able to try it) and an ARCHIVED
 * case the person is not marked on. The route applies the same version rule
 * as create-session and realtime-token, so its answer is one of:
 *
 *   brief       the case to show/run, in StationBrief shape
 *   forward     the version of this slot the person does see
 *   refused     the rule's sentence, when there is nowhere to forward
 *   unavailable anything else (not found, signed out, a failed request, or
 *               the 503 "try again" when the rule could not be checked)
 *
 * Shared by the brief page and the live session page so the two can never
 * read the same answer differently. Browser-safe: fetch and a wire code only.
 */

import { CASE_VERSION_REFUSED } from '@/lib/stations/caseVersionCodes';
import type { StationBrief } from '@/lib/clinical-master/stationBrief';

export type ServerBrief =
    | { kind: 'brief'; station: StationBrief }
    | { kind: 'forward'; target: string }
    | { kind: 'refused'; message: string }
    | { kind: 'unavailable' };

export async function fetchServerBrief(
    stationId: string,
    fetcher: typeof fetch = fetch,
): Promise<ServerBrief> {
    try {
        const res = await fetcher(`/api/clinical-master/station-brief/${encodeURIComponent(stationId)}`);
        const body = await res.json().catch(() => null);
        if (res.ok && body?.station) return { kind: 'brief', station: body.station as StationBrief };
        if (body?.code === CASE_VERSION_REFUSED) {
            const target = typeof body.redirectStationId === 'string' ? body.redirectStationId : null;
            if (target && target !== stationId) return { kind: 'forward', target };
            return {
                kind: 'refused',
                message: typeof body.error === 'string' ? body.error : 'This case is not available.',
            };
        }
    } catch {
        // Network failure: treated as no answer, below.
    }
    return { kind: 'unavailable' };
}
