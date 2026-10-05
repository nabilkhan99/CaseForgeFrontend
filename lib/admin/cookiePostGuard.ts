/**
 * CSRF guard for POSTs that a browser session (the Supabase auth cookie)
 * authorises: the admin case-review sign-off and the admin path of
 * revalidate-cases.
 *
 * The cookie rides along on any request the browser makes to this origin,
 * including one a third-party page triggers with a plain HTML form. Two cheap
 * checks close that door without a token round trip:
 *
 *  - CONTENT-TYPE MUST BE application/json. A cross-site form can only send
 *    text/plain, multipart/form-data or application/x-www-form-urlencoded; a
 *    cross-site fetch with application/json triggers a CORS preflight, which
 *    this app never answers with permission. Our own callers already send JSON.
 *  - AN Origin HEADER, WHEN PRESENT, MUST NAME THIS HOST. Browsers send Origin
 *    on every cross-site POST, so a mismatch (or the opaque "null") is refused.
 *    An absent Origin is allowed: same-origin requests from older browsers and
 *    non-browser callers omit it, and neither can carry a victim's cookie for
 *    a cross-site attack.
 *
 * Pure: takes the request, returns the refusal to send or null to carry on.
 * Not for bearer-token paths: a token is not ambient, so CSRF does not apply.
 */

export interface CookiePostRefusal {
    status: 403 | 415;
    error: string;
}

function isJson(contentType: string | null): boolean {
    if (!contentType) return false;
    return contentType.split(';')[0].trim().toLowerCase() === 'application/json';
}

/** The host the browser addressed: the Host header, else the URL's own. */
function requestHost(request: Request): string {
    const header = request.headers.get('host');
    if (header) return header.trim().toLowerCase();
    return new URL(request.url).host.toLowerCase();
}

function originHost(origin: string): string | null {
    try {
        return new URL(origin).host.toLowerCase();
    } catch {
        return null;
    }
}

export function cookiePostRefusal(request: Request): CookiePostRefusal | null {
    const origin = request.headers.get('origin');
    if (origin !== null) {
        const host = originHost(origin);
        if (!host || host !== requestHost(request)) {
            return { status: 403, error: 'Cross-site request refused.' };
        }
    }
    if (!isJson(request.headers.get('content-type'))) {
        return { status: 415, error: 'Send this request as JSON.' };
    }
    return null;
}
