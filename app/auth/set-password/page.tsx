'use client';

import { Suspense, useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import AuthLayout from '@/components/auth/AuthLayout';
import AuthCard from '@/components/auth/AuthCard';
import ResetPasswordPage from '../reset-password/page';

/**
 * Landing page for the provisioning email's "Set my password" link
 * (lib/auth/provisioning.ts). Verifies the recovery token_hash client-side —
 * establishing the session without a navigation, so the middleware's
 * authed-users-leave-/auth redirect never fires — then renders the existing
 * reset-password form. An expired token offers a fresh link via the normal
 * resetPasswordForEmail flow.
 */

type VerifyState = 'verifying' | 'ok' | 'expired' | 'resent';

function SetPasswordInner() {
    const params = useSearchParams();
    const [state, setState] = useState<VerifyState>('verifying');
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
            if (!cancelled) setState(error ? 'expired' : 'ok');
        };
        verify();
        return () => { cancelled = true; };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [tokenHash]);

    const resend = async () => {
        if (!email) return;
        await supabase.auth.resetPasswordForEmail(email, {
            redirectTo: `${window.location.origin}/auth/reset-password`,
        });
        setState('resent');
    };

    if (state === 'ok') return <ResetPasswordPage />;

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
                        ? `We've emailed a fresh link to ${email}.`
                        : 'Set-up links only last a short while, but a fresh one is a click away.'
                }
            >
                {state === 'expired' && (
                    <div className="space-y-4">
                        {email ? (
                            <button
                                onClick={resend}
                                className="w-full rounded-xl bg-primary px-6 py-3.5 text-base font-semibold text-white transition hover:opacity-90"
                            >
                                Email me a fresh link
                            </button>
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
