'use client';

import { Suspense, useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { isAuthRetryableFetchError } from '@supabase/supabase-js';
import { createClient } from '@/lib/supabase/client';
import AuthLayout from '@/components/auth/AuthLayout';
import AuthCard from '@/components/auth/AuthCard';
import SetPasswordForm from '@/components/auth/SetPasswordForm';
import { decideAfterVerify, decideSetPasswordArrival } from '@/lib/auth/setPasswordArrival';

/**
 * Landing page for the provisioning email's "Set my password" link
 * (lib/auth/provisioning.ts). Verifies the recovery token_hash client-side —
 * establishing the session without a navigation, so the middleware's
 * authed-users-leave-/auth redirect never fires — then renders the shared
 * set-password form. An expired token asks the server for a fresh link.
 *
 * OPENING THIS PAGE NEVER SPENDS THE LINK. The token is single-use, and a mail
 * scanner that renders links (Safe Links on nhs.net, which is most of who buys
 * this) runs a mount effect exactly as a browser does. Verifying on mount
 * handed the scanner the buyer's only link and told the buyer it had expired.
 * So arriving only ever checks for a session; the token is verified from the
 * Continue button and nowhere else — app/auth/set-password/page.test.ts pins
 * that, and lib/auth/setPasswordArrival.ts holds the rule.
 *
 * TWO WAYS IN, and the second has no token at all:
 *
 *   1. The emailed link, carrying `token_hash` (+ `email`). They press
 *      Continue, verifyOtp signs them in, then the form.
 *   2. A bare `/auth/set-password`, sent here by the middleware because the
 *      signed-in account still has `password_pending: true` — someone who
 *      verified a link, got a session, and closed the tab before choosing a
 *      password. There is nothing to verify: they already hold the session the
 *      form needs, so the session check below runs FIRST and lands them on the
 *      same form, driven by updateUser on the live session.
 *
 * Only a tokenless arrival with NO session is treated as an expired link — the
 * one case where there is genuinely nothing to work with.
 */

type VerifyState = 'checking' | 'confirm' | 'ok' | 'expired' | 'resent';

function SetPasswordInner() {
    const params = useSearchParams();
    const [state, setState] = useState<VerifyState>('checking');
    const [continuing, setContinuing] = useState(false);
    const [continueError, setContinueError] = useState<string | null>(null);
    const [resending, setResending] = useState(false);
    const [resendError, setResendError] = useState<string | null>(null);
    const supabase = createClient();

    const tokenHash = params.get('token_hash');
    const email = params.get('email');

    useEffect(() => {
        let cancelled = false;
        const arrive = async () => {
            // Only ever a session check. See decideSetPasswordArrival for why a
            // token arriving here is answered with a button rather than a verify.
            //
            // A session read that throws (the auth lock can time out with several
            // tabs open) reads as "not signed in" rather than leaving the spinner
            // up for good: with a token that still offers Continue, which works.
            let hasSession = false;
            try {
                const { data: { session } } = await supabase.auth.getSession();
                hasSession = Boolean(session);
            } catch {
                hasSession = false;
            }
            if (cancelled) return;
            const arrival = decideSetPasswordArrival({ hasSession, tokenHash });
            setState(arrival === 'form' ? 'ok' : arrival);
        };
        arrive();
        return () => { cancelled = true; };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [tokenHash]);

    const continueSetup = async () => {
        if (!tokenHash || continuing) return;
        setContinuing(true);
        setContinueError(null);
        try {
            const { error } = await supabase.auth.verifyOtp({ type: 'recovery', token_hash: tokenHash });
            const hasSessionAfter = error
                ? Boolean((await supabase.auth.getSession()).data.session)
                : true;
            const outcome = decideAfterVerify({
                verifyFailed: Boolean(error),
                retryable: isAuthRetryableFetchError(error),
                hasSessionAfter,
            });
            if (outcome === 'retry') {
                setContinueError('We could not reach the server. Check your connection and try again.');
                return;
            }
            setState(outcome === 'form' ? 'ok' : 'expired');
        } catch {
            // Nothing above is expected to throw, but a thrown error has spent
            // nothing either, so it gets the same second chance as a dropped one.
            setContinueError('Something went wrong. Please try again.');
        } finally {
            setContinuing(false);
        }
    };

    const resend = async () => {
        if (!email || resending) return;
        setResending(true);
        setResendError(null);
        try {
            // Server route, not resetPasswordForEmail: the browser client's PKCE
            // link only works in the browser that asked for it, so a link
            // requested here and opened on a phone would fail silently.
            const response = await fetch('/api/auth/resend-set-password', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email }),
            });
            if (!response.ok) {
                const body = await response.json().catch(() => null);
                setResendError(body?.error ?? 'Could not send the email. Please try again.');
                return;
            }
            setState('resent');
        } catch {
            setResendError('Could not send the email. Please try again.');
        } finally {
            setResending(false);
        }
    };

    if (state === 'ok') {
        return (
            <SetPasswordForm
                title="Set your password"
                subtitle="Choose a password and you're in."
                submitLabel="Save password"
            />
        );
    }

    if (state === 'checking') {
        return (
            <AuthLayout>
                <AuthCard title="One moment..." subtitle="Getting things ready">
                    <div className="flex justify-center py-8">
                        <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                    </div>
                </AuthCard>
            </AuthLayout>
        );
    }

    if (state === 'confirm') {
        return (
            <AuthLayout>
                <AuthCard
                    title="Your account is ready"
                    subtitle="Continue to sign in and choose your password."
                >
                    <div className="space-y-4">
                        <button
                            onClick={continueSetup}
                            disabled={continuing}
                            className="w-full rounded-xl bg-primary px-6 py-3.5 text-base font-semibold text-white transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
                        >
                            {continuing ? 'Signing you in...' : 'Continue'}
                        </button>
                        {continueError && (
                            <div className="p-3 bg-danger/10 border border-danger/20 rounded-lg">
                                <p className="text-danger text-sm text-center">{continueError}</p>
                            </div>
                        )}
                    </div>
                </AuthCard>
            </AuthLayout>
        );
    }

    return (
        <AuthLayout>
            <AuthCard
                title={state === 'resent' ? 'Check your inbox' : 'This link has expired'}
                subtitle={
                    state === 'resent'
                        ? `If that address has a purchase with us, a fresh link is on its way to ${email}.`
                        : 'Set-up links only last a short while, but a fresh one is a click away.'
                }
            >
                {state === 'expired' && (
                    <div className="space-y-4">
                        {email ? (
                            <>
                                <button
                                    onClick={resend}
                                    disabled={resending}
                                    className="w-full rounded-xl bg-primary px-6 py-3.5 text-base font-semibold text-white transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
                                >
                                    {resending ? 'Sending...' : 'Email me a fresh link'}
                                </button>
                                {resendError && (
                                    <div className="p-3 bg-danger/10 border border-danger/20 rounded-lg">
                                        <p className="text-danger text-sm text-center">{resendError}</p>
                                    </div>
                                )}
                            </>
                        ) : (
                            <p className="text-sm text-stone-600">
                                Request a new link from the{' '}
                                <Link href="/auth/forgot-password" className="font-semibold text-primary">
                                    forgot password
                                </Link>{' '}
                                page.
                            </p>
                        )}
                    </div>
                )}
            </AuthCard>
        </AuthLayout>
    );
}

export default function SetPasswordPage() {
    return (
        <Suspense fallback={null}>
            <SetPasswordInner />
        </Suspense>
    );
}
