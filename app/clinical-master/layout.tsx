'use client';

import { Inter } from 'next/font/google';
import Link from 'next/link';
import '../globals.css';

const inter = Inter({ subsets: ['latin'] });

export default function ClinicalMasterLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className={`${inter.className} min-h-[100dvh] bg-[#070A13] text-white`}>
      <style jsx global>{`
        body {
          background: #070A13;
        }
        
        /* Custom scrollbar */
        ::-webkit-scrollbar {
          width: 8px;
        }
        ::-webkit-scrollbar-track {
          background: #101922;
        }
        ::-webkit-scrollbar-thumb {
          background: #334155;
          border-radius: 4px;
        }
        ::-webkit-scrollbar-thumb:hover {
          background: #475569;
        }

        /* Glass card effect */
        .glass-card {
          background: rgba(21, 26, 46, 0.6);
          backdrop-filter: blur(12px);
          border: 1px solid rgba(255, 255, 255, 0.1);
        }
      `}</style>

      {/* Exit button — always visible */}
      <Link
        href="/dashboard"
        className="fixed top-4 left-4 z-50 flex items-center gap-1.5 px-3 py-2 min-h-[44px] min-w-[44px] rounded-lg bg-white/5 border border-white/10 text-gray-400 hover:text-white hover:bg-white/10 transition-all text-xs font-medium backdrop-blur-sm"
      >
        <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>arrow_back</span>
        Exit
      </Link>

      {children}
    </div>
  );
}
