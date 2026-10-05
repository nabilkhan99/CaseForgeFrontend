import { createHash, timingSafeEqual } from 'node:crypto';
import { revalidatePath } from 'next/cache';
import { NextResponse } from 'next/server';
import { isAdmin } from '@/lib/admin/guard';
import { cookiePostRefusal } from '@/lib/admin/cookiePostGuard';

/**
 * POST /api/admin/revalidate-cases — refresh the public case surfaces now.
 *
 * The public case pages, the sitemap and /free are cached for up to an hour
 * (revalidate = 3600). When a batch of replacement cases is switched on, the
 * old addresses must start forwarding and the new cases must appear straight
 * away, not up to an hour later, so the switch-on calls this.
 *
 * Two ways in, both fail closed:
 *  - a signed-in admin (ADMIN_EMAILS, via lib/admin/guard), for a button. The
 *    session cookie is ambient, so this path also passes the CSRF guard
 *    (lib/admin/cookiePostGuard): JSON content type, and an Origin, if sent,
 *    naming this host;
 *  - `Authorization: Bearer <CASE_REVALIDATE_SECRET>`, for a CLI script that
 *    has no browser session. Compared in constant time (both sides hashed).
 *
 * ENV: CASE_REVALIDATE_SECRET — a dedicated random secret (e.g.
 * `openssl rand -hex 32`), set in Vercel and in the switch-on script's
 * environment. Deliberately NOT the Supabase service-role key: that key opens
 * the whole database, and a cache-clearing endpoint is no reason to send it
 * over the wire or keep it in a script's shell. Unset (or empty) disables the
 * bearer path entirely; the admin session still works.
 *
 * It only clears caches: no data is read or written, so the worst a caller can
 * do is make the next visitor wait for a fresh render.
 */

const REVALIDATED_PATHS: ReadonlyArray<{ path: string; type?: 'page' | 'layout' }> = [
    { path: '/sca-cases' },
    // Every case page, including the cached 404s and redirects of old slugs.
    { path: '/sca-cases/[slug]', type: 'page' },
    // Old id addresses forward to slugs; an archived id must start forwarding.
    { path: '/cases/[id]', type: 'page' },
    { path: '/sitemap.xml' },
    { path: '/free' },
];

function digest(value: string): Buffer {
    return createHash('sha256').update(value, 'utf8').digest();
}

/** True when the request carries CASE_REVALIDATE_SECRET as a bearer token. */
function hasRevalidateBearer(request: Request): boolean {
    const key = process.env.CASE_REVALIDATE_SECRET?.trim();
    if (!key) return false;

    const header = request.headers.get('authorization') ?? '';
    const match = header.match(/^Bearer\s+(.+)$/i);
    if (!match) return false;

    // Hash both sides first so the comparison is equal-length and constant-time
    // whatever the caller sent.
    return timingSafeEqual(digest(match[1].trim()), digest(key));
}

export async function POST(request: Request) {
    if (!hasRevalidateBearer(request)) {
        // The cookie path: refuse a cross-site or non-JSON request before
        // even looking at the session.
        const refusal = cookiePostRefusal(request);
        if (refusal) {
            return NextResponse.json({ error: refusal.error }, { status: refusal.status });
        }
        if (!(await isAdmin())) {
            return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
        }
    }

    try {
        for (const { path, type } of REVALIDATED_PATHS) {
            if (type) revalidatePath(path, type);
            else revalidatePath(path);
        }
    } catch (error: unknown) {
        console.error('[revalidate-cases] revalidation failed', error);
        return NextResponse.json({ error: 'Revalidation failed' }, { status: 500 });
    }

    return NextResponse.json({ revalidated: REVALIDATED_PATHS.map(({ path }) => path) });
}
