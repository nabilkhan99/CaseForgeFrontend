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

        <section className="card">
          <h2 className="text-lg font-medium text-gray-900 mb-6">
            How to use
          </h2>
          <ol className="list-decimal list-inside space-y-3 text-gray-600">
            <li>Enter your case description in the text area</li>
            <li>Select 1-3 capabilities from the list</li>
            <li>Click &apos;Generate Case Review&apos;</li>
            <li>Edit the generated sections as needed</li>
            <li>Copy individual sections using the copy buttons</li>
          </ol>
        </section>
      </div>
    </ErrorBoundary>
  );
}