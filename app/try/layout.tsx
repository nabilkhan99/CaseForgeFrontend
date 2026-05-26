import Link from 'next/link';

export default function TryLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-[100dvh] bg-surface font-sans relative">
      {/* Exit button */}
      <Link
        href="/"
        className="fixed top-[max(1rem,env(safe-area-inset-top))] left-4 z-50 min-h-[44px] min-w-[44px] flex items-center px-3 py-1.5 rounded-lg text-[13px] text-muted hover:text-heading bg-white/60 backdrop-blur-xl border border-black/[0.06] transition-colors"
      >
        &larr; Exit
      </Link>
      {children}
    </div>
  );
}
