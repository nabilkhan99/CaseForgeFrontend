'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { Sparkles, ArrowRight } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import LandingNavbar from '@/components/landing/LandingNavbar';
import AppNavbar from '@/components/ui/AppNavbar';
import { CaseForm } from '@/components/CaseForm';
import { ReviewDisplay } from '@/components/ReviewDisplay';
import type { CaseReviewResponse } from '@/lib/types';
import ErrorBoundary from '@/components/ErrorBoundary';
import { analytics } from '@/lib/analytics';
import { FeedbackWidget } from '@/components/FeedbackWidget';

/**
 * Cross-sell banner shown on the free portfolio tool: drives portfolio users to
 * the main SCA course. The whole bar links to the homepage (per the 16/7 spec).
 */
function PortfolioPromoBanner() {
  return (
    <Link
      href="/"
      aria-label="Explore the complete SCA course"
      className="group block bg-[#1C1917] text-white"
    >
      <div className="mx-auto flex max-w-7xl flex-col items-center gap-3 px-4 py-3 sm:flex-row sm:justify-between sm:gap-4 sm:px-6 sm:py-3.5 lg:px-8">
        <p className="flex items-center gap-2.5 text-center text-[13px] leading-snug text-white/90 sm:text-left sm:text-sm">
          <Sparkles className="hidden h-4 w-4 flex-shrink-0 text-[#FAC775] sm:block" aria-hidden="true" />
          <span>
            AI Practice + Lectures + Small Group Coaching&hellip; fail your SCA?{' '}
            <span className="font-semibold text-[#FAC775]">We&rsquo;ll pay you £500.</span>
          </span>
        </p>
        <span className="inline-flex flex-shrink-0 items-center gap-1.5 rounded-full bg-gradient-to-b from-[#E0912F] to-[#BE6E12] px-4 py-2 text-[13px] font-semibold text-white shadow-[0_2px_10px_rgba(180,83,9,0.45)] transition-transform duration-150 group-hover:-translate-y-0.5 sm:text-sm">
          Unlock the £500 Promise
          <ArrowRight className="h-4 w-4 transition-transform duration-150 group-hover:translate-x-0.5" aria-hidden="true" />
        </span>
      </div>
    </Link>
  );
}

export default function PortfolioToolClient() {
  const [user, setUser] = useState<{ id: string } | null>(null);
  const [authChecked, setAuthChecked] = useState(false);
  const [review, setReview] = useState<CaseReviewResponse | null>(null);
  const [experienceGroups, setExperienceGroups] = useState<string[]>([]);

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then(({ data }) => {
      setUser(data.user as { id: string } | null);
      setAuthChecked(true);
    });
  }, []);

  // Load state from localStorage on initial render
  useEffect(() => {
    const savedReview = localStorage.getItem('savedReview');
    const savedExperienceGroups = localStorage.getItem('savedExperienceGroups');
    if (savedReview) {
      setReview(JSON.parse(savedReview));
    }
    if (savedExperienceGroups) {
      setExperienceGroups(JSON.parse(savedExperienceGroups));
    }
  }, []);

  const handleReviewGenerated = (newReview: CaseReviewResponse, newExperienceGroups: string[]) => {
    setReview(newReview);
    setExperienceGroups(newExperienceGroups);
    localStorage.setItem('savedReview', JSON.stringify(newReview));
    localStorage.setItem('savedExperienceGroups', JSON.stringify(newExperienceGroups));
  };

  const handleReviewUpdate = (updatedReview: CaseReviewResponse) => {
    setReview(updatedReview);
    localStorage.setItem('savedReview', JSON.stringify(updatedReview));
  };

  const handleNewCase = () => {
    analytics.trackNewCaseStarted();
    setReview(null);
    setExperienceGroups([]);
    localStorage.removeItem('savedReview');
    localStorage.removeItem('savedExperienceGroups');
  };

  const isAuthenticated = authChecked && user !== null;

  const content = (
    <ErrorBoundary>
      <section className="card">
        {!review ? (
          <CaseForm onReviewGenerated={handleReviewGenerated} />
        ) : (
          <ReviewDisplay
            review={review}
            experienceGroups={experienceGroups}
            onNewCase={handleNewCase}
            onUpdate={handleReviewUpdate}
          />
        )}
      </section>
      {review && <FeedbackWidget />}
    </ErrorBoundary>
  );

  if (isAuthenticated) {
    return (
      <div className="min-h-[100dvh] bg-surface font-sans">
        <AppNavbar />
        <div className="pt-20">
          <PortfolioPromoBanner />
          <main className="pt-8 pb-16 px-6">
            <div className="max-w-[900px] mx-auto space-y-8">
              {content}
            </div>
          </main>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-[100dvh] bg-surface">
      <LandingNavbar user={user} />
      <div className="pt-20">
        <PortfolioPromoBanner />
        <div className="pt-8 max-w-7xl mx-auto space-y-8 px-4 sm:px-6 lg:px-8">
          {content}
        </div>
      </div>
    </div>
  );
}
