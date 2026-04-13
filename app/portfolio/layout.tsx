'use client';

import Image from 'next/image';
import Link from 'next/link';

export default function PortfolioLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <>
      {/* Scoped styles to preserve the original portfolio tool appearance */}
      <style jsx global>{`
        .portfolio-shell {
          background: #0a0a0a;
          color: #e5e5e5;
          min-height: 100vh;
        }
        .portfolio-shell .card {
          backdrop-filter: blur(16px);
          background: rgba(255, 255, 255, 0.1);
          border: 1px solid rgba(255, 255, 255, 0.2);
          box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.25);
          border-radius: 16px;
          padding: 2rem;
          transition: all 300ms;
        }
        .portfolio-shell .card:hover {
          background: rgba(255, 255, 255, 0.15);
        }
      `}</style>
      <div className="portfolio-shell">
        <nav className="backdrop-blur-lg bg-black/20 border-b border-white/10">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex justify-between h-16 items-center">
              <Link href="/" className="flex items-center h-full py-2">
                <Image
                  src="/fourteenfishermann.png"
                  alt="Fourteen Fisherman Logo"
                  width={60}
                  height={48}
                  priority
                  className="h-full w-auto"
                />
              </Link>
              <Link
                href="/"
                className="text-sm text-white/60 hover:text-white transition-colors"
              >
                ← Back to Home
              </Link>
            </div>
          </div>
        </nav>
        <main className="max-w-7xl mx-auto py-12 px-4 sm:px-6 lg:px-8">
          {children}
        </main>
      </div>
    </>
  );
}
