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

export default function SignUpPage() {
    const [fullName, setFullName] = useState('');
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [formState, setFormState] = useState<FormState>({ status: 'idle' });
    const supabase = createClient();

    const handleSignUp = async (e: React.FormEvent) => {
        e.preventDefault();

        // Validation
        if (!fullName.trim() || !email.trim() || !password.trim()) {
            setFormState({ status: 'error', message: 'Please fill in all fields' });
            return;
        }

        if (password.length < 6) {
            setFormState({ status: 'error', message: 'Password must be at least 6 characters' });
            return;
        }

        setFormState({ status: 'loading' });

        try {
            const { error } = await supabase.auth.signUp({
                email: email.trim(),
                password,
                options: {
                    data: {
                        full_name: fullName.trim(),
                    },
                },
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
                    subtitle={`We've sent a confirmation link to ${formState.email}. Please check your inbox and spam folder.`}
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

                        <p className="text-center text-muted text-sm">
                            Didn&apos;t receive the email?{' '}
                            <button
                                onClick={() => setFormState({ status: 'idle' })}
                                className="text-primary hover:text-primary-light font-medium transition-colors"
                            >
                                Click to resend
                            </button>
                        </p>
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
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" />
                    </svg>
                }
                title="Create Your Account"
                subtitle="Join Fourteen Fisherman and start your SCA preparation journey."
            >
                <form onSubmit={handleSignUp} className="space-y-5">
                    <AuthInput
                        label="Full Name"
                        type="text"
                        icon="user"
                        value={fullName}
                        onChange={(e) => setFullName(e.target.value)}
                        placeholder="Dr. Jane Smith"
                        disabled={isLoading}
                        autoComplete="name"
                    />

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

                    <div>
                        <AuthInput
                            label="Password"
                            type="password"
                            icon="lock"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            placeholder="••••••••"
                            disabled={isLoading}
                            autoComplete="new-password"
                        />
                        <p className="text-xs text-muted mt-2">Minimum 6 characters</p>
                    </div>

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
                        {isLoading ? 'Creating account...' : (
                            <>
                                Create Account
                                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" />
                                </svg>
                            </>
                        )}
                    </button>
                </form>

                {/* Sign In Link */}
                <p className="mt-6 text-center text-muted text-sm">
                    Already have an account?{' '}
                    <Link href="/auth/sign-in" className="text-primary hover:text-primary-light font-medium transition-colors">
                        Sign In
                    </Link>
                </p>
            </AuthCard>
        </AuthLayout>
    );
}
