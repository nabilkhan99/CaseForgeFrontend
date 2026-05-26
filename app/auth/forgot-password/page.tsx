'use client';

import { useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import Link from 'next/link';
import AuthLayout from '@/components/auth/AuthLayout';
import AuthCard from '@/components/auth/AuthCard';
import AuthInput from '@/components/auth/AuthInput';

// Robust state management
type FormState =
    | { status: 'idle' }
    | { status: 'loading' }
    | { status: 'success'; email: string }
    | { status: 'error'; message: string };

export default function ForgotPasswordPage() {
    const [email, setEmail] = useState('');
    const [formState, setFormState] = useState<FormState>({ status: 'idle' });
    const supabase = createClient();

    const handleResetRequest = async (e: React.FormEvent) => {
        e.preventDefault();

        // Validation
        if (!email.trim()) {
            setFormState({ status: 'error', message: 'Please enter your email address' });
            return;
        }

        setFormState({ status: 'loading' });

        try {
            const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
                redirectTo: `${window.location.origin}/auth/reset-password`,
            });

            if (error) {
                setFormState({ status: 'error', message: error.message });
            } else {
                setFormState({ status: 'success', email: email.trim() });
            }
        } catch {
            setFormState({ status: 'error', message: 'An unexpected error occurred' });
        }
    };

    const handleResend = async () => {
        if (formState.status !== 'success') return;

        const emailToResend = formState.email;
        setFormState({ status: 'loading' });

        try {
            const { error } = await supabase.auth.resetPasswordForEmail(emailToResend, {
                redirectTo: `${window.location.origin}/auth/reset-password`,
            });

            if (error) {
                setFormState({ status: 'error', message: error.message });
            } else {
                setFormState({ status: 'success', email: emailToResend });
            }
        } catch {
            setFormState({ status: 'error', message: 'An unexpected error occurred' });
        }
    };

    const isLoading = formState.status === 'loading';
    const errorMessage = formState.status === 'error' ? formState.message : null;

    // Success State - "Check Your Email" screen
    if (formState.status === 'success') {
        return (
            <AuthLayout>
                <AuthCard
                    icon={
                        <svg className="w-7 h-7" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                        </svg>
                    }
                    accentColor="blue"
                    title="Check Your Email!"
                    subtitle={`We've sent a password reset link to your email address. Please check your inbox and spam folder.`}
                >
                    <div className="space-y-4">
                        <Link
                            href="/auth/sign-in"
                            className="w-full py-3 bg-gradient-to-br from-primary to-primary-light text-white font-semibold rounded-lg transition-all flex items-center justify-center gap-2"
                        >
                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                            </svg>
                            Back to Log In
                        </Link>

                        <div className="text-center text-muted text-sm flex items-center justify-center gap-1">
                            <span>Didn&apos;t receive the email?</span>
                            <button
                                onClick={handleResend}
                                className="inline-flex items-center min-h-[44px] text-primary hover:text-primary-light font-medium transition-colors cursor-pointer"
                            >
                                Click to resend
                            </button>
                        </div>
                    </div>
                </AuthCard>
            </AuthLayout>
        );
    }

    return (
        <AuthLayout>
            <AuthCard
                icon={
                    <svg className="w-7 h-7" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                    </svg>
                }
                title="Reset Your Password"
                subtitle="Enter your email address below to receive a password reset link."
            >
                <form onSubmit={handleResetRequest} className="space-y-5">
                    <AuthInput
                        label="Email Address"
                        type="email"
                        icon="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        placeholder="doctor@example.com"
                        disabled={isLoading}
                        autoComplete="email"
                    />

                    {errorMessage && (
                        <div className="p-3 bg-danger/10 border border-danger/20 rounded-lg">
                            <p className="text-danger text-sm text-center">{errorMessage}</p>
                        </div>
                    )}

                    <button
                        type="submit"
                        disabled={isLoading}
                        className="w-full py-3 bg-gradient-to-br from-primary to-primary-light disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold rounded-lg transition-all flex items-center justify-center gap-2"
                    >
                        {isLoading ? 'Sending...' : (
                            <>
                                Send Reset Link
                                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" />
                                </svg>
                            </>
                        )}
                    </button>
                </form>

                {/* Back to Login Link */}
                <div className="mt-6 text-center">
                    <Link href="/auth/sign-in" className="text-muted hover:text-primary text-sm transition-colors inline-flex items-center min-h-[44px] gap-2">
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                        </svg>
                        Back to Login
                    </Link>
                </div>
            </AuthCard>
        </AuthLayout>
    );
}
