'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';
import Link from 'next/link';
import AuthLayout from '@/components/auth/AuthLayout';
import AuthCard from '@/components/auth/AuthCard';
import SetPasswordForm from '@/components/auth/SetPasswordForm';

/**
 * Password recovery landing page. Owns the session side of the flow — the link
 * establishes a recovery session, either already present on mount or arriving
 * as a PASSWORD_RECOVERY event — and hands off to the shared form once there
 * is one. /auth/set-password reaches the same form a different way.
 */
export default function ResetPasswordPage() {
    const [isValidSession, setIsValidSession] = useState<boolean | null>(null);
    const supabase = createClient();

    // Check if user has a valid session from email link
    useEffect(() => {
        const checkSession = async () => {
            const { data: { session } } = await supabase.auth.getSession();
            setIsValidSession(!!session);
        };
        checkSession();

        // Listen for auth state changes (when user clicks email link)
        const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
            if (event === 'PASSWORD_RECOVERY') {
                setIsValidSession(true);
            }
        });

        return () => subscription.unsubscribe();
    }, [supabase.auth]);

    // Loading state while checking session
    if (isValidSession === null) {
        return (
            <AuthLayout>
                <AuthCard title="Loading..." subtitle="Please wait...">
                    <div className="flex justify-center py-8">
                        <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                    </div>
                </AuthCard>
            </AuthLayout>
        );
    }

    // Invalid session - no recovery token
    if (isValidSession === false) {
        return (
            <AuthLayout>
                <AuthCard
                    icon={
                        <svg className="w-7 h-7" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                        </svg>
                    }
                    title="Invalid Reset Link"
                    subtitle="This password reset link is invalid or has expired."
                >
                    <Link
                        href="/auth/forgot-password"
                        className="w-full py-3 bg-gradient-to-br from-primary to-primary-light text-white font-semibold rounded-lg transition-all flex items-center justify-center gap-2"
                    >
                        Request New Link
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" />
                        </svg>
                    </Link>
                </AuthCard>
            </AuthLayout>
        );
    }

    return <SetPasswordForm />;
}
