'use client';

import Link from 'next/link';
import Image from 'next/image';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import type { User } from '@supabase/supabase-js';

interface NavItemProps {
    href: string;
    icon: string;
    label: string;
    active?: boolean;
    onClick?: () => void;
}

function NavItem({ href, icon, label, active, onClick }: NavItemProps) {
    return (
        <Link
            href={href}
            onClick={onClick}
            className={`flex items-center gap-3 px-4 py-3 min-h-[44px] rounded-xl transition-all ${active
                ? 'bg-gradient-to-r from-purple-600 to-indigo-600 text-white shadow-lg shadow-purple-500/20'
                : 'text-gray-400 hover:text-white hover:bg-white/5'
                }`}
        >
            <span className={`material-symbols-outlined ${active ? 'fill' : ''}`} style={{ fontSize: '22px' }}>
                {icon}
            </span>
            <span className={`text-sm ${active ? 'font-semibold' : 'font-medium'}`}>{label}</span>
        </Link>
    );
}

interface DashboardSidebarProps {
    mobileOpen?: boolean;
    onMobileClose?: () => void;
}

export default function DashboardSidebar({ mobileOpen, onMobileClose }: DashboardSidebarProps) {
    const pathname = usePathname();
    const router = useRouter();
    const supabase = createClient();
    const [user, setUser] = useState<User | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        supabase.auth.getUser().then(({ data: { user } }) => {
            setUser(user);
            setLoading(false);
        });
    }, [supabase.auth]);

    const handleSignOut = async () => {
        await supabase.auth.signOut();
        router.push('/');
        router.refresh();
    };

    // Get user display name from metadata or email
    const displayName = user?.user_metadata?.full_name || user?.email?.split('@')[0] || 'User';
    const displayEmail = user?.email || '';

    const closeMobile = () => onMobileClose?.();

    const sidebarContent = (
        <>
            {/* Logo - Links to landing page */}
            <Link href="/" onClick={closeMobile} className="h-20 flex items-center justify-center border-b border-white/5 hover:bg-white/5 transition-colors p-3 shrink-0">
                <Image
                    src="/fourteenfishermann.png"
                    alt="Fourteen Fisherman"
                    width={200}
                    height={200}
                    className="h-full w-auto object-contain"
                />
            </Link>

            {/* Navigation */}
            <nav className="flex-1 flex flex-col gap-1 w-full px-3 py-6 overflow-y-auto">
                <NavItem href="/dashboard" icon="dashboard" label="Dashboard" active={pathname === '/dashboard'} onClick={closeMobile} />
                <NavItem href="/dashboard/library" icon="library_books" label="Station Library" active={pathname?.startsWith('/dashboard/library')} onClick={closeMobile} />
                <NavItem href="/dashboard/history" icon="history" label="Session History" active={pathname === '/dashboard/history'} onClick={closeMobile} />
                <NavItem href="/clinical-master" icon="record_voice_over" label="Practice" active={pathname?.startsWith('/clinical-master')} onClick={closeMobile} />

                {/* Account Section */}
                <div className="mt-4 pt-4 border-t border-white/5 px-2">
                    <span className="text-[10px] uppercase font-bold text-gray-500 tracking-widest px-2">Account</span>
                    <NavItem href="/dashboard/settings" icon="settings" label="Settings" active={pathname === '/dashboard/settings'} onClick={closeMobile} />
                </div>
            </nav>

            {/* User Profile & Sign Out */}
            <div className="mt-auto border-t border-white/5 w-full bg-black/20 shrink-0">
                {/* User info */}
                <div className="p-4 pb-2">
                    <div className="flex items-center gap-3 p-2 rounded-xl">
                        <div className="h-10 w-10 rounded-full bg-gradient-to-br from-purple-500 to-indigo-600 flex items-center justify-center text-white font-bold text-sm ring-2 ring-white/10 shrink-0">
                            {loading ? '...' : displayName.charAt(0).toUpperCase()}
                        </div>
                        <div className="flex flex-col overflow-hidden flex-1">
                            <span className="text-sm font-bold text-white truncate">{loading ? 'Loading...' : displayName}</span>
                            <span className="text-xs text-slate-400 truncate">{displayEmail}</span>
                        </div>
                    </div>
                </div>

                {/* Sign Out Button */}
                <div className="px-4 pb-4">
                    <button
                        onClick={() => { handleSignOut(); closeMobile(); }}
                        className="w-full flex items-center justify-center gap-2 px-4 py-3 min-h-[44px] text-slate-400 hover:text-white hover:bg-white/5 rounded-lg transition-colors text-sm font-medium"
                    >
                        <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>logout</span>
                        Sign Out
                    </button>
                </div>
            </div>
        </>
    );

    return (
        <>
            {/* Desktop sidebar — hidden on mobile */}
            <aside className="hidden lg:flex w-[260px] bg-[#0B0F1A] flex-col border-r border-white/5 flex-shrink-0 z-20">
                {sidebarContent}
            </aside>

            {/* Mobile drawer overlay */}
            {mobileOpen && (
                <div className="fixed inset-0 z-50 lg:hidden">
                    {/* Backdrop */}
                    <div
                        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
                        onClick={closeMobile}
                        aria-hidden="true"
                    />
                    {/* Drawer */}
                    <aside
                        className="absolute left-0 top-0 h-full w-[280px] max-w-[80vw] bg-[#0B0F1A] shadow-2xl flex flex-col animate-slideDown"
                        role="dialog"
                        aria-modal="true"
                        aria-label="Navigation menu"
                    >
                        {/* Close button */}
                        <button
                            onClick={closeMobile}
                            className="absolute top-4 right-4 p-2 min-h-[44px] min-w-[44px] flex items-center justify-center text-gray-400 hover:text-white z-10"
                            aria-label="Close menu"
                        >
                            <span className="material-symbols-outlined" style={{ fontSize: '24px' }}>close</span>
                        </button>
                        {sidebarContent}
                    </aside>
                </div>
            )}
        </>
    );
}
