'use client';

import Image from 'next/image';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useRouter } from 'next/navigation';
import type { User } from '@supabase/supabase-js';

export default function Navbar() {
    const [user, setUser] = useState<User | null>(null);
    const [loading, setLoading] = useState(true);
    const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
    const supabase = createClient();
    const router = useRouter();

    useEffect(() => {
        // Get initial session
        supabase.auth.getUser().then(({ data: { user } }) => {
            setUser(user);
            setLoading(false);
        });

        // Listen for auth changes
        const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
            setUser(session?.user ?? null);
        });

        return () => subscription.unsubscribe();
    }, [supabase.auth]);

    const handleSignOut = async () => {
        await supabase.auth.signOut();
        router.push('/');
        router.refresh();
    };

    return (
        <nav className="fixed top-0 w-full z-50 glass-panel border-b border-slate-800/50">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                <div className="flex items-center justify-between h-16">
                    <Link href="/" className="flex items-center gap-3">
                        <Image
                            src="/fourteenfishermann.png"
                            alt="Fourteen Fisherman"
                            width={40}
                            height={40}
                            className="h-10 w-auto"
                        />
                    </Link>

                    <div className="hidden md:flex items-center gap-8 text-sm font-medium">
                        <a
                            href="#features"
                            className="text-slate-300 hover:text-white transition-colors"
                        >
                            Features
                        </a>
                        <a
                            href="#pricing"
                            className="text-slate-300 hover:text-white transition-colors"
                        >
                            Pricing
                        </a>
                        <a
                            href="#stations"
                            className="text-slate-300 hover:text-white transition-colors"
                        >
                            Stations
                        </a>
                        <Link
                            href="/cases"
                            className="text-slate-300 hover:text-white transition-colors"
                        >
                            Cases
                        </Link>

                        {loading ? (
                            <div className="w-20 h-9 bg-slate-800/50 rounded-lg animate-pulse" />
                        ) : user ? (
                            <div className="flex items-center gap-3">
                                <Link
                                    href="/dashboard"
                                    className="px-4 py-2 bg-primary/10 text-primary border border-primary/20 rounded-lg hover:bg-primary hover:text-white transition-all"
                                >
                                    Dashboard
                                </Link>
                                <button
                                    onClick={handleSignOut}
                                    className="px-4 py-2 text-slate-400 hover:text-white transition-colors"
                                >
                                    Sign Out
                                </button>
                            </div>
                        ) : (
                            <Link
                                href="/auth/sign-in"
                                className="px-4 py-2 bg-primary/10 text-primary border border-primary/20 rounded-lg hover:bg-primary hover:text-white transition-all"
                            >
                                Sign In
                            </Link>
                        )}
                    </div>

                    {/* Mobile menu button */}
                    <button
                        className="md:hidden p-2 min-h-[44px] min-w-[44px] flex items-center justify-center text-slate-400 hover:text-white rounded-lg hover:bg-white/5 transition-colors"
                        onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                        aria-label={mobileMenuOpen ? 'Close menu' : 'Open menu'}
                    >
                        <span className="material-symbols-outlined">
                            {mobileMenuOpen ? 'close' : 'menu'}
                        </span>
                    </button>
                </div>

                {/* Mobile menu */}
                {mobileMenuOpen && (
                    <div className="md:hidden border-t border-slate-800/50 py-4 space-y-1">
                        <a
                            href="#features"
                            className="block px-4 py-3 min-h-[44px] flex items-center text-slate-300 hover:text-white transition-colors rounded-lg"
                            onClick={() => setMobileMenuOpen(false)}
                        >
                            Features
                        </a>
                        <a
                            href="#pricing"
                            className="block px-4 py-3 min-h-[44px] flex items-center text-slate-300 hover:text-white transition-colors rounded-lg"
                            onClick={() => setMobileMenuOpen(false)}
                        >
                            Pricing
                        </a>
                        <a
                            href="#stations"
                            className="block px-4 py-3 min-h-[44px] flex items-center text-slate-300 hover:text-white transition-colors rounded-lg"
                            onClick={() => setMobileMenuOpen(false)}
                        >
                            Stations
                        </a>
                        <Link
                            href="/cases"
                            className="block px-4 py-3 min-h-[44px] flex items-center text-slate-300 hover:text-white transition-colors rounded-lg"
                            onClick={() => setMobileMenuOpen(false)}
                        >
                            Cases
                        </Link>

                        {!loading && (
                            user ? (
                                <div className="space-y-1 pt-2 border-t border-slate-800/50">
                                    <Link
                                        href="/dashboard"
                                        className="block px-4 py-3 min-h-[44px] flex items-center text-primary hover:text-white transition-colors rounded-lg"
                                        onClick={() => setMobileMenuOpen(false)}
                                    >
                                        Dashboard
                                    </Link>
                                    <button
                                        onClick={() => {
                                            handleSignOut();
                                            setMobileMenuOpen(false);
                                        }}
                                        className="block w-full text-left px-4 py-3 min-h-[44px] flex items-center text-slate-400 hover:text-white transition-colors rounded-lg"
                                    >
                                        Sign Out
                                    </button>
                                </div>
                            ) : (
                                <Link
                                    href="/auth/sign-in"
                                    className="block px-4 py-3 min-h-[44px] flex items-center text-primary hover:text-white transition-colors rounded-lg"
                                    onClick={() => setMobileMenuOpen(false)}
                                >
                                    Sign In
                                </Link>
                            )
                        )}
                    </div>
                )}
            </div>
        </nav>
    );
}
