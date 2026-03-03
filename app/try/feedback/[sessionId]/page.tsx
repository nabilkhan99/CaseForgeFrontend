'use client';

import { useParams, useRouter } from 'next/navigation';
import { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';
import Link from 'next/link';

type AuthMode = 'sign-up' | 'sign-in';

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

    const supabase = createClient();

    // Check if user is already authenticated (or comes back after confirming email)
    useEffect(() => {
        async function checkAuth() {
            const { data: { user } } = await supabase.auth.getUser();
            if (user) {
                // Already authenticated — claim and redirect
                await claimAndRedirect();
            } else {
                setCheckingAuth(false);
            }
        }
        checkAuth();

        // Listen for auth state changes (e.g. user confirms email and comes back)
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
            // Claim the guest session (uses the auth cookie set by Supabase)
            const res = await fetch('/api/try/claim-session', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ sessionId }),
            });

            if (!res.ok) {
                const data = await res.json();
                // Session already claimed is fine — proceed
                if (!data.alreadyClaimed) {
                    console.error('Failed to claim session:', data.error);
                }
            }
        } catch (err) {
            console.error('Error claiming session:', err);
        }

        // Redirect to the real feedback page
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
                        emailRedirectTo: `${window.location.origin}/try/feedback/${sessionId}`,
                    },
                });

                if (signUpError) {
                    setError(signUpError.message);
                    setLoading(false);
                    return;
                }

                // If session is null, email confirmation is required
                if (data.user && !data.session) {
                    setEmailConfirmationSent(true);
                    setLoading(false);
                    return;
                }

                // Session exists — user is immediately authenticated (email confirm disabled)
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

    if (checkingAuth) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-[#070A13]">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500" />
            </div>
        );
    }

    if (emailConfirmationSent) {
        return (
            <div className="min-h-screen flex items-center justify-center p-6 bg-[#070A13]">
                <div className="glass-card rounded-2xl p-10 border border-white/10 max-w-md text-center">
                    <div className="w-16 h-16 rounded-full bg-blue-500/10 border border-blue-500/20 flex items-center justify-center mx-auto mb-6">
                        <span className="material-symbols-outlined text-3xl text-blue-400">mark_email_read</span>
                    </div>
                    <h2 className="text-2xl font-bold text-white mb-3">Check Your Email</h2>
                    <p className="text-slate-400 text-sm mb-6 leading-relaxed">
                        We&apos;ve sent a confirmation link to <span className="text-white font-medium">{email}</span>.
                        Click the link in the email, then come back here to view your feedback.
                    </p>
                    <div className="p-3 bg-blue-500/5 border border-blue-500/20 rounded-lg text-xs text-blue-300">
                        <span className="material-symbols-outlined align-middle mr-1" style={{ fontSize: '14px' }}>info</span>
                        Your feedback has been saved and will be waiting for you after you confirm.
                    </div>
                    <button
                        onClick={() => {
                            setEmailConfirmationSent(false);
                            setAuthMode('sign-in');
                        }}
                        className="mt-6 text-sm text-slate-400 hover:text-white transition-colors underline underline-offset-4"
                    >
                        Already confirmed? Sign in here
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen flex flex-col items-center justify-center p-6 relative overflow-hidden">
            {/* Background effects */}
            <div className="absolute inset-0 bg-gradient-to-b from-blue-900/20 via-[#070A13] to-[#070A13]" />
            <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-[600px] h-[600px] bg-blue-500/5 rounded-full blur-3xl" />

            <div className="relative z-10 w-full max-w-5xl">
                {/* Header */}
                <div className="text-center mb-8">
                    <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-green-500/10 border border-green-500/20 text-green-400 text-xs font-semibold mb-4">
                        <span className="material-symbols-outlined" style={{ fontSize: '14px' }}>check_circle</span>
                        CONSULTATION COMPLETE
                    </div>
                    <h1 className="text-3xl md:text-4xl font-bold text-white tracking-tight mb-3">
                        Your Assessment is <span className="bg-gradient-to-r from-blue-400 to-cyan-400 bg-clip-text text-transparent">Ready</span>
                    </h1>
                    <p className="text-slate-400 text-base">
                        Sign up to unlock your detailed AI-powered feedback report
                    </p>
                </div>

                {/* Main Content: Blurred Preview + Auth Panel */}
                <div className="flex flex-col lg:flex-row gap-8 items-stretch">
                    {/* Blurred Feedback Preview */}
                    <div className="flex-1 relative rounded-2xl overflow-hidden">
                        {/* Blur overlay */}
                        <div className="absolute inset-0 z-20 backdrop-blur-md bg-black/30" />

                        {/* Lock icon overlay */}
                        <div className="absolute inset-0 z-30 flex items-center justify-center">
                            <div className="glass-card rounded-2xl p-6 text-center">
                                <span className="material-symbols-outlined text-4xl text-blue-400 mb-2 block">lock</span>
                                <p className="text-white font-semibold text-sm">Sign up to unlock</p>
                            </div>
                        </div>

                        {/* Fake feedback cards (visible but blurred) */}
                        <div className="p-6 space-y-4 relative z-10">
                            {/* Overall score card */}
                            <div className="glass-card rounded-xl p-6">
                                <div className="flex items-center justify-between mb-4">
                                    <h3 className="text-lg font-bold text-white">Overall Performance</h3>
                                    <div className="text-3xl font-bold text-green-400">72%</div>
                                </div>
                                <div className="h-3 bg-slate-700 rounded-full overflow-hidden">
                                    <div className="h-full w-[72%] bg-gradient-to-r from-green-500 to-emerald-400 rounded-full" />
                                </div>
                            </div>

                            {/* Domain scores */}
                            <div className="grid grid-cols-3 gap-3">
                                {[
                                    { name: 'Data Gathering', score: 68, color: 'blue' },
                                    { name: 'Clinical Management', score: 74, color: 'purple' },
                                    { name: 'Interpersonal Skills', score: 75, color: 'cyan' },
                                ].map((domain) => (
                                    <div key={domain.name} className="glass-card rounded-xl p-4 text-center">
                                        <div className={`text-2xl font-bold text-${domain.color}-400 mb-1`}>{domain.score}%</div>
                                        <div className="text-xs text-slate-400">{domain.name}</div>
                                    </div>
                                ))}
                            </div>

                            {/* Fake strengths/improvements */}
                            <div className="glass-card rounded-xl p-4">
                                <h4 className="text-sm font-semibold text-white mb-3">Key Strengths</h4>
                                <div className="space-y-2">
                                    {['Excellent rapport building with the patient', 'Systematic approach to history taking', 'Clear safety-netting advice'].map((s, i) => (
                                        <div key={i} className="flex items-start gap-2">
                                            <span className="text-green-400 mt-0.5">✓</span>
                                            <span className="text-sm text-slate-300">{s}</span>
                                        </div>
                                    ))}
                                </div>
                            </div>

                            <div className="glass-card rounded-xl p-4">
                                <h4 className="text-sm font-semibold text-white mb-3">Areas for Improvement</h4>
                                <div className="space-y-2">
                                    {['Explore red flag symptoms more systematically', 'Consider broader differential diagnosis'].map((s, i) => (
                                        <div key={i} className="flex items-start gap-2">
                                            <span className="text-amber-400 mt-0.5">→</span>
                                            <span className="text-sm text-slate-300">{s}</span>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Auth Panel */}
                    <div className="w-full lg:w-[400px] shrink-0">
                        <div className="glass-card rounded-2xl p-8 border border-white/10 shadow-2xl shadow-blue-500/5">
                            {/* Toggle */}
                            <div className="flex bg-white/5 rounded-xl p-1 mb-6">
                                <button
                                    onClick={() => setAuthMode('sign-up')}
                                    className={`flex-1 py-2 rounded-lg text-sm font-semibold transition-all ${authMode === 'sign-up'
                                        ? 'bg-blue-600 text-white shadow-lg'
                                        : 'text-slate-400 hover:text-white'
                                        }`}
                                >
                                    Sign Up
                                </button>
                                <button
                                    onClick={() => setAuthMode('sign-in')}
                                    className={`flex-1 py-2 rounded-lg text-sm font-semibold transition-all ${authMode === 'sign-in'
                                        ? 'bg-blue-600 text-white shadow-lg'
                                        : 'text-slate-400 hover:text-white'
                                        }`}
                                >
                                    Sign In
                                </button>
                            </div>

                            <form onSubmit={handleSubmit} className="space-y-4">
                                {authMode === 'sign-up' && (
                                    <div>
                                        <label className="block text-xs font-medium text-slate-400 mb-1.5">Full Name</label>
                                        <input
                                            type="text"
                                            value={fullName}
                                            onChange={(e) => setFullName(e.target.value)}
                                            placeholder="Dr. John Smith"
                                            className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all text-sm"
                                            required
                                        />
                                    </div>
                                )}

                                <div>
                                    <label className="block text-xs font-medium text-slate-400 mb-1.5">Email Address</label>
                                    <input
                                        type="email"
                                        value={email}
                                        onChange={(e) => setEmail(e.target.value)}
                                        placeholder="doctor@example.com"
                                        className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all text-sm"
                                        required
                                        autoComplete="email"
                                    />
                                </div>

                                <div>
                                    <label className="block text-xs font-medium text-slate-400 mb-1.5">Password</label>
                                    <input
                                        type="password"
                                        value={password}
                                        onChange={(e) => setPassword(e.target.value)}
                                        placeholder="••••••••"
                                        className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all text-sm"
                                        required
                                        minLength={6}
                                        autoComplete={authMode === 'sign-up' ? 'new-password' : 'current-password'}
                                    />
                                </div>

                                {error && (
                                    <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-lg">
                                        <p className="text-red-400 text-sm text-center">{error}</p>
                                    </div>
                                )}

                                <button
                                    type="submit"
                                    disabled={loading}
                                    className="w-full py-3 bg-gradient-to-r from-blue-600 to-blue-500 hover:from-blue-500 hover:to-blue-400 disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold rounded-xl transition-all flex items-center justify-center gap-2 shadow-lg shadow-blue-500/20"
                                >
                                    {loading ? (
                                        <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white" />
                                    ) : (
                                        <>
                                            {authMode === 'sign-up' ? 'Sign Up & View Feedback' : 'Sign In & View Feedback'}
                                            <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>arrow_forward</span>
                                        </>
                                    )}
                                </button>
                            </form>

                            {/* Benefits */}
                            {authMode === 'sign-up' && (
                                <div className="mt-6 pt-6 border-t border-white/5">
                                    <p className="text-xs text-slate-500 font-medium mb-3">Your free account includes:</p>
                                    <div className="space-y-2">
                                        {[
                                            'Detailed domain-by-domain scoring',
                                            'Personalised strengths & improvements',
                                            'Key learning points for exam prep',
                                        ].map((benefit, i) => (
                                            <div key={i} className="flex items-center gap-2">
                                                <span className="material-symbols-outlined text-blue-400" style={{ fontSize: '14px' }}>check</span>
                                                <span className="text-xs text-slate-400">{benefit}</span>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {/* Forgot password (sign-in mode) */}
                            {authMode === 'sign-in' && (
                                <div className="mt-4 text-center">
                                    <Link href="/auth/forgot-password" className="text-blue-400 hover:text-blue-300 text-xs transition-colors">
                                        Forgot Password?
                                    </Link>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
