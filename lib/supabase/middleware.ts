import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';

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

    // Subscription-gated routes: /clinical-master/* requires an active plan
    const requiresSubscription = request.nextUrl.pathname.startsWith('/clinical-master');
    if (requiresSubscription && user) {
        try {
            const { data: subscription } = await supabase
                .from('subscriptions')
                .select('id')
                .eq('user_id', user.id)
                .eq('status', 'active')
                .gt('expires_at', new Date().toISOString())
                .limit(1)
                .single();

            if (!subscription) {
                const url = request.nextUrl.clone();
                url.pathname = '/pricing';
                url.searchParams.set('upgrade', 'true');
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
