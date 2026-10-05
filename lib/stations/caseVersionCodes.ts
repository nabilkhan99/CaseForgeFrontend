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

/**
 * The version rule could not be checked (the keeper read failed). A 503: the
 * request was fine, the answer is "try again", never a guess either way.
 */
export const CASE_VERSION_UNAVAILABLE = 'case_version_unavailable';

/** The sentence a person sees for CASE_VERSION_UNAVAILABLE. */
export const CASE_VERSION_UNAVAILABLE_MESSAGE = 'Could not check this case just now. Try again in a moment.';
