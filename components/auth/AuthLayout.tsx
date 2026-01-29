import Link from 'next/link';
import Image from 'next/image';

interface AuthLayoutProps {
    children: React.ReactNode;
    showBackToHome?: boolean;
}

export default function AuthLayout({ children, showBackToHome = true }: AuthLayoutProps) {
    return (
        <div className="min-h-screen bg-[#0a0e1a] flex flex-col items-center justify-center p-4 relative overflow-hidden">
            {/* Background gradient effects */}
            <div className="absolute inset-0 bg-gradient-to-br from-blue-900/20 via-transparent to-purple-900/20 pointer-events-none" />
            <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-blue-600/5 rounded-full blur-3xl pointer-events-none" />
            <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-purple-600/5 rounded-full blur-3xl pointer-events-none" />

            {/* Logo link back to home */}
            {showBackToHome && (
                <Link href="/" className="absolute top-6 left-6 flex items-center gap-2 text-white/60 hover:text-white transition-colors">
                    <Image
                        src="/fourteenfishermann.png"
                        alt="Fourteen Fisherman"
                        width={32}
                        height={32}
                    />
                </Link>
            )}

            {/* Main content */}
            <div className="w-full max-w-md relative z-10">
                {children}
            </div>

            {/* SSL Footer */}
            <div className="absolute bottom-6 flex items-center gap-2 text-slate-500 text-xs">
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                </svg>
                <span>Secure 256-bit SSL Encrypted Connection</span>
            </div>
        </div>
    );
}
