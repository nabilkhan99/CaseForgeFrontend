'use client';

import { Suspense, useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import AuthLayout from '@/components/auth/AuthLayout';
import AuthCard from '@/components/auth/AuthCard';
import { trackTrialAccountCreated } from '@/lib/trial/trialEvents';
import type { StartFailure } from '@/app/api/auth/start/route';

/**
 * Where a trial link lands. Door (c).
 *
 * Deliberately thin: it POSTs the token to /api/auth/start and navigates. The
 * account, the claim on any earlier guest consultation, the grant and the
 * session are all established there, in a route handler, because that is the
 * only place in Next that may set cookies — which is what makes this work on a
 * phone when the link was minted for a laptop.
 *
 * Two query shapes reach it, and the page does not care which:
 *   ?token=…                  our signed link (mint script, "open your dashboard")
 *   ?token_hash=…&email=…     a GoTrue recovery hash from /api/try/verify-code
 *
 * ⚠️ MIDDLEWARE. `lib/supabase/middleware.ts` bounces a signed-in visitor off
 * any `/auth/*` path that is not the password pair, so a person who is ALREADY
 * signed in lands on /dashboard without their grant being applied. That file
 * belongs to another workstream on this build; `/auth/start` needs adding to
 * `isPasswordRoute` there. Until it is, the door works for the case it was
 * built for — a cold browser — and degrades to "you are already signed in" for
 * the case it was not.
 */

type StartState = 'redeeming' | 'failed' | 'sent';

const FAILURE_COPY: Record<StartFailure, { title: string; subtitle: string }> = {
  expired: {
    title: 'This link has expired',
    subtitle: 'Sign-in links last 24 hours and work once. A fresh one is a click away.',
  },
  invalid: {
    title: "This link didn't work",
    subtitle: 'It may have been cut short by an email client. A fresh one is a click away.',
  },
  throttled: {
    title: 'One moment',
    subtitle: 'That was a lot of attempts in a short time. Try again in a few minutes.',
  },
  unavailable: {
    title: "We couldn't sign you in",
    subtitle: 'Something went wrong at our end, not yours. Try a fresh link.',
  },
};

function StartInner() {
  const params = useSearchParams();
  const router = useRouter();

  const [state, setState] = useState<StartState>('redeeming');
  const [failure, setFailure] = useState<StartFailure>('invalid');
  const [sending, setSending] = useState(false);
  const [emailDraft, setEmailDraft] = useState('');

  const token = params.get('token');
  const tokenHash = params.get('token_hash');
  const email = params.get('email');

  // The token is single-use, so a second POST spends nothing and fails. React
  // StrictMode double-invokes effects in development and a double-click does
  // the same, so the redemption is fired exactly once per mount.
  const redeemed = useRef(false);

  useEffect(() => {
    if (redeemed.current) return;
    redeemed.current = true;

    if (email) setEmailDraft(email);

    if (!token && !tokenHash) {
      setFailure('invalid');
      setState('failed');
      return;
    }

    let cancelled = false;
    (async () => {
      try {
        const response = await fetch('/api/auth/start', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(token ? { token } : { tokenHash }),
        });
        const body = (await response.json()) as
          | { ok: true; created: boolean; door: 'free' | 'guest' | 'invite' | 'cohort' | null }
          | { ok: false; reason: StartFailure };
        if (cancelled) return;

        if (!body.ok) {
          setFailure(body.reason);
          setState('failed');
          return;
        }

        // Fired here rather than server-side because trackEvent is the browser's
        // PostHog client — and awaited so the capture flushes before the
        // navigation tears the page down.
        if (body.created && body.door) await trackTrialAccountCreated(body.door);

        // `replace`, not `push`: the token is spent, so the back button must
        // not return to a page that will try to redeem it again.
        router.replace('/dashboard');
      } catch {
        if (!cancelled) {
          setFailure('unavailable');
          setState('failed');
        }
      }
    })();

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, tokenHash]);

  const resend = useCallback(async () => {
    if (sending || !emailDraft.trim()) return;
    setSending(true);
    try {
      // The response is the same whatever happened — see the route — so there
      // is nothing to branch on and nothing to report but "check your inbox".
      await fetch('/api/try/dashboard-link', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: emailDraft.trim().toLowerCase() }),
      });
    } catch {
      // Same outcome either way; the copy already says "if that address…".
    } finally {
      setSending(false);
      setState('sent');
    }
  }, [emailDraft, sending]);

  if (state === 'redeeming') {
    return (
      <AuthLayout>
        <AuthCard title="One moment..." subtitle="Signing you in securely">
          <div className="flex justify-center py-8">
            <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
          </div>
        </AuthCard>
      </AuthLayout>
    );
  }

  if (state === 'sent') {
    return (
      <AuthLayout>
        <AuthCard
          title="Check your inbox"
          subtitle={`If that address has a consultation with us, a fresh link is on its way to ${emailDraft}.`}
        >
          <p className="text-center text-sm text-muted">
            Already have a password?{' '}
            <Link href="/auth/sign-in" className="font-semibold text-primary">
              Sign in
            </Link>
            .
          </p>
        </AuthCard>
      </AuthLayout>
    );
  }

  const copy = FAILURE_COPY[failure];

  return (
    <AuthLayout>
      <AuthCard title={copy.title} subtitle={copy.subtitle}>
        <div className="space-y-4">
          <label htmlFor="start-email" className="block text-sm font-medium text-heading">
            Your email
          </label>
          <input
            id="start-email"
            type="email"
            inputMode="email"
            autoComplete="email"
            value={emailDraft}
            onChange={(event) => setEmailDraft(event.target.value)}
            placeholder="you@nhs.net"
            className="w-full rounded-xl border border-stone-200 bg-white px-4 py-3 text-base text-heading outline-none transition focus:border-primary"
          />
          <button
            type="button"
            onClick={resend}
            disabled={sending || !emailDraft.trim()}
            className="w-full rounded-xl bg-primary px-6 py-3.5 text-base font-semibold text-white transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {sending ? 'Sending...' : 'Email me a fresh link'}
          </button>
          <p className="text-center text-sm text-muted">
            Or{' '}
            <Link href="/auth/sign-in" className="font-semibold text-primary">
              sign in
            </Link>{' '}
            if you have set a password.
          </p>
        </div>
      </AuthCard>
    </AuthLayout>
  );
}

/** useSearchParams needs a Suspense boundary for static prerendering. */
export default function AuthStartPage() {
  return (
    <Suspense fallback={null}>
      <StartInner />
    </Suspense>
  );
}
