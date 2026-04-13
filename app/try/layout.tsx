import Link from 'next/link';

export default function TryLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-surface font-sans relative">
      {/* Exit button */}
      <Link
        href="/"
        className="fixed top-4 left-4 z-50 px-3 py-1.5 rounded-lg text-[13px] text-muted hover:text-heading bg-white/60 backdrop-blur-xl border border-black/[0.06] transition-colors"
      >
        &larr; Exit
      </Link>
      {children}
    </div>
  );
}
