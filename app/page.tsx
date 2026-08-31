'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';
import LandingNavbar from '@/components/landing/LandingNavbar';
import LandingFooter from '@/components/landing/LandingFooter';
import ReferralWelcome from '@/components/landing/ReferralWelcome';
import {
  Hero,
  StudyBudgetChecker,
  GuaranteeCard,
  VideoProof,
  CompleteCourse,
  LecturePreview,
  Testimonials,
  Faq,
} from '@/components/landing/v5';
import PricingTable from '@/components/landing/v5/PricingTable';
import FinalCta from '@/components/landing/v5/FinalCta';
import { WASH } from '@/components/landing/v5/editorial';

export default function LandingPage() {
  const [user, setUser] = useState<{ id: string } | null>(null);

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then(({ data }) => setUser(data.user as { id: string } | null));
  }, []);

  return (
    <div className="min-h-[100dvh] font-sans" style={WASH}>
      <LandingNavbar user={user} />
      <ReferralWelcome />
      <main className="flex flex-col pb-16 sm:pb-20">
        <Hero />
        <StudyBudgetChecker />
        <GuaranteeCard proof />
        <VideoProof />
        <CompleteCourse />
        <LecturePreview />
        <Testimonials />
        <PricingTable />
        <Faq />
        {/* Not in the brief's list of eight, but not asked for either — kept
            as the page's closing call to action. */}
        <FinalCta />
      </main>
      <LandingFooter />
    </div>
  );
}
