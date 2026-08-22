'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

/**
 * The floating "Exit" for the trial funnel. Only the index page needs it —
 * the station and session pages carry their own top bar with a back link in
 * the same corner, and the two used to sit on top of each other.
 */
export default function TryExitLink() {
  const pathname = usePathname();
  if (pathname !== '/try') return null;
  return (
    <Link
      href="/"
      className="fixed top-[max(1rem,env(safe-area-inset-top))] left-4 z-50 min-h-[44px] min-w-[44px] flex items-center px-3 py-1.5 rounded-lg text-[13px] text-muted hover:text-heading bg-white/60 backdrop-blur-xl border border-black/[0.06] transition-colors"
    >
      &larr; Exit
    </Link>
  );
}
