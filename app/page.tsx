'use client';

import { useState, useEffect } from 'react';
import { CaseForm } from '@/components/CaseForm';
import { ReviewDisplay } from '@/components/ReviewDisplay';
import type { CaseReviewResponse } from '@/lib/types';
import ErrorBoundary from '@/components/ErrorBoundary';
import { analytics } from '@/lib/analytics';

export default function Home() {
  const [review, setReview] = useState<CaseReviewResponse | null>(null);
  const [isImproveMode, setIsImproveMode] = useState(false);

  // Load state from localStorage on initial render
  useEffect(() => {
    const savedReview = localStorage.getItem('savedReview');
    if (savedReview) {
      setReview(JSON.parse(savedReview));
    }
  }, []);

  const handleReviewGenerated = (newReview: CaseReviewResponse) => {
    setReview(newReview);
    localStorage.setItem('savedReview', JSON.stringify(newReview));
  };

  const handleImprove = (improved: CaseReviewResponse) => {
    setReview(improved);
    localStorage.setItem('savedReview', JSON.stringify(improved));
  };

  const handleNewCase = () => {
    analytics.trackNewCaseStarted();
    setReview(null);
    setIsImproveMode(false);
    localStorage.removeItem('savedReview');
  };

  return (
    <ErrorBoundary>
      <div className="max-w-7xl mx-auto space-y-8">
        <section className="card">
          {!review ? (
            <CaseForm onReviewGenerated={handleReviewGenerated} />
          ) : (
            <ReviewDisplay
              review={review}
              isImproveMode={isImproveMode}
              onImprove={handleImprove}
              onNewCase={handleNewCase}
              setIsImproveMode={setIsImproveMode}
            />
          )}
        </section>
      </div>
    </ErrorBoundary>
  );
}