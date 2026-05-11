'use client';

import { useParams, useRouter } from 'next/navigation';
import { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';
import Link from 'next/link';
import { motion } from 'framer-motion';
import Container from '@/components/ui/Container';
import PrimaryButton from '@/components/ui/PrimaryButton';
import ScoreBadge from '@/components/ui/ScoreBadge';
import AuthCard from '@/components/auth/AuthCard';
import AuthInput from '@/components/auth/AuthInput';

type AuthMode = 'sign-up' | 'sign-in';

interface FeedbackPreview {
  overall_score: number;
  passed: boolean;
  data_gathering_score: number;
  clinical_management_score: number;
  interpersonal_skills_score: number;
}

export default function TryFeedbackAuthGatePage() {
  const params = useParams();
  const router = useRouter();
  const sessionId = params.sessionId as string;

  const [authMode, setAuthMode] = useState<AuthMode>('sign-up');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [checkingAuth, setCheckingAuth] = useState(true);
  const [emailConfirmationSent, setEmailConfirmationSent] = useState(false);
  const [feedback, setFeedback] = useState<FeedbackPreview | null>(null);

  const supabase = createClient();

  // Set free trial cookie — user completed a consultation
  useEffect(() => {
    document.cookie = 'ff_free_trial_used=true; path=/; max-age=31536000; SameSite=Lax';
  }, []);

  // Try to load partial feedback from the session
  useEffect(() => {
    async function loadFeedback() {
      try {
        const { data } = await supabase
          .from('session_results')
          .select('overall_score, passed, data_gathering_score, clinical_management_score, interpersonal_skills_score')
          .eq('session_id', sessionId)
          .single();

        if (data) {
          setFeedback({
            overall_score: data.overall_score ?? 0,
            passed: data.passed ?? false,
            data_gathering_score: data.data_gathering_score ?? 0,
            clinical_management_score: data.clinical_management_score ?? 0,
            interpersonal_skills_score: data.interpersonal_skills_score ?? 0,
          });
        }
      } catch {
        // Feedback may not be ready yet
      }
    }
    loadFeedback();
  }, [sessionId, supabase]);

  useEffect(() => {
    async function checkAuth() {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        await claimAndRedirect();
      } else {
        setCheckingAuth(false);
      }
    }
    checkAuth();

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event) => {
      if (event === 'SIGNED_IN') {
        await claimAndRedirect();
      }
    });

    return () => subscription.unsubscribe();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function claimAndRedirect() {
    try {
      const res = await fetch('/api/try/claim-session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId }),
      });

      if (!res.ok) {
        const data = await res.json();
        if (!data.alreadyClaimed) {
          // Non-critical error
        }
      }
    } catch {
      // Non-critical error
    }

    router.push(`/clinical-master/feedback/${sessionId}`);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      if (authMode === 'sign-up') {
        const { data, error: signUpError } = await supabase.auth.signUp({
          email: email.trim(),
          password,
          options: {
            data: { full_name: fullName.trim() },
            emailRedirectTo: `${window.location.origin}/auth/callback?next=/clinical-master/feedback/${sessionId}`,
          },
        });

        if (signUpError) {
          setError(signUpError.message);
          setLoading(false);
          return;
        }

        if (data.user && !data.session) {
          setEmailConfirmationSent(true);
          setLoading(false);
          return;
        }

        if (data.session) {
          await claimAndRedirect();
        }
      } else {
        const { data, error: signInError } = await supabase.auth.signInWithPassword({
          email: email.trim(),
          password,
        });

        if (signInError) {
          setError(signInError.message);
          setLoading(false);
          return;
        }

        if (data.user) {
          await claimAndRedirect();
        }
      }
    } catch {
      setError('An unexpected error occurred');
      setLoading(false);
    }
  }

  async function handleResend() {
    try {
      await supabase.auth.resend({ type: 'signup', email: email.trim() });
    } catch {
      // Handle silently
    }
  }

  if (checkingAuth) {
    return (
      <div className="min-h-[100dvh] flex items-center justify-center">
        <motion.div
          className="w-8 h-8 rounded-full border-2 border-primary border-t-transparent"
          animate={{ rotate: 360 }}
          transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
        />
      </div>
    );
  }

  if (emailConfirmationSent) {
    return (
      <div className="min-h-[100dvh] flex items-center justify-center p-6">
        <div className="max-w-md w-full">
          <AuthCard
            icon={
              <svg className="w-7 h-7" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
              </svg>
            }
            accentColor="blue"
            title="Check Your Email"
            subtitle={`We've sent a confirmation link to ${email}. Click the link, then come back to view your feedback.`}
          >
            <div className="space-y-4">
              <p className="text-[12px] text-muted text-center">
                Your feedback has been saved and will be waiting for you after you confirm.
              </p>
              <button
                onClick={handleResend}
                className="w-full text-[13px] text-primary hover:underline font-medium cursor-pointer"
              >
                Resend confirmation email
              </button>
              <button
                onClick={() => {
                  setEmailConfirmationSent(false);
                  setAuthMode('sign-in');
                }}
                className="w-full text-[13px] text-muted hover:text-heading transition-colors cursor-pointer"
              >
                Already confirmed? Sign in here
              </button>
            </div>
          </AuthCard>
        </div>
      </div>
    );
  }

  const domainBars = feedback ? [
    { label: 'Data Gathering', score: feedback.data_gathering_score },
    { label: 'Clinical Management', score: feedback.clinical_management_score },
    { label: 'Interpersonal Skills', score: feedback.interpersonal_skills_score },
  ] : [];

  return (
    <div className="min-h-[100dvh] flex flex-col items-center justify-center px-6 py-16">
      {/* Header */}
      <motion.div
        className="text-center mb-8"
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ type: 'spring', stiffness: 60, damping: 20 }}
      >
        <span
          className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg text-[11px] font-semibold uppercase tracking-wide mb-4"
          style={{ background: 'rgba(22,163,74,0.08)', color: '#16A34A' }}
        >
          Consultation Complete
        </span>
        <h1 className="text-[28px] font-bold text-heading tracking-[-0.02em] mb-2">
          Your Assessment is Ready
        </h1>
        <p className="text-[14px] text-muted">
          Sign up to see your full feedback and track your progress
        </p>
      </motion.div>

      <div className="w-full max-w-[900px] flex flex-col lg:flex-row gap-8 items-start">
        {/* Partial feedback preview */}
        <motion.div
          className="flex-1 w-full"
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
        >
          <Container>
            {/* Score hero */}
            {feedback ? (
              <div className="text-center mb-6">
                <div
                  className="text-[48px] font-bold font-mono mb-1"
                  style={{
                    background: 'linear-gradient(135deg, #B45309, #D97706)',
                    WebkitBackgroundClip: 'text',
                    WebkitTextFillColor: 'transparent',
                  }}
                >
                  {feedback.overall_score}
                </div>
                <div className="text-[13px] text-muted mb-3">out of 100</div>
                <ScoreBadge score={feedback.overall_score} showLabel />
              </div>
            ) : (
              <div className="text-center py-6">
                <motion.div
                  className="w-6 h-6 rounded-full border-2 border-primary border-t-transparent mx-auto mb-2"
                  animate={{ rotate: 360 }}
                  transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
                />
                <p className="text-[13px] text-muted">Loading feedback...</p>
              </div>
            )}

            {/* Domain bars */}
            {domainBars.length > 0 && (
              <div className="space-y-3 mb-6">
                {domainBars.map((bar, i) => (
                  <div key={bar.label}>
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-[13px] font-medium text-heading">{bar.label}</span>
                      <span className="text-[12px] font-mono font-semibold text-primary">{bar.score}%</span>
                    </div>
                    <div className="h-2 rounded-full bg-black/[0.04] overflow-hidden">
                      <motion.div
                        className="h-full rounded-full"
                        style={{ background: 'linear-gradient(90deg, #B45309, #D97706)' }}
                        initial={{ width: 0 }}
                        animate={{ width: `${bar.score}%` }}
                        transition={{ type: 'spring', stiffness: 40, damping: 20, delay: 0.3 + i * 0.1 }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Gradient fade overlay for hidden content */}
            <div className="relative">
              <div className="space-y-3 opacity-30 blur-[2px]">
                <div className="h-4 bg-black/[0.04] rounded w-3/4" />
                <div className="h-4 bg-black/[0.04] rounded w-full" />
                <div className="h-4 bg-black/[0.04] rounded w-2/3" />
                <div className="h-4 bg-black/[0.04] rounded w-5/6" />
                <div className="h-4 bg-black/[0.04] rounded w-1/2" />
              </div>
              <div className="absolute inset-0 bg-gradient-to-t from-surface-raised to-transparent" />
            </div>

            <div className="text-center mt-4">
              <p className="text-[13px] text-muted">
                Sign up to see strengths, improvements, and learning points
              </p>
            </div>
          </Container>
        </motion.div>

        {/* Auth panel */}
        <motion.div
          className="w-full lg:w-[400px] shrink-0"
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
        >
          <AuthCard
            title={authMode === 'sign-up' ? 'Create Account' : 'Sign In'}
            subtitle={authMode === 'sign-up' ? 'Unlock your full feedback report' : 'Welcome back'}
          >
            {/* Toggle */}
            <div className="flex bg-black/[0.03] rounded-xl p-1 mb-5">
              <button
                onClick={() => setAuthMode('sign-up')}
                className={`flex-1 min-h-[44px] py-2 rounded-lg text-[13px] font-semibold transition-all cursor-pointer ${
                  authMode === 'sign-up'
                    ? 'bg-white shadow-sm text-heading'
                    : 'text-muted hover:text-heading'
                }`}
              >
                Sign Up
              </button>
              <button
                onClick={() => setAuthMode('sign-in')}
                className={`flex-1 min-h-[44px] py-2 rounded-lg text-[13px] font-semibold transition-all cursor-pointer ${
                  authMode === 'sign-in'
                    ? 'bg-white shadow-sm text-heading'
                    : 'text-muted hover:text-heading'
                }`}
              >
                Sign In
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              {authMode === 'sign-up' && (
                <AuthInput
                  label="Full Name"
                  type="text"
                  icon="user"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder="Dr. John Smith"
                  required
                  autoComplete="name"
                />
              )}

              <AuthInput
                label="Email Address"
                type="email"
                icon="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="doctor@example.com"
                required
                autoComplete="email"
              />

              <AuthInput
                label="Password"
                type="password"
                icon="lock"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Minimum 8 characters"
                required
                minLength={8}
                autoComplete={authMode === 'sign-up' ? 'new-password' : 'current-password'}
              />

              {error && (
                <div className="p-3 bg-danger/10 border border-danger/20 rounded-lg">
                  <p className="text-danger text-sm text-center">{error}</p>
                </div>
              )}

              <PrimaryButton type="submit" fullWidth disabled={loading}>
                {loading
                  ? 'Please wait...'
                  : authMode === 'sign-up'
                    ? 'Sign Up & View Feedback'
                    : 'Sign In & View Feedback'
                }
              </PrimaryButton>
            </form>

            {authMode === 'sign-in' && (
              <div className="mt-4 text-center">
                <Link href="/auth/forgot-password" className="text-[13px] text-primary hover:underline transition-colors">
                  Forgot password?
                </Link>
              </div>
            )}
          </AuthCard>
        </motion.div>
      </div>
    </div>
  );
}
