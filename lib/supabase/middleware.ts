import { createServerClient } from '@supabase/ssr';
import { computeEntitlement } from '@/lib/commerce/entitlements';
import { isStagedDeployment } from '@/lib/stations/visibility';
import { parseAdminEmails } from '@/lib/admin/guard';
import { NextResponse, type NextRequest } from 'next/server';

/** Carries a valid sign-up invite through the registration flow. */
const SIGNUP_INVITE_COOKIE = 'ff_signup_invite';

/** One hour — long enough to register, short enough not to linger. */
const SIGNUP_INVITE_MAX_AGE = 60 * 60;

export async function updateSession(request: NextRequest) {
    let supabaseResponse = NextResponse.next({
        request,
    });

    const supabase = createServerClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
        {
            cookies: {
                getAll() {
                    return request.cookies.getAll();
                },
                setAll(cookiesToSet) {
                    cookiesToSet.forEach(({ name, value }) =>
                        request.cookies.set(name, value)
                    );
                    supabaseResponse = NextResponse.next({
                        request,
                    });
                    cookiesToSet.forEach(({ name, value, options }) =>
                        supabaseResponse.cookies.set(name, value, options)
                    );
                },
            },
        }
    );

    // Refresh session
    const {
        data: { user },
    } = await supabase.auth.getUser();

    // Preorder state: no self-serve account creation yet. The free-station
    // funnel (/try) is open, but sign-up stays gated until product launch —
    // with one deliberate exception: an invite code. Hitting
    // `/auth/sign-up?invite=<SIGNUP_INVITE_CODE>` opens registration for that
    // visitor (a short-lived cookie carries them through the flow, so a reload
    // or a bounce to sign-in and back doesn't lock them out again). Lets us give
    // teammates and early testers accounts without opening public registration.
    // Fails closed: with SIGNUP_INVITE_CODE unset, sign-up stays shut for everyone.
    if (request.nextUrl.pathname === '/auth/sign-up') {
        const inviteCode = process.env.SIGNUP_INVITE_CODE;
        const provided = request.nextUrl.searchParams.get('invite');
        const cookied = request.cookies.get(SIGNUP_INVITE_COOKIE)?.value;
        const invited = Boolean(inviteCode) && (provided === inviteCode || cookied === inviteCode);

        if (!invited) {
            const url = request.nextUrl.clone();
            url.pathname = '/';
            return NextResponse.redirect(url);
        }

        // Arrived with a valid code in the URL — remember it briefly so the rest
        // of the sign-up flow works without the query string.
        if (provided === inviteCode && cookied !== inviteCode) {
            supabaseResponse.cookies.set(SIGNUP_INVITE_COOKIE, inviteCode!, {
                httpOnly: true,
                secure: process.env.NODE_ENV === 'production',
                sameSite: 'lax',
                path: '/',
                maxAge: SIGNUP_INVITE_MAX_AGE,
            });
        }
    }

    // Protected routes - redirect to sign-in if not authenticated
    const isProtectedRoute = (request.nextUrl.pathname.startsWith('/dashboard') ||
        request.nextUrl.pathname.startsWith('/clinical-master')) &&
        !request.nextUrl.pathname.startsWith('/try');

    if (isProtectedRoute && !user) {
        const url = request.nextUrl.clone();
        url.pathname = '/auth/sign-in';
        url.searchParams.set('redirect', request.nextUrl.pathname);
        return NextResponse.redirect(url);
    }

    // Subscription-gated routes: starting/practising cases requires an active
    // plan, but completed feedback must remain visible after a free trial or
    // after a plan expires.
    const isFeedbackRoute = request.nextUrl.pathname.startsWith('/clinical-master/feedback');
    const requiresSubscription =
        request.nextUrl.pathname.startsWith('/clinical-master') && !isFeedbackRoute;
    if (requiresSubscription && user) {
        try {
            // Purchases are matched by email (buying email = account email);
            // the RLS policy "read own purchases by email" scopes this select.
            // Staged deployments (develop preview) treat testers as entitled,
            // and admins are never locked out of their own product.
            const { data: purchases } = await supabase
                .from('preorders')
                .select('plan, status, created_at, coaching_day');
            const entitlement = computeEntitlement(purchases ?? []);
            const admins = parseAdminEmails(process.env.ADMIN_EMAILS);
            const bypass = isStagedDeployment() || admins.has((user.email ?? '').toLowerCase());
            if (entitlement.state !== 'active' && !bypass) {
                const url = request.nextUrl.clone();
                url.pathname = '/pricing';
                url.searchParams.set(entitlement.state === 'read_only' ? 'renew' : 'upgrade', 'true');
                return NextResponse.redirect(url);
            }
        } catch {
            // Fail open — don't block paid users on transient DB errors
        }
    }

    // If user is authenticated and trying to access auth pages, redirect to dashboard
    const isAuthRoute = request.nextUrl.pathname.startsWith('/auth');
    if (isAuthRoute && user) {
        const url = request.nextUrl.clone();
        url.pathname = '/dashboard';
        return NextResponse.redirect(url);
    }

    // Signed-in users should never go through the anonymous free-trial funnel
    // (it has a sign-up gate and is meant for unauthenticated prospects). Send
    // them to the full authenticated experience instead. /try/feedback is
    // excluded: it converts a completed anonymous trial into an account and then
    // redirects to the real feedback page.
    const isTrialFunnel =
        request.nextUrl.pathname.startsWith('/try') &&
        !request.nextUrl.pathname.startsWith('/try/feedback');
    if (isTrialFunnel && user) {
        const url = request.nextUrl.clone();
        url.pathname = '/dashboard';
        url.search = '';
        return NextResponse.redirect(url);
    }

    return supabaseResponse;
}
