'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { mockUserProfile } from '@/lib/dashboard/mock-data';

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

    return (
        <aside className="w-[260px] bg-[#0B0F1A] flex flex-col border-r border-white/5 flex-shrink-0 z-20">
            {/* Logo */}
            <div className="h-20 flex items-center px-6 border-b border-white/5">
                <div className="h-9 w-9 rounded-xl bg-gradient-to-br from-white to-purple-600 flex items-center justify-center text-indigo-950 mr-3 shadow-lg shadow-purple-900/20 shrink-0">
                    <span className="material-symbols-outlined font-bold" style={{ fontSize: '22px' }}>
                        medical_services
                    </span>
                </div>
                <span className="font-extrabold text-lg tracking-tight text-white">Fourteen Fisherman</span>
            </div>

            {/* Navigation */}
            <nav className="flex-1 flex flex-col gap-1 w-full px-3 py-6 overflow-y-auto">
                <NavItem href="/dashboard" icon="dashboard" label="Dashboard" active={pathname === '/dashboard'} />
                <NavItem href="/dashboard/library" icon="library_books" label="Station Library" active={pathname === '/dashboard/library'} />
                <NavItem href="/dashboard/analytics" icon="analytics" label="Progress Analytics" active={pathname === '/dashboard/analytics'} />
                <NavItem href="/dashboard/history" icon="history" label="History" active={pathname === '/dashboard/history'} />

                {/* Account Section */}
                <div className="mt-4 pt-4 border-t border-white/5 px-2">
                    <span className="text-[10px] uppercase font-bold text-gray-500 tracking-widest px-2">Account</span>
                    <NavItem href="/dashboard/subscription" icon="credit_card" label="Subscription" active={pathname === '/dashboard/subscription'} />
                    <NavItem href="/dashboard/settings" icon="settings" label="Settings" active={pathname === '/dashboard/settings'} />
                </div>
            </nav>

            {/* User Profile */}
            <div className="mt-auto p-4 border-t border-white/5 w-full bg-black/20">
                <div className="flex items-center gap-3 p-2 rounded-xl hover:bg-white/5 transition-colors cursor-pointer">
                    <div
                        className="h-10 w-10 rounded-full bg-gray-700 bg-cover bg-center ring-2 ring-white/10 shadow-inner"
                        style={{ backgroundImage: `url('${mockUserProfile.avatar}')` }}
                    />
                    <div className="flex flex-col overflow-hidden">
                        <span className="text-sm font-bold text-white truncate">{mockUserProfile.name}</span>
                        <span className="text-xs text-purple-400/80 font-medium truncate">{mockUserProfile.membershipTier}</span>
                    </div>
                </div>
            </div>
        </aside>
    );
}
