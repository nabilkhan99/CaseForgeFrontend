import Link from 'next/link';

export default function CTASection() {
    return (
        <section
            id="pricing"
            className="py-24 bg-gradient-to-b from-[#111318] to-primary/10 border-t border-slate-800"
        >
            <div className="max-w-4xl mx-auto text-center px-4">
                <h2 className="text-4xl md:text-5xl font-bold text-white mb-6">
                    Master the SCA. Start Today.
                </h2>
                <p className="text-xl text-slate-400 mb-10">
                    Join thousands of GP trainees securing their future with Fourteen
                    Fisherman.
                </p>

                <Link href="/clinical-master">
                    <button className="bg-primary hover:bg-primary-hover text-white text-xl font-bold py-4 px-12 rounded-xl shadow-2xl hover:shadow-primary/50 transition-all transform hover:scale-105">
                        Get Started for Free
                    </button>
                </Link>

                <p className="mt-4 text-sm text-slate-500">
                    No credit card required for trial cases.
                </p>
            </div>
        </section>
    );
}
