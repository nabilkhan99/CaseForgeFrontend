import Image from 'next/image';
import Link from 'next/link';

export default function Navbar() {
    return (
        <nav className="fixed top-0 w-full z-50 glass-panel border-b border-slate-800/50">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                <div className="flex items-center justify-between h-16">
                    <Link href="/" className="flex items-center gap-3">
                        <Image
                            src="/fourteenfishermann.png"
                            alt="Fourteen Fisherman"
                            width={40}
                            height={40}
                            className="h-10 w-auto"
                        />
                    </Link>

                    <div className="hidden md:flex items-center gap-8 text-sm font-medium">
                        <a
                            href="#features"
                            className="text-slate-300 hover:text-white transition-colors"
                        >
                            Features
                        </a>
                        <a
                            href="#pricing"
                            className="text-slate-300 hover:text-white transition-colors"
                        >
                            Pricing
                        </a>
                        <a
                            href="#stations"
                            className="text-slate-300 hover:text-white transition-colors"
                        >
                            Stations
                        </a>
                        <Link
                            href="/clinical-master"
                            className="px-4 py-2 bg-primary/10 text-primary border border-primary/20 rounded-lg hover:bg-primary hover:text-white transition-all"
                        >
                            Sign In
                        </Link>
                    </div>

                    {/* Mobile menu button */}
                    <button className="md:hidden p-2 text-slate-400 hover:text-white">
                        <span className="material-symbols-outlined">menu</span>
                    </button>
                </div>
            </div>
        </nav>
    );
}
