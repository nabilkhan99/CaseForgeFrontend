'use client';

import { useState } from 'react';
import { CaseForm } from '@/components/CaseForm';
import { ReviewDisplay } from '@/components/ReviewDisplay';
import type { CaseReviewResponse } from '@/lib/types';
import ErrorBoundary from '@/components/ErrorBoundary';

export default function Home() {
  const [review, setReview] = useState<CaseReviewResponse | null>(null);
  const [isImproveMode, setIsImproveMode] = useState(false);

  const handleNewCase = () => {
    setReview(null);
    setIsImproveMode(false);
  };

  return (
    <ErrorBoundary>
      <div className="max-w-7xl mx-auto space-y-8">
        <section className="card">
          {!review ? (
            <CaseForm onReviewGenerated={setReview} />
          ) : (
            <ReviewDisplay
              review={review}
              isImproveMode={isImproveMode}
              onImprove={(improved) => setReview(improved)}
              onNewCase={handleNewCase}
              setIsImproveMode={setIsImproveMode}
            />
          )}
        </section>
      </div>
    </ErrorBoundary>
  );
}