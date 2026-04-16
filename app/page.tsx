'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';
import LandingNavbar from '@/components/landing/LandingNavbar';
import LandingHero from '@/components/landing/LandingHero';
import ProductJourney from '@/components/landing/ProductJourney';
import SocialProof from '@/components/landing/SocialProof';
import BottomFeatures from '@/components/landing/BottomFeatures';
import FinalCTA from '@/components/landing/FinalCTA';
import LandingFooter from '@/components/landing/LandingFooter';

export default function LandingPage() {
  const [user, setUser] = useState<{ id: string } | null>(null);

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then(({ data }) => setUser(data.user as { id: string } | null));
  }, []);

  return (
    <div className="min-h-[100dvh] bg-surface font-sans">
      <LandingNavbar user={user} />
      <LandingHero />
      <ProductJourney />
      <SocialProof />
      <BottomFeatures />
      <FinalCTA />
      <LandingFooter />
    </div>
  );
}
