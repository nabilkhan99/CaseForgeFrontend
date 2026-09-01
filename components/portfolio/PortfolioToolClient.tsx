'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';
import LandingNavbar from '@/components/landing/LandingNavbar';
import AppNavbar from '@/components/ui/AppNavbar';
import { CaseForm } from '@/components/CaseForm';
import { ReviewDisplay } from '@/components/ReviewDisplay';
import type { CaseReviewResponse } from '@/lib/types';
import ErrorBoundary from '@/components/ErrorBoundary';
import ReferralBanner from '@/components/portfolio/ReferralBanner';
import { usePortfolioReviewState } from '@/components/portfolio/PortfolioReviewState';
import { analytics } from '@/lib/analytics';
import { FeedbackWidget } from '@/components/FeedbackWidget';

export default function PortfolioToolClient() {
  const [user, setUser] = useState<{ id: string } | null>(null);
  const [authChecked, setAuthChecked] = useState(false);
  const [review, setReview] = useState<CaseReviewResponse | null>(null);
  const [experienceGroups, setExperienceGroups] = useState<string[]>([]);
  const { setHasReview } = usePortfolioReviewState();

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

  // Publish "is a review on screen?" to the below-fold block, which the SERVER
  // page renders as our sibling so its HTML ships in the initial response.
  // Keyed off `review` rather than off the generate callback on purpose: a
  // returning user has a review restored from localStorage above and has never
  // pressed generate, and they should get the same clean output view.
  useEffect(() => {
    setHasReview(review !== null);
  }, [review, setHasReview]);

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
      {/* H1, then the input — nothing between them. The H1 stands down once a
          review exists because ReviewDisplay renders the generated case title as
          the page's <h1> from then on, and two <h1>s would split the topic
          signal the quiet one exists to give.

          The referral strip that used to sit here, and its twin at the top of
          the output, are both gone: ReferralBanner lives in the page shell
          above, so it is on screen in either state and a copy in here would be
          the two-identical-bars problem the strip's own comment warned about. */}
      {!review && (
        <h1 className="mb-4 text-[18px] font-semibold leading-snug tracking-tight text-heading">
          Free GP portfolio tool: AI clinical case review generator
        </h1>
      )}

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
          {/* Contained, not full-bleed: the banner is a card that lines up with
              the navbar above it, as in the design. The bar it replaced was
              edge-to-edge, which is why it sat outside this container. */}
          <div className="mx-auto max-w-7xl px-4 pt-6 sm:px-6 lg:px-8">
            <ReferralBanner placement="portfolio-authed" />
          </div>
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
        <div className="mx-auto max-w-7xl px-4 pt-6 sm:px-6 lg:px-8">
          <ReferralBanner placement="portfolio-anon" />
        </div>
        <div className="pt-8 max-w-7xl mx-auto space-y-8 px-4 sm:px-6 lg:px-8">
          {content}
        </div>
      </div>
    </div>
  );
}
