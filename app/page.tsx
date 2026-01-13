import Navbar from '@/components/landing/Navbar';
import HeroSection from '@/components/landing/HeroSection';
import FeaturesSection from '@/components/landing/FeaturesSection';
import InteractiveDemoSection from '@/components/landing/InteractiveDemoSection';
import StationsCarousel from '@/components/landing/StationsCarousel';
import FeedbackAnalysisSection from '@/components/landing/FeedbackAnalysisSection';
import TestimonialsSection from '@/components/landing/TestimonialsSection';
import CTASection from '@/components/landing/CTASection';
import Footer from '@/components/landing/Footer';

export default function LandingPage() {
    return (
        <>
            <Navbar />
            <HeroSection />
            <FeaturesSection />
            <InteractiveDemoSection />
            <StationsCarousel />
            <FeedbackAnalysisSection />
            <TestimonialsSection />
            <CTASection />
            <Footer />
        </>
    );
}
