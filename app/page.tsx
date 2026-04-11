'use client';

import { motion } from 'framer-motion';
import Navbar from '@/components/landing/Navbar';
import HeroSection from '@/components/landing/HeroSection';
import FeaturesSection from '@/components/landing/FeaturesSection';
import FreeCasesSection from '@/components/landing/FreeCasesSection';
import StationsCarousel from '@/components/landing/StationsCarousel';
import FeedbackAnalysisSection from '@/components/landing/FeedbackAnalysisSection';
import CTASection from '@/components/landing/CTASection';
import Footer from '@/components/landing/Footer';

export default function LandingPage() {
    return (
        <>
            <Navbar />
            <HeroSection />
            <FeaturesSection />
            <FreeCasesSection />
            <StationsCarousel />
            <FeedbackAnalysisSection />
            <motion.section
                className="max-w-[1200px] mx-auto px-12 py-[100px] relative"
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: '-80px' }}
                transition={{ type: 'spring', stiffness: 80, damping: 20 }}
            >
                {/* Giant quotation mark in background */}
                <div
                    className="absolute top-[60px] left-12 text-[160px] font-serif text-primary/[0.05] leading-none pointer-events-none select-none"
                    aria-hidden="true"
                >
                    &ldquo;
                </div>

                <blockquote className="text-[32px] font-semibold text-heading tracking-[-0.03em] leading-[1.4] max-w-[700px] relative z-[1]">
                    I failed my SCA first time. After two weeks with Fourteen Fisherman, the second attempt felt completely different.
                </blockquote>

                <cite className="block mt-6 text-[14px] text-muted not-italic relative z-[1]">
                    <strong className="text-body font-semibold">Dr. James Chen</strong> &middot; ST3, Yorkshire
                </cite>
            </motion.section>
            <CTASection />
            <Footer />
        </>
    );
}
