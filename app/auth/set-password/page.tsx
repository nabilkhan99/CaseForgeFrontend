'use client';

import { Suspense, useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import AuthLayout from '@/components/auth/AuthLayout';
import AuthCard from '@/components/auth/AuthCard';
import SetPasswordForm from '@/components/auth/SetPasswordForm';

/**
 * Landing page for the provisioning email's "Set my password" link
 * (lib/auth/provisioning.ts). Verifies the recovery token_hash client-side —
 * establishing the session without a navigation, so the middleware's
 * authed-users-leave-/auth redirect never fires — then renders the shared
 * set-password form. An expired token asks the server for a fresh link.
 */

type VerifyState = 'verifying' | 'ok' | 'expired' | 'resent';

function SetPasswordInner() {
    const params = useSearchParams();
    const [state, setState] = useState<VerifyState>('verifying');
    const [resending, setResending] = useState(false);
    const [resendError, setResendError] = useState<string | null>(null);
    const supabase = createClient();

    const tokenHash = params.get('token_hash');
    const email = params.get('email');

    useEffect(() => {
        let cancelled = false;
        const verify = async () => {
            // Already signed in (e.g. the link was clicked twice) — straight to the form.
            const { data: { session } } = await supabase.auth.getSession();
            if (session) {
                if (!cancelled) setState('ok');
                return;
            }
            if (!tokenHash) {
                if (!cancelled) setState('expired');
                return;
            }
            const { error } = await supabase.auth.verifyOtp({ type: 'recovery', token_hash: tokenHash });
            if (cancelled) return;
            if (!error) {
                setState('ok');
                return;
            }
            // The token is single-use, and it may have been spent a moment ago by
            // a sibling call — React StrictMode double-invokes this effect in dev,
            // and a genuine double-click does the same. If that call left us with
            // a session, we are signed in and the link is not expired at all.
            const { data: { session: afterError } } = await supabase.auth.getSession();
            if (!cancelled) setState(afterError ? 'ok' : 'expired');
        };
        verify();
        return () => { cancelled = true; };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [tokenHash]);

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

    if (state === 'verifying') {
        return (
            <AuthLayout>
                <AuthCard title="One moment..." subtitle="Signing you in securely">
                    <div className="flex justify-center py-8">
                        <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
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
