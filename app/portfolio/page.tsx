'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';
import LandingNavbar from '@/components/landing/LandingNavbar';
import { CaseForm } from '@/components/CaseForm';
import { ReviewDisplay } from '@/components/ReviewDisplay';
import type { CaseReviewResponse } from '@/lib/types';
import ErrorBoundary from '@/components/ErrorBoundary';
import { analytics } from '@/lib/analytics';
import { FeedbackWidget } from '@/components/FeedbackWidget';

export default function Home() {
  const [user, setUser] = useState<{ id: string } | null>(null);
  const [review, setReview] = useState<CaseReviewResponse | null>(null);
  const [experienceGroups, setExperienceGroups] = useState<string[]>([]);

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then(({ data }) => setUser(data.user as { id: string } | null));
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

  return (
    <div className="min-h-[100dvh] bg-surface">
      <LandingNavbar user={user} />
      <ErrorBoundary>
        <div className="pt-24 max-w-7xl mx-auto space-y-8 px-4 sm:px-6 lg:px-8">
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
        </div>
        {review && <FeedbackWidget />}
      </ErrorBoundary>
    </div>
  );
}