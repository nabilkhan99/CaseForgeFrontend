import TryExitLink from '@/components/try/TryExitLink';

export default function TryLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-[100dvh] bg-surface font-sans relative">
      <TryExitLink />
      {children}
    </div>
  );
}
