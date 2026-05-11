'use client';

import { useEffect, useState, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { motion } from 'framer-motion';
import AuthLayout from '@/components/auth/AuthLayout';
import AuthCard from '@/components/auth/AuthCard';
import PrimaryButton from '@/components/ui/PrimaryButton';

interface SubscriptionData {
  plan: string;
  expires_at: string;
  days_remaining: number;
}

const PLAN_NAMES: Record<string, string> = {
  sprint: 'The Sprint',
  standard: 'The Standard',
  mastery: 'The Mastery',
};

const PLAN_DURATIONS: Record<string, string> = {
  sprint: '30 days',
  standard: '90 days',
  mastery: '180 days',
};

function CheckoutSuccessContent() {
  const searchParams = useSearchParams();
  const sessionId = searchParams.get('session_id');

  const [subscription, setSubscription] = useState<SubscriptionData | null>(null);
  const [timedOut, setTimedOut] = useState(false);

  useEffect(() => {
    if (!sessionId) return;

    let attempts = 0;
    const maxAttempts = 15;

    const poll = setInterval(async () => {
      attempts++;
      try {
        const res = await fetch('/api/subscription');
        const data = await res.json();
        if (data.subscription) {
          setSubscription(data.subscription);
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

  // Still polling
  if (!subscription && !timedOut) {
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
  if (timedOut && !subscription) {
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
  const planName = PLAN_NAMES[subscription!.plan] || subscription!.plan;
  const planDuration = PLAN_DURATIONS[subscription!.plan] || '';
  const expiryDate = new Date(subscription!.expires_at).toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });

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
              <span className="text-muted">Duration</span>
              <span className="font-semibold text-heading">{planDuration} unlimited access</span>
            </div>
            <div className="flex justify-between text-[13px]">
              <span className="text-muted">Expires</span>
              <span className="font-semibold text-heading">{expiryDate}</span>
            </div>
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
