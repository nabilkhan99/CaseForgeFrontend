'use client';

import { useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import AuthLayout from '@/components/auth/AuthLayout';
import AuthCard from '@/components/auth/AuthCard';
import AuthInput from '@/components/auth/AuthInput';

// Robust state management
type FormState =
    | { status: 'idle' }
    | { status: 'loading' }
    | { status: 'error'; message: string };

export default function SignInPage() {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [formState, setFormState] = useState<FormState>({ status: 'idle' });
    const router = useRouter();
    const searchParams = useSearchParams();
    const supabase = createClient();

    const handleSignIn = async (e: React.FormEvent) => {
        e.preventDefault();

        // Validation
        if (!email.trim() || !password.trim()) {
            setFormState({ status: 'error', message: 'Please fill in all fields' });
            return;
        }

        setFormState({ status: 'loading' });

        try {
            const { error } = await supabase.auth.signInWithPassword({
                email: email.trim(),
                password,
            });

            if (error) {
                setFormState({ status: 'error', message: error.message });
            } else {
                const redirectTo = searchParams.get('redirect') || '/dashboard';
                router.push(redirectTo);
                router.refresh();
            }
        } catch {
            setFormState({ status: 'error', message: 'An unexpected error occurred' });
        }
    };

    const isLoading = formState.status === 'loading';
    const errorMessage = formState.status === 'error' ? formState.message : null;

    return (
        <AuthLayout>
            <AuthCard
                icon={
                    <svg className="w-7 h-7" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                    </svg>
                }
                title="Welcome Back to Fourteen Fisherman"
                subtitle="Enter your details to access your simulator."
            >
                <form onSubmit={handleSignIn} className="space-y-5">
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

                    <AuthInput
                        label="Password"
                        type="password"
                        icon="lock"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        placeholder="••••••••"
                        disabled={isLoading}
                        autoComplete="current-password"
                    />

                    {errorMessage && (
                        <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-lg">
                            <p className="text-red-400 text-sm text-center">{errorMessage}</p>
                        </div>
                    )}

                    <button
                        type="submit"
                        disabled={isLoading}
                        className="w-full py-3 bg-gradient-to-r from-blue-600 to-blue-500 hover:from-blue-500 hover:to-blue-400 disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold rounded-lg transition-all flex items-center justify-center gap-2"
                    >
                        {isLoading ? 'Logging in...' : (
                            <>
                                Log In
                                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" />
                                </svg>
                            </>
                        )}
                    </button>
                </form>

                {/* Forgot Password Link */}
                <div className="mt-4 text-center">
                    <Link href="/auth/forgot-password" className="text-blue-400 hover:text-blue-300 text-sm transition-colors">
                        Forgot Password?
                    </Link>
                </div>

                {/* Sign Up Link */}
                <p className="mt-6 text-center text-slate-400 text-sm">
                    Don&apos;t have an account?{' '}
                    <Link href="/auth/sign-up" className="text-blue-400 hover:text-blue-300 font-medium transition-colors">
                        Sign Up
                    </Link>
                </p>
            </AuthCard>
        </AuthLayout>
    );
}
