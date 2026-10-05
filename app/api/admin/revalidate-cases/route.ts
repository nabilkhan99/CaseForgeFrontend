import { createHash, timingSafeEqual } from 'node:crypto';
import { revalidatePath } from 'next/cache';
import { NextResponse } from 'next/server';
import { isAdmin } from '@/lib/admin/guard';

/**
 * POST /api/admin/revalidate-cases — refresh the public case surfaces now.
 *
 * The public case pages, the sitemap and /free are cached for up to an hour
 * (revalidate = 3600). When a batch of replacement cases is switched on, the
 * old addresses must start forwarding and the new cases must appear straight
 * away, not up to an hour later, so the switch-on calls this.
 *
 * Two ways in, both fail closed:
 *  - a signed-in admin (ADMIN_EMAILS, via lib/admin/guard), for a button;
 *  - `Authorization: Bearer <SUPABASE_SERVICE_ROLE_KEY>`, for a CLI script that
 *    has no browser session. Compared in constant time; an unset key never
 *    matches anything.
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

/** True when the request carries the service-role key as a bearer token. */
function hasServiceRoleBearer(request: Request): boolean {
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!key) return false;

    const header = request.headers.get('authorization') ?? '';
    const match = header.match(/^Bearer\s+(.+)$/i);
    if (!match) return false;

    // Hash both sides first so the comparison is equal-length and constant-time
    // whatever the caller sent.
    return timingSafeEqual(digest(match[1].trim()), digest(key));
}

export async function POST(request: Request) {
    const allowed = hasServiceRoleBearer(request) || (await isAdmin());
    if (!allowed) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
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
