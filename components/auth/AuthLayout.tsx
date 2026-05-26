import Link from 'next/link';
import Image from 'next/image';

interface AuthLayoutProps {
    children: React.ReactNode;
    showBackToHome?: boolean;
}

export default function AuthLayout({ children, showBackToHome = true }: AuthLayoutProps) {
    return (
        <div className="min-h-[100dvh] bg-surface flex flex-col relative overflow-hidden">
            {/* Warm ambient orb */}
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_70%_30%,rgba(180,83,9,0.05)_0%,transparent_55%)] pointer-events-none" />

            {/* Logo link back to home */}
            {showBackToHome && (
                <Link href="/" className="absolute top-6 left-6 flex items-center gap-2 text-muted hover:text-primary transition-colors">
                    <Image
                        src="/fourteenfishermann.png"
                        alt="Fourteen Fisherman"
                        width={32}
                        height={32}
                    />
                </Link>
            )}

            {/* Main content */}
            <div className="flex-1 flex items-center justify-center p-4 w-full">
                <div className="w-full max-w-md relative z-10">
                    {children}
                </div>
            </div>

            {/* SSL Footer */}
            <div className="flex items-center justify-center gap-2 text-muted text-xs pb-6 pt-2">
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                </svg>
                <span>Secure 256-bit SSL Encrypted Connection</span>
            </div>
        </div>
    );
}
