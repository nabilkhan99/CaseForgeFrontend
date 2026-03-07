'use client';

import { useState } from 'react';
import DashboardSidebar from '@/components/dashboard/DashboardSidebar';

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
    const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

    return (
        <div className="bg-background-dark text-white min-h-[100dvh] lg:h-screen flex overflow-hidden selection:bg-purple-500/30">
            <DashboardSidebar mobileOpen={mobileMenuOpen} onMobileClose={() => setMobileMenuOpen(false)} />

            {/* Main content wrapper */}
            <div className="flex-1 flex flex-col min-w-0">
                {/* Mobile header with hamburger */}
                <header className="lg:hidden flex items-center justify-between px-4 py-3 border-b border-white/5 bg-[#0B0F1A]/80 backdrop-blur-md sticky top-0 z-30 shrink-0">
                    <button
                        onClick={() => setMobileMenuOpen(true)}
                        className="p-2 min-h-[44px] min-w-[44px] flex items-center justify-center text-gray-400 hover:text-white rounded-lg hover:bg-white/5 transition-colors"
                        aria-label="Open menu"
                    >
                        <span className="material-symbols-outlined" style={{ fontSize: '24px' }}>menu</span>
                    </button>
                    <span className="text-sm font-semibold text-white">Fourteen Fisherman</span>
                    <div className="w-[44px]" /> {/* Spacer for centering */}
                </header>

                {children}
            </div>
        </div>
    );
}
