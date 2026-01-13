import Image from 'next/image';
import Link from 'next/link';

export default function Footer() {
    return (
        <footer className="bg-[#0f172a] border-t border-slate-800 pt-16 pb-8">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                <div className="flex flex-col items-center justify-center mb-8 text-center">
                    <Link href="/" className="flex items-center gap-2 mb-6">
                        <Image
                            src="/fourteenfishermann.png"
                            alt="Fourteen Fisherman Logo"
                            width={32}
                            height={32}
                            className="h-8 w-auto"
                        />
                        <span className="text-white font-bold text-xl">
                            Fourteen Fisherman
                        </span>
                    </Link>
                    <p className="text-sm text-slate-500 max-w-sm">
                        The ultimate preparation tool for the RCGP SCA examination.
                    </p>
                </div>

                <div className="border-t border-slate-800 pt-8 flex flex-col items-center text-xs text-slate-600">
                    <p>© {new Date().getFullYear()} Fourteen Fisherman Ltd. All rights reserved.</p>
                </div>
            </div>
        </footer>
    );
}
