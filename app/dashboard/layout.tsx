import DashboardSidebar from '@/components/dashboard/DashboardSidebar';

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
    return (
        <div className="bg-background-dark text-white h-screen flex overflow-hidden selection:bg-purple-500/30">
            <DashboardSidebar />
            {children}
        </div>
    );
}
