/**
 * The wire codes the case-version gates answer with. Kept apart from
 * caseVersionsServer.ts so a client page can branch on them without pulling
 * the server-only module (service role, cookies) into its bundle.
 */

/** A refusal to run this version of a case: see caseVersionsServer.ts. */
export const CASE_VERSION_REFUSED = 'case_version_refused';

/** realtime-token: the body's station is not the session row's station. */
export const STATION_MISMATCH = 'station_mismatch';

/** realtime-token's sentence for STATION_MISMATCH (the guest lane's wording). */
export const STATION_MISMATCH_MESSAGE = 'That consultation is for a different case. Start a new one.';
