// src/components/CaseForm.tsx
'use client';

import { useState } from 'react';
import { api } from '@/lib/api';
import { CapabilitySelect } from './CapabilitySelect';
import { CaseReviewResponse } from '@/lib/types';
import { Alert } from './common/Alert';

interface CaseFormProps {
  onReviewGenerated: (review: CaseReviewResponse) => void;
}

export function CaseForm({ onReviewGenerated }: CaseFormProps) {
  const [caseDescription, setCaseDescription] = useState('');
  const [selectedCapabilities, setSelectedCapabilities] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsLoading(true);

    try {
      if (selectedCapabilities.length === 0) {
        throw new Error('Please select at least one capability');
      }

      if (selectedCapabilities.length > 3) {
        throw new Error('Please select no more than three capabilities');
      }

      if (caseDescription.trim().length < 10) {
        throw new Error('Please enter a longer case description');
      }

      const response = await api.generateReview({
        case_description: caseDescription,
        selected_capabilities: selectedCapabilities,
      });

      onReviewGenerated(response);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="space-y-2">
        <label
          htmlFor="case-description"
          className="block text-sm font-medium text-gray-700"
        >
          Case Description
        </label>
        <div className="relative">
          <textarea
            id="case-description"
            name="case-description"
            rows={6}
            className="shadow-sm focus:ring-indigo-500 focus:border-indigo-500 block w-full sm:text-sm border-gray-300 rounded-md"
            value={caseDescription}
            onChange={(e) => setCaseDescription(e.target.value)}
            placeholder="Enter your case description here..."
            disabled={isLoading}
            aria-describedby="case-description-error"
          />
        </div>
      </div>

      <CapabilitySelect
        selectedCapabilities={selectedCapabilities}
        onChange={setSelectedCapabilities}
        disabled={isLoading}
      />

      {error && (
        <div role="alert" aria-live="polite">
          <Alert type="error" message={error} />
        </div>
      )}

      <div className="flex justify-end">
        <button
          type="submit"
          disabled={isLoading}
          className={`inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 ${
            isLoading ? 'opacity-50 cursor-not-allowed' : ''
          }`}
          aria-busy={isLoading}
        >
          {isLoading ? (
            <span className="flex items-center">
              <span className="animate-spin mr-2">
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24">
                  <circle
                    className="opacity-25"
                    cx="12"
                    cy="12"
                    r="10"
                    stroke="currentColor"
                    strokeWidth="4"
                  />
                  <path
                    className="opacity-75"
                    fill="currentColor"
                    d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                  />
                </svg>
              </span>
              Generating...
            </span>
          ) : (
            'Generate Case Review'
          )}
        </button>
      </div>
    </form>
  );
}