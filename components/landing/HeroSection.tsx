import Link from 'next/link';
import HeroChatSimulation from './HeroChatSimulation';

export default function HeroSection() {
    return (
        <header className="relative pt-20 pb-20 overflow-hidden">
            {/* Background */}
            <div className="absolute inset-0 z-0">
                <div className="absolute inset-0 bg-background-dark" />
                <div className="absolute inset-0 bg-grid-pattern bg-[length:40px_40px] opacity-20" />
                <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full h-[500px] bg-primary/20 blur-[120px] rounded-full pointer-events-none" />
            </div>

            <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center flex flex-col items-center">
                {/* Headline */}
                <h1 className="text-4xl md:text-6xl font-bold text-white tracking-tight mb-4 max-w-4xl leading-tight">
                    Master the{' '}
                    <span className="gradient-text animate-pulse">
                        Simulated Consultation Assessment
                    </span>
                </h1>

                {/* CTAs */}
                <div className="flex flex-col sm:flex-row gap-4 mb-8">
                    <Link
                        href="/auth/sign-up"
                        className="px-8 py-4 bg-primary text-white font-bold rounded-xl shadow-lg hover:bg-primary-hover hover:shadow-primary/50 transition-all transform hover:-translate-y-1 text-lg flex items-center gap-2"
                    >
                        Begin Your SCA Practice
                        <span className="material-symbols-outlined">arrow_forward</span>
                    </Link>
                    <a
                        href="#demo"
                        className="px-8 py-4 bg-slate-800 text-white font-medium rounded-xl border border-slate-700 hover:bg-slate-700 transition-all text-lg"
                    >
                        View Sample Case
                    </a>
                </div>

                {/* App Preview */}
                <div className="w-full max-w-6xl mx-auto relative group">
                    <div className="absolute -inset-1 bg-gradient-to-r from-primary to-purple-600 rounded-2xl blur opacity-30 group-hover:opacity-50 transition duration-1000" />
                    <div className="relative bg-[#0f172a] rounded-xl border border-slate-700 shadow-2xl overflow-hidden ring-1 ring-white/10">
                        {/* Window Chrome */}
                        <div className="bg-[#111318] px-4 py-3 border-b border-slate-800 flex items-center gap-2">
                            <div className="flex gap-2">
                                <div className="w-3 h-3 rounded-full bg-red-500/80" />
                                <div className="w-3 h-3 rounded-full bg-yellow-500/80" />
                                <div className="w-3 h-3 rounded-full bg-green-500/80" />
                            </div>
                        </div>

                        {/* App Content */}
                        <div className="h-[600px] flex text-left">
                            {/* Left Sidebar - Stations */}
                            <aside className="hidden lg:flex w-64 flex-col bg-[#111318] border-r border-slate-800 p-4 gap-4">
                                <div className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-2">
                                    Stations
                                </div>
                                {['Chest Pain', 'Paediatrics', 'Ophthalmology'].map(
                                    (station, i) => (
                                        <div
                                            key={i}
                                            className="flex items-center gap-3 p-2 rounded-lg bg-green-500/10 border border-green-500/20 opacity-60"
                                        >
                                            <span className="material-symbols-outlined text-green-500 text-sm">
                                                check_circle
                                            </span>
                                            <span className="text-xs text-slate-300">
                                                {i + 1}: {station}
                                            </span>
                                        </div>
                                    )
                                )}
                                <div className="flex items-center gap-3 p-3 rounded-lg bg-primary/20 border border-primary relative shadow-lg shadow-primary/10">
                                    <div className="absolute left-0 top-0 bottom-0 w-1 bg-primary rounded-l-lg" />
                                    <span className="material-symbols-outlined text-primary text-sm animate-pulse">
                                        play_circle
                                    </span>
                                    <div>
                                        <p className="text-xs font-bold text-white">
                                            4: Acute Abdomen
                                        </p>
                                        <p className="text-[10px] text-primary">Live Now</p>
                                    </div>
                                </div>
                            </aside>

                            {/* Main Content */}
                            <main className="flex-1 flex flex-col bg-[#0f172a] relative">
                                {/* Timer Bar */}
                                <div className="h-12 border-b border-slate-800 bg-[#111318] flex items-center justify-between px-6">
                                    <div className="flex items-center gap-2">
                                        <span className="material-symbols-outlined text-red-400 text-sm animate-pulse">
                                            timer
                                        </span>
                                        <span className="text-red-400 font-mono font-bold text-lg">
                                            08:42
                                        </span>
                                    </div>
                                </div>

                                {/* Chat Area */}
                                <div className="flex-1 p-6 flex flex-col gap-4 overflow-hidden">
                                    {/* Patient Avatar and Waveform */}
                                    <div className="flex gap-4 items-center">
                                        <div className="w-24 h-24 rounded-xl bg-slate-700 border-2 border-slate-600 relative overflow-hidden shrink-0 flex items-center justify-center">
                                            <span className="material-symbols-outlined text-4xl text-slate-500">
                                                person
                                            </span>
                                            <div className="absolute bottom-0 w-full bg-black/60 p-1 text-[10px] text-center text-white">
                                                Sarah (32F)
                                            </div>
                                        </div>
                                        <div className="flex-1 h-16 bg-slate-800/50 rounded-lg border border-slate-700/50 flex items-center justify-center gap-1">
                                            {[4, 8, 12, 6, 10].map((h, i) => (
                                                <div
                                                    key={i}
                                                    className="w-1 bg-green-500 rounded-full animate-pulse"
                                                    style={{
                                                        height: `${h * 3}px`,
                                                        animationDelay: `${i * 0.1}s`,
                                                    }}
                                                />
                                            ))}
                                        </div>
                                    </div>

                                    {/* Chat Messages */}
                                    <div className="flex-1 bg-[#161b26] rounded-xl border border-slate-800 flex flex-col overflow-hidden relative">
                                        <div className="absolute top-0 left-0 right-0 bg-gradient-to-b from-[#161b26] to-transparent h-4 z-10" />
                                        <HeroChatSimulation />
                                    </div>

                                    {/* Control Buttons */}
                                    <div className="flex justify-center gap-4 py-2">
                                        <div className="w-10 h-10 rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center text-slate-400">
                                            <span className="material-symbols-outlined text-lg">
                                                mic
                                            </span>
                                        </div>
                                        <div className="px-4 h-10 rounded-full bg-red-500/10 border border-red-500/50 flex items-center gap-2 text-red-500 text-xs font-bold uppercase">
                                            <span className="material-symbols-outlined text-base">
                                                call_end
                                            </span>{' '}
                                            End
                                        </div>
                                    </div>
                                </div>
                            </main>

                            {/* Right Sidebar - Notepad */}
                            <aside className="hidden xl:flex w-72 flex-col bg-[#111318] border-l border-slate-800">
                                <div className="flex border-b border-slate-800">
                                    <div className="flex-1 py-3 text-center text-xs font-medium text-slate-500">
                                        Brief
                                    </div>
                                    <div className="flex-1 py-3 text-center text-xs font-bold text-primary border-b-2 border-primary bg-primary/5">
                                        Notepad
                                    </div>
                                </div>
                                <div className="p-4 flex-1">
                                    <div className="text-xs font-mono text-slate-400 space-y-2">
                                        <p className="font-bold text-slate-300 border-b border-slate-700 pb-2 mb-2">
                                            CANDIDATE BRIEFING
                                        </p>
                                        <p>Situation: Surgery Consultation</p>
                                        <p>Patient: Sarah Jenkins (32F)</p>
                                        <p className="mt-2">
                                            Notes: Patient has requested an urgent appointment for
                                            ongoing abdominal discomfort.
                                        </p>
                                        <p>Task: Assess and manage.</p>
                                    </div>
                                </div>
                            </aside>
                        </div>
                    </div>
                </div>
            </div>
        </header>
    );
}
