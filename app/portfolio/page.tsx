'use client';

import { useState, useEffect } from 'react';
import { CaseForm } from '@/components/CaseForm';
import { ReviewDisplay } from '@/components/ReviewDisplay';
import type { CaseReviewResponse } from '@/lib/types';
import ErrorBoundary from '@/components/ErrorBoundary';
import { FeedbackWidget } from '@/components/FeedbackWidget';
import LandingNavbar from '@/components/landing/LandingNavbar';
import LandingFooter from '@/components/landing/LandingFooter';
import { createClient } from '@/lib/supabase/client';

export default function PortfolioPage() {
  const [review, setReview] = useState<CaseReviewResponse | null>(null);
  const [experienceGroups, setExperienceGroups] = useState<string[]>([]);
  const [user, setUser] = useState<{ id: string } | null>(null);

  useEffect(() => {
    const savedReview = localStorage.getItem('savedReview');
    const savedExperienceGroups = localStorage.getItem('savedExperienceGroups');
    if (savedReview) {
      setReview(JSON.parse(savedReview));
    }
    if (savedExperienceGroups) {
      setExperienceGroups(JSON.parse(savedExperienceGroups));
    }

    const supabase = createClient();
    supabase.auth.getUser().then(({ data }) => setUser(data.user as { id: string } | null));
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
    setReview(null);
    setExperienceGroups([]);
    localStorage.removeItem('savedReview');
    localStorage.removeItem('savedExperienceGroups');
  };

  return (
    <div className="min-h-screen bg-surface font-sans">
      <LandingNavbar user={user} />

      <main className="pt-28 pb-16 px-6">
        <div className="max-w-5xl mx-auto">
          <ErrorBoundary>
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
          </ErrorBoundary>
        </div>
      </main>

      {review && <FeedbackWidget />}
      <LandingFooter />
    </div>
  );
}
