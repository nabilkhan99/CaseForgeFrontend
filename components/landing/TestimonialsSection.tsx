import { testimonials } from '@/lib/landing/mock-data';

export default function TestimonialsSection() {
    return (
        <section className="py-20 bg-[#111318]">
            <div className="max-w-7xl mx-auto px-4 text-center">
                <h2 className="text-2xl font-bold text-white mb-10">
                    Trusted by Trainees Across the UK
                </h2>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                    {testimonials.map((testimonial, index) => (
                        <div
                            key={index}
                            className="bg-slate-800/30 p-6 rounded-xl border border-slate-700/50 hover:shadow-[0_0_20px_rgba(251,191,36,0.3)] transition-all duration-300 group"
                        >
                            {/* Stars */}
                            <div className="flex gap-1 text-yellow-500 mb-4 justify-center">
                                {Array.from({ length: testimonial.rating }).map((_, i) => (
                                    <span
                                        key={i}
                                        className="material-symbols-outlined text-sm"
                                        style={{ fontVariationSettings: "'FILL' 1" }}
                                    >
                                        star
                                    </span>
                                ))}
                            </div>

                            {/* Quote */}
                            <p className="text-slate-300 italic mb-4">
                                &quot;{testimonial.quote}&quot;
                            </p>

                            {/* Name */}
                            <p className="text-sm font-bold text-white group-hover:text-yellow-400 transition-colors">
                                - {testimonial.name}, {testimonial.role}
                            </p>
                        </div>
                    ))}
                </div>
            </div>
        </section>
    );
}
