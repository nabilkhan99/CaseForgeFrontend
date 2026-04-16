import AppNavbar from '@/components/ui/AppNavbar';

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-[100dvh] bg-surface font-sans">
      <AppNavbar />
      <main className="pt-24 pb-16 px-6">
        <div className="max-w-[900px] mx-auto">
          {children}
        </div>
      </main>
    </div>
  );
}
