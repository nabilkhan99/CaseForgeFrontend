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
}

function NavItem({ href, icon, label, active }: NavItemProps) {
    return (
        <Link
            href={href}
            className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-all ${active
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

export default function DashboardSidebar() {
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

    return (
        <aside className="w-[260px] bg-[#0B0F1A] flex flex-col border-r border-white/5 flex-shrink-0 z-20">
            {/* Logo - Links to landing page */}
            <Link href="/" className="h-20 flex items-center justify-center border-b border-white/5 hover:bg-white/5 transition-colors p-3">
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
                <NavItem href="/dashboard" icon="dashboard" label="Dashboard" active={pathname === '/dashboard'} />
                <NavItem href="/dashboard/library" icon="library_books" label="Station Library" active={pathname?.startsWith('/dashboard/library')} />
                <NavItem href="/dashboard/history" icon="history" label="Session History" active={pathname === '/dashboard/history'} />
                <NavItem href="/clinical-master" icon="record_voice_over" label="Practice" active={pathname?.startsWith('/clinical-master')} />

                {/* Account Section */}
                <div className="mt-4 pt-4 border-t border-white/5 px-2">
                    <span className="text-[10px] uppercase font-bold text-gray-500 tracking-widest px-2">Account</span>
                    <NavItem href="/dashboard/settings" icon="settings" label="Settings" active={pathname === '/dashboard/settings'} />
                </div>
            </nav>

            {/* User Profile & Sign Out */}
            <div className="mt-auto border-t border-white/5 w-full bg-black/20">
                {/* User info */}
                <div className="p-4 pb-2">
                    <div className="flex items-center gap-3 p-2 rounded-xl">
                        <div className="h-10 w-10 rounded-full bg-gradient-to-br from-purple-500 to-indigo-600 flex items-center justify-center text-white font-bold text-sm ring-2 ring-white/10">
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
                        onClick={handleSignOut}
                        className="w-full flex items-center justify-center gap-2 px-4 py-2.5 text-slate-400 hover:text-white hover:bg-white/5 rounded-lg transition-colors text-sm font-medium"
                    >
                        <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>logout</span>
                        Sign Out
                    </button>
                </div>
            </div>
        </aside>
    );
}
