import { domainScores, feedbackItems } from '@/lib/landing/mock-data';

const domainColors: Record<string, string> = {
    blue: 'bg-blue-500 text-blue-400',
    green: 'bg-green-500 text-green-400',
    yellow: 'bg-yellow-500 text-yellow-400',
};

export default function FeedbackAnalysisSection() {
    return (
        <section className="py-24 bg-[#0f172a] relative border-t border-slate-800">
            {/* Background Pattern */}
            <div className="absolute inset-0 bg-grid-pattern bg-[length:30px_30px] opacity-[0.03]" />

            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
                <div className="flex flex-col lg:flex-row items-center gap-16">
                    {/* Left - Performance Card */}
                    <div className="w-full lg:w-1/2">
                        <div className="relative group">
                            <div className="absolute -inset-1 bg-gradient-to-r from-primary to-accent-green rounded-2xl blur opacity-20 group-hover:opacity-40 transition duration-1000" />
                            <div className="bg-slate-900 rounded-xl border border-slate-700 shadow-2xl relative overflow-hidden">
                                {/* Header */}
                                <div className="bg-[#1e293b] px-6 py-4 border-b border-slate-700 flex justify-between items-center">
                                    <span className="text-sm font-semibold text-slate-300">
                                        Performance Analysis
                                    </span>
                                    <span className="px-2 py-1 rounded bg-green-500/10 text-green-500 text-[10px] font-bold uppercase border border-green-500/20">
                                        Passed
                                    </span>
                                </div>

                                <div className="p-6">
                                    {/* Domain Scores */}
                                    <div className="space-y-6 mb-8">
                                        {domainScores.map((domain, index) => {
                                            const colors = domainColors[domain.color];
                                            const [bgColor, textColor] = colors.split(' ');
                                            return (
                                                <div key={index}>
                                                    <div className="flex justify-between items-end mb-2">
                                                        <span className="text-xs font-bold text-slate-400 uppercase tracking-wide">
                                                            {domain.name}
                                                        </span>
                                                        <span className={`${textColor} font-bold text-sm`}>
                                                            {domain.score}%
                                                        </span>
                                                    </div>
                                                    <div className="w-full bg-slate-800 rounded-full h-3">
                                                        <div
                                                            className={`${bgColor} h-3 rounded-full relative transition-all duration-1000 ease-out`}
                                                            style={{ width: `${domain.score}%` }}
                                                        >
                                                            <div className="absolute inset-0 bg-gradient-to-r from-transparent to-white/20 rounded-full" />
                                                        </div>
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>

                                    {/* Feedback Items */}
                                    <div className="space-y-3 pt-2 border-t border-slate-800/50">
                                        {feedbackItems.map((item, index) => (
                                            <div
                                                key={index}
                                                className="p-3 bg-slate-800/50 rounded-lg border border-slate-700/50 flex gap-3 hover:bg-slate-800 transition-colors"
                                            >
                                                <span
                                                    className={`material-symbols-outlined text-sm shrink-0 mt-0.5 ${item.type === 'success'
                                                            ? 'text-green-500'
                                                            : 'text-yellow-500'
                                                        }`}
                                                >
                                                    {item.type === 'success' ? 'check_circle' : 'lightbulb'}
                                                </span>
                                                <div className="text-xs text-slate-300">
                                                    <strong className="text-white block mb-0.5">
                                                        {item.title}
                                                    </strong>
                                                    {item.description}
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Right - Content */}
                    <div className="w-full lg:w-1/2 text-left">
                        <h2 className="text-3xl md:text-4xl font-bold text-white mb-6">
                            Go beyond &quot;pass&quot; or &quot;fail&quot;
                        </h2>
                        <p className="text-lg text-slate-400 mb-8">
                            The SCA isn&apos;t just about getting the diagnosis right. It&apos;s
                            about <i>how</i> you manage the consultation. Our AI breaks down
                            your performance across the three RCGP domains.
                        </p>

                        <ul className="space-y-6">
                            <li className="flex gap-4">
                                <div className="w-12 h-12 rounded-xl bg-blue-500/10 flex items-center justify-center shrink-0 border border-blue-500/20">
                                    <span className="material-symbols-outlined text-blue-400">
                                        fact_check
                                    </span>
                                </div>
                                <div>
                                    <h3 className="text-lg font-semibold text-white mb-1">
                                        Domain-Specific Feedback
                                    </h3>
                                    <p className="text-sm text-slate-400">
                                        Pinpoint exactly where you lost marks: Data Gathering,
                                        Clinical Management, or Interpersonal Skills.
                                    </p>
                                </div>
                            </li>
                            <li className="flex gap-4">
                                <div className="w-12 h-12 rounded-xl bg-purple-500/10 flex items-center justify-center shrink-0 border border-purple-500/20">
                                    <span className="material-symbols-outlined text-purple-400">
                                        history_edu
                                    </span>
                                </div>
                                <div>
                                    <h3 className="text-lg font-semibold text-white mb-1">
                                        Transcript Analysis
                                    </h3>
                                    <p className="text-sm text-slate-400">
                                        Review your consultation line-by-line with AI annotations
                                        highlighting missed cues and excellent phrasing.
                                    </p>
                                </div>
                            </li>
                        </ul>
                    </div>
                </div>
            </div>
        </section>
    );
}
