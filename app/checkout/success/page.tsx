'use client';

import { useEffect, useState, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { motion } from 'framer-motion';
import AuthLayout from '@/components/auth/AuthLayout';
import AuthCard from '@/components/auth/AuthCard';
import PrimaryButton from '@/components/ui/PrimaryButton';
import type { SubscriptionResponse } from '@/app/api/subscription/route';

function CheckoutSuccessContent() {
  const searchParams = useSearchParams();
  const sessionId = searchParams.get('session_id');

  const [access, setAccess] = useState<SubscriptionResponse | null>(null);
  const [timedOut, setTimedOut] = useState(false);
  const [needsPassword, setNeedsPassword] = useState(false);

  useEffect(() => {
    if (!sessionId) return;

    let attempts = 0;
    const maxAttempts = 15;

    const poll = setInterval(async () => {
      attempts++;
      try {
        const res = await fetch('/api/subscription');
        // 401 is the *normal* post-purchase case, not an error: accounts are
        // provisioned by emailed set-password link, so the buyer who just paid
        // has no session yet. Polling can never succeed — stop, and tell them
        // to go and open the email instead of spinning at them for 30 seconds
        // and then pointing at a dashboard they cannot sign in to.
        if (res.status === 401) {
          clearInterval(poll);
          setNeedsPassword(true);
          return;
        }
        const data = await res.json();
        // Wait for the purchase row the webhook writes, not just any answer:
        // a signed-in buyer polls here while provisioning catches up.
        if (data?.state === 'active' && data.plan) {
          setAccess(data as SubscriptionResponse);
          clearInterval(poll);
        }
      } catch {
        // Keep polling
      }

      if (attempts >= maxAttempts) {
        clearInterval(poll);
        setTimedOut(true);
      }
    }, 2000);

    return () => clearInterval(poll);
  }, [sessionId]);

  if (!sessionId) {
    return (
      <AuthLayout>
        <AuthCard
          icon={
            <svg className="w-7 h-7" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 9v2m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          }
          title="Missing Session"
          subtitle="No checkout session found. If you just completed a payment, check your dashboard."
        >
          <Link href="/dashboard" className="block">
            <PrimaryButton fullWidth>Go to Dashboard</PrimaryButton>
          </Link>
        </AuthCard>
      </AuthLayout>
    );
  }

  // Signed out — the ordinary path. Their account exists; the way into it is
  // the email, so that is the only instruction on this card. Deliberately no
  // dashboard CTA: it would bounce them to a sign-in they have no password for.
  if (needsPassword && !access) {
    return (
      <AuthLayout>
        <AuthCard
          icon={
            <svg className="w-7 h-7" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M21.75 6.75v10.5a2.25 2.25 0 01-2.25 2.25h-15a2.25 2.25 0 01-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25m19.5 0v.243a2.25 2.25 0 01-1.07 1.916l-7.5 4.615a2.25 2.25 0 01-2.36 0L3.32 8.91a2.25 2.25 0 01-1.07-1.916V6.75" />
            </svg>
          }
          title="Payment Successful"
          subtitle="Check your email to set your password — that link is how you open your new account."
        >
          <p className="text-[13px] text-muted text-center leading-relaxed">
            The email can take a minute to arrive. If it isn&apos;t there, check your
            spam folder, then email us at{' '}
            <a href="mailto:hello@fourteenfisherman.com" className="text-primary font-medium hover:underline">
              hello@fourteenfisherman.com
            </a>{' '}
            and we&apos;ll sort it out.
          </p>
        </AuthCard>
      </AuthLayout>
    );
  }

  // Still polling
  if (!access && !timedOut) {
    return (
      <AuthLayout>
        <AuthCard
          icon={
            <motion.div
              animate={{ rotate: 360 }}
              transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
            >
              <svg className="w-7 h-7" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182" />
              </svg>
            </motion.div>
          }
          title="Activating Your Plan..."
          subtitle="Payment received. We're setting up your account — this usually takes a few seconds."
        >
          <div className="flex justify-center">
            <div className="w-8 h-8 rounded-full border-2 border-primary border-t-transparent animate-spin" />
          </div>
        </AuthCard>
      </AuthLayout>
    );
  }

  // Timed out
  if (timedOut && !access) {
    return (
      <AuthLayout>
        <AuthCard
          icon={
            <svg className="w-7 h-7" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          }
          accentColor="blue"
          title="Payment Successful"
          subtitle="Your payment was received. It may take a moment to activate. Check your dashboard shortly."
        >
          <Link href="/dashboard" className="block">
            <PrimaryButton fullWidth>Go to Dashboard</PrimaryButton>
          </Link>
        </AuthCard>
      </AuthLayout>
    );
  }

  // Success
  const planName = access!.planName || access!.plan;
  const expiryDate = access!.expiresAt
    ? new Date(access!.expiresAt).toLocaleDateString('en-GB', {
        day: 'numeric',
        month: 'long',
        year: 'numeric',
      })
    : null;

  return (
    <AuthLayout>
      <AuthCard
        icon={
          <svg className="w-7 h-7" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        }
        title="You're All Set!"
        subtitle={`Your ${planName} plan is now active.`}
      >
        <div className="space-y-4">
          <div className="rounded-xl bg-black/[0.02] border border-black/[0.06] p-4 space-y-2">
            <div className="flex justify-between text-[13px]">
              <span className="text-muted">Plan</span>
              <span className="font-semibold text-heading">{planName}</span>
            </div>
            <div className="flex justify-between text-[13px]">
              <span className="text-muted">Billing</span>
              <span className="font-semibold text-heading">
                {access!.isMonthly ? 'Monthly · cancel any time' : 'One-off · unlimited access'}
              </span>
            </div>
            {expiryDate && (
              <div className="flex justify-between text-[13px]">
                <span className="text-muted">Expires</span>
                <span className="font-semibold text-heading">{expiryDate}</span>
              </div>
            )}
          </div>

          <Link href="/dashboard" className="block">
            <PrimaryButton fullWidth>
              Go to Dashboard
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" />
              </svg>
            </PrimaryButton>
          </Link>
        </div>
      </AuthCard>
    </AuthLayout>
  );
}

export default function CheckoutSuccessPage() {
  return (
    <Suspense
      fallback={
        <AuthLayout>
          <div className="flex items-center justify-center py-20">
            <div className="w-8 h-8 rounded-full border-2 border-primary border-t-transparent animate-spin" />
          </div>
        </AuthLayout>
      }
    >
      <CheckoutSuccessContent />
    </Suspense>
  );
}
