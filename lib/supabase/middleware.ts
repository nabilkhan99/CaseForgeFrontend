import { createServerClient } from '@supabase/ssr';
import { decideAccess } from '@/lib/commerce/entitlements';
import { loadCohortAccess } from '@/lib/commerce/cohortAccess';
import { loadTrialAccess } from '@/lib/commerce/trialAccess';
import { exactEmailPattern } from '@/lib/commerce/emailFilter';
import { effectiveLaunchDate } from '@/lib/commerce/launchDate';
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

    // A provisioned account must not be able to rest in "signed in, but never
    // set a password". The set-up link verifies (verifyOtp) BEFORE the form is
    // submitted, and verifying creates a real session — so closing the tab at
    // that point left people browsing the product with no password at all, and
    // locked out the moment the session expired, because the link is single-use
    // and (until now) cohort accounts had no self-serve resend.
    //
    // Provisioning stamps `password_pending: true` at createUser; the
    // set-password form clears it in the same updateUser that saves the
    // password. Read strictly (`=== true`), so an account whose metadata has no
    // such key — everyone who existed before this shipped — is never redirected.
    //
    // Scope, and why it cannot loop:
    //   - `/auth/*` is exempt, so the destination itself is reachable, and the
    //     rule below that bounces authed users off auth pages already exempts
    //     the two password routes for exactly this reason.
    //   - `/api/*` is exempt, so the feedback/marking polls and every fetch the
    //     app makes keep getting JSON rather than a 307 to an HTML page.
    //   - sign-out is a client-side `supabase.auth.signOut()` that clears the
    //     cookies before navigating, so the next request through here has no
    //     user and no gate.
    const passwordPending = user?.user_metadata?.password_pending === true;
    const isGateableNavigation =
        !request.nextUrl.pathname.startsWith('/api') &&
        !request.nextUrl.pathname.startsWith('/auth');
    if (passwordPending && isGateableNavigation) {
        const url = request.nextUrl.clone();
        url.pathname = '/auth/set-password';
        // No query carried over: `email` and `token_hash` are the set-password
        // page's own inputs, and anything else would just be a stale filter.
        url.search = '';
        // Carry any cookies the auth client rotated during this request. The
        // redirect replaces `supabaseResponse`, and for a gated user EVERY
        // navigation takes this branch — dropping a refreshed token here would
        // make the gate itself the thing that signs them out.
        const redirect = NextResponse.redirect(url);
        for (const cookie of supabaseResponse.cookies.getAll()) {
            redirect.cookies.set(cookie);
        }
        return redirect;
    }

    // Subscription-gated routes: starting/practising cases requires an active
    // plan, but completed feedback must remain visible after a free trial or
    // after a plan expires.
    const isFeedbackRoute = request.nextUrl.pathname.startsWith('/clinical-master/feedback');
    const requiresSubscription =
        request.nextUrl.pathname.startsWith('/clinical-master') && !isFeedbackRoute;
    let entitlementFailedOpen = false;
    if (requiresSubscription && user) {
        try {
            // Purchases are matched by email (buying email = account email);
            // the RLS policy "read own purchases by email" scopes this select.
            // Staged deployments (develop preview) treat testers as entitled,
            // and admins are never locked out of their own product.
            // Belt and braces: RLS already scopes this select to the user's own
            // email, but a dropped policy must degrade to "no rows", not "all rows".
            // `.ilike` (not `.eq`) because the policy compares lower(email) —
            // a case-sensitive filter would hide a hand-provisioned row like
            // `Sarah@Nhs.net` and lock out someone who paid.
            // Both reads at once: they are independent, and this runs on every
            // navigation into a consultation, so serialising them would put a
            // second round trip in front of every page in the product's hot path.
            // The cohort read fails closed inside loadCohortAccess — a trainer
            // pilot student seeing the paywall is a far cheaper failure than a
            // broken lookup handing five cases to everyone. The trial read
            // fails closed for the same reason and a sharper one: failing open
            // there would hand a free five-station grant to every signed-in
            // account, which is real money in Azure realtime minutes.
            const [{ data: purchases, error: purchasesError }, cohort, trial] = await Promise.all([
                supabase
                    .from('preorders')
                    .select('plan, status, created_at, coaching_day, access_starts_at, access_ends_at')
                    .ilike('email', exactEmailPattern(user.email)),
                loadCohortAccess(supabase, user.id),
                loadTrialAccess(supabase, user.id),
            ]);
            if (purchasesError) {
                // supabase-js reports query failures as { error }, not a throw —
                // without this branch a transient DB error reads as "no purchases"
                // and bounces PAYING users to /pricing. Fail open, loudly — but
                // by flagging and falling through, not by returning: the auth and
                // trial-funnel rules below still have to run, and a future rule
                // added under them must not silently stop applying here.
                console.error('[entitlement] middleware fail-open', purchasesError);
                entitlementFailedOpen = true;
            } else {
                // A cohort member reaches every page here; WHICH cases they may
                // actually sit is enforced at the two server chokepoints
                // (create-session, realtime-token), not by path. That is
                // deliberate: the case brief for a locked station is meant to be
                // reachable — it is where the upsell lives.
                // A live trial is now exactly the same shape, and reaches every
                // page here for exactly the same reason. Since 7 September the
                // trial IS an allowlist (`trial.freeStationIds`) rather than a
                // count, so there is a per-station question — and it is
                // deliberately not answered here. A trialist who has clicked a
                // case outside their five should read its brief and meet the
                // "unlock all 200 stations" line, not bounce off a redirect
                // wondering what happened. What refuses the consultation is the
                // chokepoint; what stops a trialist navigating at all is
                // `allowed` going false below once the five days are up.
                const { entitlement, allowed, trial: trialAccess } = decideAccess(purchases ?? [], {
                    email: user.email,
                    launchDate: effectiveLaunchDate(),
                    admins: parseAdminEmails(process.env.ADMIN_EMAILS),
                    cohort,
                    trial,
                });
                if (!allowed) {
                    const url = request.nextUrl.clone();
                    // An ENDED trial is read-only in exactly the way a lapsed
                    // plan is — reports, board and Development page all stay
                    // open, only stations lock — but it does NOT go to
                    // /pricing?renew=true. There is nothing to renew, and the
                    // offer for someone whose five days have just run out is
                    // two plans chosen by their exam date, which lives on the
                    // dashboard. `?trial=ended` is what draws that wall.
                    //
                    // Unchanged by the September rewrite, and re-checked
                    // against it: the only way to reach `trial_ended` now is
                    // expiry, which is precisely the case this branch was
                    // written for.
                    //
                    // `!entitlement.plan` keeps that to people whose access
                    // rested on the grant ALONE. Somebody who once bought and
                    // lapsed has a purchase to renew and a plan name to be told
                    // about, and their own story outranks the grant's here for
                    // the same reason it does everywhere else.
                    if (trialAccess?.state === 'trial_ended' && !entitlement.plan) {
                        url.pathname = '/dashboard';
                        url.search = '';
                        url.searchParams.set('trial', 'ended');
                        return NextResponse.redirect(url);
                    }
                    // state 'none' WITH a plan is a preorder whose window hasn't
                    // opened — a paying customer. Sending them to /pricing reads
                    // as "your purchase doesn't exist"; the dashboard explains
                    // that access opens 1 Sept instead.
                    if (entitlement.state === 'none' && entitlement.plan) {
                        url.pathname = '/dashboard';
                        url.search = '';
                        // Carry the reason, so the dashboard can say why the
                        // page they asked for came back here instead of
                        // reloading under them with no explanation.
                        url.searchParams.set('access', 'pending');
                    } else {
                        url.pathname = '/pricing';
                        url.searchParams.set(entitlement.state === 'read_only' ? 'renew' : 'upgrade', 'true');
                    }
                    return NextResponse.redirect(url);
                }
            }
        } catch {
            // Fail open — don't block paid users on transient DB errors
            entitlementFailedOpen = true;
        }
    }

    // If user is authenticated and trying to access auth pages, redirect to
    // dashboard — EXCEPT the password-setting pages: a provisioned buyer who
    // re-opens their set-password link already holds a session from verifyOtp,
    // and bouncing them to /dashboard would mean the password never gets set.
    const isPasswordRoute =
        request.nextUrl.pathname.startsWith('/auth/set-password') ||
        request.nextUrl.pathname.startsWith('/auth/start') ||
        request.nextUrl.pathname.startsWith('/auth/reset-password');
    const isAuthRoute = request.nextUrl.pathname.startsWith('/auth') && !isPasswordRoute;
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

    // A navigation that got through ungated leaves a trace, so "the gate stopped
    // gating" is visible in request logs rather than only in a console.error
    // nobody is reading.
    if (entitlementFailedOpen) {
        supabaseResponse.headers.set('x-entitlement-fail-open', '1');
    }

    return supabaseResponse;
}
