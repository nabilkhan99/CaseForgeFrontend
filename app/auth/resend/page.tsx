'use client';

import { useState } from 'react';
import Link from 'next/link';
import AuthLayout from '@/components/auth/AuthLayout';
import AuthCard from '@/components/auth/AuthCard';
import AuthInput from '@/components/auth/AuthInput';

/**
 * "I bought a plan and I can't get in."
 *
 * The set-password link a purchase emails is single-use and expires, and the
 * only route back to one was for us to mint it by hand. This is the
 * self-service door, linked from sign-in where the dead "Sign Up" link used to
 * be — the place someone stuck actually looks.
 *
 * Deliberately NOT /auth/forgot-password: that mints a PKCE reset link whose
 * `code_verifier` lives in the requesting browser, so a link asked for on a
 * laptop and opened on a phone dies with "code verifier should be non-empty".
 * POSTing to /api/auth/resend-set-password gets the same device-independent
 * `token_hash` link that provisioning sends.
 *
 * The answer is the SAME whatever happened — no purchase, purchase, cooldown,
 * send failure. The route is unauthenticated and service-role-backed, so
 * anything that distinguished those cases would be an oracle for "does this
 * address have an account with you". The page must not undo that by being
 * helpful, so it never renders a per-case error: the only failure it shows is
 * a request that never reached us at all.
 */

type FormState =
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'sent' }
  | { status: 'error'; message: string };

export default function ResendSetPasswordPage() {
  const [email, setEmail] = useState('');
  const [formState, setFormState] = useState<FormState>({ status: 'idle' });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!email.trim()) {
      setFormState({ status: 'error', message: 'Please enter your email address' });
      return;
    }

    setFormState({ status: 'loading' });

    try {
      const response = await fetch('/api/auth/resend-set-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim() }),
      });

      // A 400 here means the address wasn't an address — worth saying. Anything
      // else is answered generically, exactly as the route answers it.
      if (response.status === 400) {
        setFormState({ status: 'error', message: 'Please enter a valid email address' });
        return;
      }
      setFormState({ status: 'sent' });
    } catch {
      setFormState({
        status: 'error',
        message: "We couldn't reach the server. Please check your connection and try again.",
      });
    }
  };

  const isLoading = formState.status === 'loading';
  const errorMessage = formState.status === 'error' ? formState.message : null;

  if (formState.status === 'sent') {
    return (
      <AuthLayout>
        <AuthCard
          icon={
            <svg className="w-7 h-7" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
            </svg>
          }
          title="Check your inbox"
          subtitle="If that address has a purchase with us, a link is on its way. It can take a minute — and it's worth checking your spam folder."
        >
          <Link
            href="/auth/sign-in"
            className="w-full py-3 bg-gradient-to-br from-primary to-primary-light text-white font-semibold rounded-lg transition-all flex items-center justify-center gap-2"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
            </svg>
            Back to Log In
          </Link>
        </AuthCard>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout>
      <AuthCard
        icon={
          <svg className="w-7 h-7" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
          </svg>
        }
        title="Resend your set-up link"
        subtitle="Bought a plan but never set a password — or your link expired? Enter the email you paid with and we'll send a fresh one."
      >
        <form onSubmit={handleSubmit} className="space-y-5">
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
                Send my link
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" />
                </svg>
              </>
            )}
          </button>
        </form>

        <div className="mt-6 text-center">
          <Link
            href="/auth/sign-in"
            className="text-muted hover:text-primary text-sm transition-colors inline-flex items-center min-h-[44px] gap-2"
          >
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
