'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import AuthLayout from '@/components/auth/AuthLayout';
import AuthCard from '@/components/auth/AuthCard';
import AuthInput from '@/components/auth/AuthInput';

/**
 * The "choose a password" form, shared by /auth/reset-password (password
 * recovery) and /auth/set-password (the provisioning email's first sign-in).
 *
 * Owns only the form: it assumes the caller has already established a session
 * — each route reaches that point its own way (recovery event vs. verifyOtp on
 * a token_hash), so that logic deliberately stays with the routes.
 */

const validatePassword = (password: string) => {
    return {
        minLength: password.length >= 8,
        hasUppercase: /[A-Z]/.test(password),
        hasNumber: /[0-9]/.test(password),
    };
};

type FormState =
    | { status: 'idle' }
    | { status: 'loading' }
    | { status: 'success' }
    | { status: 'error'; message: string };

interface SetPasswordFormProps {
    title?: string;
    subtitle?: string;
    submitLabel?: string;
}

export default function SetPasswordForm({
    title = 'Set a New Password',
    subtitle = 'Please enter and confirm your new password below.',
    submitLabel = 'Reset Password',
}: SetPasswordFormProps) {
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [formState, setFormState] = useState<FormState>({ status: 'idle' });
    const router = useRouter();
    const supabase = createClient();

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
                        className="w-full py-3 bg-gradient-to-br from-primary to-primary-light text-white font-semibold rounded-lg transition-all flex items-center justify-center gap-2"
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
                title={title}
                subtitle={subtitle}
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
                            <p className={`text-xs flex items-center gap-1 ${passwordValidation.minLength ? 'text-primary' : 'text-muted'}`}>
                                <span>{passwordValidation.minLength ? '✓' : '○'}</span>
                                At least 8 characters
                            </p>
                            <p className={`text-xs flex items-center gap-1 ${passwordValidation.hasUppercase && passwordValidation.hasNumber ? 'text-primary' : 'text-muted'}`}>
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
                        <div className="p-3 bg-danger/10 border border-danger/20 rounded-lg">
                            <p className="text-danger text-sm text-center">{errorMessage}</p>
                        </div>
                    )}

                    <button
                        type="submit"
                        disabled={isLoading || !isPasswordValid || !doPasswordsMatch}
                        className="w-full py-3 bg-gradient-to-br from-primary to-primary-light disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold rounded-lg transition-all flex items-center justify-center gap-2"
                    >
                        {isLoading ? 'Saving...' : (
                            <>
                                {submitLabel}
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
                        Back to Log In
                    </Link>
                </div>
            </AuthCard>
        </AuthLayout>
    );
}
