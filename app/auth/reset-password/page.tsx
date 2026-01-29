'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import AuthLayout from '@/components/auth/AuthLayout';
import AuthCard from '@/components/auth/AuthCard';
import AuthInput from '@/components/auth/AuthInput';

// Password validation rules
const validatePassword = (password: string) => {
    return {
        minLength: password.length >= 8,
        hasUppercase: /[A-Z]/.test(password),
        hasNumber: /[0-9]/.test(password),
    };
};

// Robust state management
type FormState =
    | { status: 'idle' }
    | { status: 'loading' }
    | { status: 'success' }
    | { status: 'error'; message: string };

export default function ResetPasswordPage() {
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [formState, setFormState] = useState<FormState>({ status: 'idle' });
    const [isValidSession, setIsValidSession] = useState<boolean | null>(null);
    const router = useRouter();
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

    const passwordValidation = validatePassword(password);
    const isPasswordValid = passwordValidation.minLength && passwordValidation.hasUppercase && passwordValidation.hasNumber;
    const doPasswordsMatch = password === confirmPassword && confirmPassword.length > 0;

    const handleResetPassword = async (e: React.FormEvent) => {
        e.preventDefault();

        // Validation
        if (!password.trim() || !confirmPassword.trim()) {
            setFormState({ status: 'error', message: 'Please fill in all fields' });
            return;
        }

        if (!isPasswordValid) {
            setFormState({ status: 'error', message: 'Password does not meet requirements' });
            return;
        }

        if (!doPasswordsMatch) {
            setFormState({ status: 'error', message: 'Passwords do not match' });
            return;
        }

        setFormState({ status: 'loading' });

        try {
            const { error } = await supabase.auth.updateUser({
                password: password,
            });

            if (error) {
                setFormState({ status: 'error', message: error.message });
            } else {
                setFormState({ status: 'success' });
            }
        } catch {
            setFormState({ status: 'error', message: 'An unexpected error occurred' });
        }
    };

    const isLoading = formState.status === 'loading';
    const errorMessage = formState.status === 'error' ? formState.message : null;

    // Loading state while checking session
    if (isValidSession === null) {
        return (
            <AuthLayout>
                <AuthCard title="Loading..." subtitle="Please wait...">
                    <div className="flex justify-center py-8">
                        <div className="w-8 h-8 border-2 border-blue-400 border-t-transparent rounded-full animate-spin" />
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
                        className="w-full py-3 bg-gradient-to-r from-blue-600 to-blue-500 hover:from-blue-500 hover:to-blue-400 text-white font-semibold rounded-lg transition-all flex items-center justify-center gap-2"
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

    // Success State - "Password Successfully Updated" screen
    if (formState.status === 'success') {
        return (
            <AuthLayout>
                <AuthCard
                    icon={
                        <svg className="w-7 h-7" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                        </svg>
                    }
                    accentColor="green"
                    title="Password Successfully Updated!"
                    subtitle="You can now log in with your new password."
                >
                    <button
                        onClick={() => {
                            router.push('/auth/sign-in');
                            router.refresh();
                        }}
                        className="w-full py-3 bg-gradient-to-r from-purple-600 to-purple-500 hover:from-purple-500 hover:to-purple-400 text-white font-semibold rounded-lg transition-all flex items-center justify-center gap-2"
                    >
                        Go to Login
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 16l-4-4m0 0l4-4m-4 4h14m-5 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h7a3 3 0 013 3v1" />
                        </svg>
                    </button>
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
                title="Set a New Password"
                subtitle="Please enter and confirm your new password below."
            >
                <form onSubmit={handleResetPassword} className="space-y-5">
                    <div>
                        <AuthInput
                            label="New Password"
                            type="password"
                            icon="lock"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            placeholder="••••••••"
                            disabled={isLoading}
                            autoComplete="new-password"
                        />
                        {/* Password Requirements */}
                        <div className="mt-2 space-y-1">
                            <p className={`text-xs flex items-center gap-1 ${passwordValidation.minLength ? 'text-emerald-400' : 'text-slate-500'}`}>
                                <span>{passwordValidation.minLength ? '✓' : '○'}</span>
                                At least 8 characters
                            </p>
                            <p className={`text-xs flex items-center gap-1 ${passwordValidation.hasUppercase && passwordValidation.hasNumber ? 'text-emerald-400' : 'text-slate-500'}`}>
                                <span>{passwordValidation.hasUppercase && passwordValidation.hasNumber ? '✓' : '○'}</span>
                                One uppercase letter & one number
                            </p>
                        </div>
                    </div>

                    <AuthInput
                        label="Confirm New Password"
                        type="password"
                        icon="shield"
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        placeholder="••••••••"
                        disabled={isLoading}
                        autoComplete="new-password"
                        error={confirmPassword && !doPasswordsMatch ? 'Passwords do not match' : undefined}
                    />

                    {errorMessage && (
                        <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-lg">
                            <p className="text-red-400 text-sm text-center">{errorMessage}</p>
                        </div>
                    )}

                    <button
                        type="submit"
                        disabled={isLoading || !isPasswordValid || !doPasswordsMatch}
                        className="w-full py-3 bg-gradient-to-r from-blue-600 to-blue-500 hover:from-blue-500 hover:to-blue-400 disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold rounded-lg transition-all flex items-center justify-center gap-2"
                    >
                        {isLoading ? 'Resetting...' : (
                            <>
                                Reset Password
                                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" />
                                </svg>
                            </>
                        )}
                    </button>
                </form>

                {/* Back to Login Link */}
                <div className="mt-6 text-center">
                    <Link href="/auth/sign-in" className="text-slate-400 hover:text-white text-sm transition-colors inline-flex items-center gap-2">
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                        </svg>
                        Back to Log In
                    </Link>
                </div>
            </AuthCard>
        </AuthLayout>
    );
}
