import AppNavbar from '@/components/ui/AppNavbar';

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-[100dvh] bg-surface font-sans">
      <AppNavbar />
      {/* One measure for every dashboard tab. Settings used to nest a 560px
          column and Trend a 760px one (plus a second copy of this padding), so
          the page visibly shifted right when you switched tabs. 900px is what
          Home, Library, History and Lectures were already using. */}
      <main className="pt-24 pb-[max(4rem,env(safe-area-inset-bottom))] pl-[max(1.5rem,env(safe-area-inset-left))] pr-[max(1.5rem,env(safe-area-inset-right))]">
        <div className="max-w-[900px] mx-auto">
          {children}
        </div>
      </main>
    </div>
  );
}
