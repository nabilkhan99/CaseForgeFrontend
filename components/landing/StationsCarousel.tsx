import { specialties } from '@/lib/landing/mock-data';

const colorMap: Record<string, string> = {
    red: 'text-red-500 hover:border-red-500/30 hover:shadow-red-500/10',
    cyan: 'text-cyan-500 hover:border-cyan-500/30 hover:shadow-cyan-500/10',
    pink: 'text-pink-500 hover:border-pink-500/30 hover:shadow-pink-500/10',
    purple: 'text-purple-500 hover:border-purple-500/30 hover:shadow-purple-500/10',
    orange: 'text-orange-500 hover:border-orange-500/30 hover:shadow-orange-500/10',
    yellow: 'text-yellow-500 hover:border-yellow-500/30 hover:shadow-yellow-500/10',
};

function SpecialtyCard({ specialty }: { specialty: typeof specialties[0] }) {
    const colorClasses = colorMap[specialty.color] || colorMap.blue;

    return (
        <li className="shrink-0">
            <div
                className={`w-72 min-h-[220px] bg-slate-800/50 border border-slate-700 rounded-2xl p-6 flex flex-col items-center justify-center text-center hover:bg-slate-800 hover:shadow-lg transition-all duration-300 ${colorClasses}`}
            >
                <span
                    className={`material-symbols-outlined text-5xl mb-4 ${colorClasses.split(' ')[0]}`}
                >
                    {specialty.icon}
                </span>
                <p className="text-lg font-bold text-slate-200">{specialty.name}</p>
                <p className="text-xs text-slate-400 mt-1 font-semibold">
                    {specialty.cases} Cases
                </p>
                <p className="text-xs text-slate-500 mt-2 font-medium">
                    {specialty.topics}
                </p>
            </div>
        </li>
    );
}

export default function StationsCarousel() {
    return (
        <section id="stations" className="py-20 bg-[#111318] overflow-hidden">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                <div className="text-center mb-16">
                    <h2 className="text-3xl font-bold text-white mb-6">
                        200+ RCGP-Mapped Stations
                    </h2>
                    <p className="text-slate-400 max-w-2xl mx-auto">
                        Our content library covers every clinical area of the SCA
                        curriculum, ensuring you are prepared for any scenario.
                    </p>
                </div>

                {/* Infinite Scroll Carousel */}
                <div className="w-full inline-flex flex-nowrap overflow-hidden scroll-mask">
                    <ul className="flex items-center justify-center md:justify-start [&_li]:mx-4 animate-infinite-scroll">
                        {specialties.map((specialty, index) => (
                            <SpecialtyCard key={index} specialty={specialty} />
                        ))}
                    </ul>
                    <ul
                        aria-hidden="true"
                        className="flex items-center justify-center md:justify-start [&_li]:mx-4 animate-infinite-scroll"
                    >
                        {specialties.map((specialty, index) => (
                            <SpecialtyCard key={`dup-${index}`} specialty={specialty} />
                        ))}
                    </ul>
                </div>
            </div>
        </section>
    );
}
