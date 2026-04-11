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
    const [scrolled, setScrolled] = useState(false);
    const supabase = createClient();
    const router = useRouter();

    useEffect(() => {
        supabase.auth.getUser().then(({ data: { user } }) => {
            setUser(user);
            setLoading(false);
        });

        const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
            setUser(session?.user ?? null);
        });

        return () => subscription.unsubscribe();
    }, [supabase.auth]);

    useEffect(() => {
        const handleScroll = () => setScrolled(window.scrollY > 20);
        window.addEventListener('scroll', handleScroll, { passive: true });
        return () => window.removeEventListener('scroll', handleScroll);
    }, []);

    const handleSignOut = async () => {
        await supabase.auth.signOut();
        router.push('/');
        router.refresh();
    };

    return (
        <div className="fixed top-4 inset-x-0 z-50 flex justify-center px-4">
            <nav
                style={{ maxWidth: 'min(92%, 1200px)' }}
                className={`w-full rounded-[14px] border border-black/[0.04] shadow-elevation-2 transition-all duration-300 ${
                    scrolled
                        ? 'bg-white/[0.92] backdrop-blur-2xl'
                        : 'bg-white/[0.72] backdrop-blur-2xl'
                }`}
            >
                <div className="px-4 sm:px-5">
                    <div className="flex items-center justify-between h-14">
                        {/* Brand */}
                        <Link href="/" className="flex items-center gap-2.5">
                            <Image
                                src="/fourteenfishermann.png"
                                alt="Fourteen Fisherman"
                                width={32}
                                height={32}
                                className="h-8 w-auto"
                            />
                            <span className="font-extrabold text-[15px] tracking-[-0.03em] text-heading">
                                Fourteen Fisherman
                            </span>
                        </Link>

                        {/* Desktop nav */}
                        <div className="hidden md:flex items-center gap-0.5">
                            <Link
                                href="/pricing"
                                className="px-3 py-2 text-[13px] font-medium text-muted hover:text-primary transition-colors rounded-lg"
                            >
                                Pricing
                            </Link>
                            <Link
                                href="/cases"
                                className="px-3 py-2 text-[13px] font-medium text-muted hover:text-primary transition-colors rounded-lg"
                            >
                                Cases
                            </Link>
                            <a
                                href="https://fourteenfisherman.com"
                                target="_blank"
                                rel="noopener noreferrer"
                                className="px-3 py-2 text-[13px] font-medium text-muted hover:text-primary transition-colors rounded-lg flex items-center gap-1"
                            >
                                Portfolio Tool
                                <svg
                                    xmlns="http://www.w3.org/2000/svg"
                                    width="10"
                                    height="10"
                                    viewBox="0 0 24 24"
                                    fill="none"
                                    stroke="currentColor"
                                    strokeWidth="2"
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    aria-hidden="true"
                                >
                                    <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
                                    <polyline points="15 3 21 3 21 9" />
                                    <line x1="10" y1="14" x2="21" y2="3" />
                                </svg>
                            </a>

                            <div className="w-px h-4 bg-black/[0.08] mx-2" />

                            {loading ? (
                                <div className="w-20 h-8 bg-stone-100 rounded-lg animate-pulse" />
                            ) : user ? (
                                <div className="flex items-center gap-0.5">
                                    <Link
                                        href="/dashboard"
                                        className="px-3 py-2 text-[13px] font-medium text-muted hover:text-primary transition-colors rounded-lg"
                                    >
                                        Dashboard
                                    </Link>
                                    <button
                                        onClick={handleSignOut}
                                        className="px-3 py-2 text-[13px] font-medium text-muted hover:text-primary transition-colors rounded-lg"
                                    >
                                        Sign Out
                                    </button>
                                </div>
                            ) : (
                                <div className="flex items-center gap-2">
                                    <Link
                                        href="/auth/sign-in"
                                        className="px-3 py-2 text-[13px] font-medium text-muted hover:text-primary transition-colors rounded-lg"
                                    >
                                        Sign In
                                    </Link>
                                    <Link
                                        href="/try"
                                        className="px-[18px] py-2 bg-gradient-to-br from-primary to-primary-light text-white text-[13px] font-semibold rounded-[9px] shadow-elevation-1 hover:shadow-elevation-2 transition-all active:scale-[0.98]"
                                    >
                                        Start Free
                                    </Link>
                                </div>
                            )}
                        </div>

                        {/* Mobile controls */}
                        <div className="md:hidden flex items-center gap-2">
                            <Link
                                href="/try"
                                className="px-[14px] py-1.5 bg-gradient-to-br from-primary to-primary-light text-white text-[12px] font-semibold rounded-[9px] shadow-elevation-1"
                            >
                                Start Free
                            </Link>
                            <button
                                className="p-2 min-h-[44px] min-w-[44px] flex items-center justify-center text-muted hover:text-heading rounded-lg transition-colors"
                                onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                                aria-label={mobileMenuOpen ? 'Close menu' : 'Open menu'}
                            >
                                {mobileMenuOpen ? (
                                    <svg
                                        xmlns="http://www.w3.org/2000/svg"
                                        width="20"
                                        height="20"
                                        viewBox="0 0 24 24"
                                        fill="none"
                                        stroke="currentColor"
                                        strokeWidth="2"
                                        strokeLinecap="round"
                                        strokeLinejoin="round"
                                        aria-hidden="true"
                                    >
                                        <line x1="18" y1="6" x2="6" y2="18" />
                                        <line x1="6" y1="6" x2="18" y2="18" />
                                    </svg>
                                ) : (
                                    <svg
                                        xmlns="http://www.w3.org/2000/svg"
                                        width="20"
                                        height="20"
                                        viewBox="0 0 24 24"
                                        fill="none"
                                        stroke="currentColor"
                                        strokeWidth="2"
                                        strokeLinecap="round"
                                        strokeLinejoin="round"
                                        aria-hidden="true"
                                    >
                                        <line x1="3" y1="6" x2="21" y2="6" />
                                        <line x1="3" y1="12" x2="21" y2="12" />
                                        <line x1="3" y1="18" x2="21" y2="18" />
                                    </svg>
                                )}
                            </button>
                        </div>
                    </div>
                </div>

                {/* Mobile dropdown */}
                {mobileMenuOpen && (
                    <div className="md:hidden mx-2 mb-2 bg-white/90 backdrop-blur-xl border border-black/[0.04] shadow-elevation-3 rounded-xl py-2 space-y-0.5 px-2 animate-slideDown">
                        <Link
                            href="/pricing"
                            className="block px-4 py-3 min-h-[44px] flex items-center text-[13px] font-medium text-body hover:text-primary transition-colors rounded-lg"
                            onClick={() => setMobileMenuOpen(false)}
                        >
                            Pricing
                        </Link>
                        <Link
                            href="/cases"
                            className="block px-4 py-3 min-h-[44px] flex items-center text-[13px] font-medium text-body hover:text-primary transition-colors rounded-lg"
                            onClick={() => setMobileMenuOpen(false)}
                        >
                            Cases
                        </Link>
                        <a
                            href="https://fourteenfisherman.com"
                            target="_blank"
                            rel="noopener noreferrer"
                            className="block px-4 py-3 min-h-[44px] flex items-center gap-1.5 text-[13px] font-medium text-body hover:text-primary transition-colors rounded-lg"
                            onClick={() => setMobileMenuOpen(false)}
                        >
                            Portfolio Tool
                            <svg
                                xmlns="http://www.w3.org/2000/svg"
                                width="10"
                                height="10"
                                viewBox="0 0 24 24"
                                fill="none"
                                stroke="currentColor"
                                strokeWidth="2"
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                aria-hidden="true"
                            >
                                <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
                                <polyline points="15 3 21 3 21 9" />
                                <line x1="10" y1="14" x2="21" y2="3" />
                            </svg>
                        </a>

                        {!loading && (
                            user ? (
                                <div className="space-y-0.5 pt-1 mt-1 border-t border-black/[0.06]">
                                    <Link
                                        href="/dashboard"
                                        className="block px-4 py-3 min-h-[44px] flex items-center text-[13px] font-medium text-body hover:text-primary transition-colors rounded-lg"
                                        onClick={() => setMobileMenuOpen(false)}
                                    >
                                        Dashboard
                                    </Link>
                                    <button
                                        onClick={() => {
                                            handleSignOut();
                                            setMobileMenuOpen(false);
                                        }}
                                        className="block w-full text-left px-4 py-3 min-h-[44px] flex items-center text-[13px] font-medium text-muted hover:text-primary transition-colors rounded-lg"
                                    >
                                        Sign Out
                                    </button>
                                </div>
                            ) : (
                                <div className="pt-1 mt-1 border-t border-black/[0.06]">
                                    <Link
                                        href="/auth/sign-in"
                                        className="block px-4 py-3 min-h-[44px] flex items-center text-[13px] font-medium text-body hover:text-primary transition-colors rounded-lg"
                                        onClick={() => setMobileMenuOpen(false)}
                                    >
                                        Sign In
                                    </Link>
                                </div>
                            )
                        )}
                    </div>
                )}
            </nav>
        </div>
    );
}
