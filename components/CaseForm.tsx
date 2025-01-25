// src/components/CaseForm.tsx
'use client';

import { useState } from 'react';
import { api } from '@/lib/api';
import { CapabilitySelect } from './CapabilitySelect';
import { CaseReviewResponse } from '@/lib/types';
import { Alert } from './common/Alert';
import { motion } from 'framer-motion';

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
    <motion.form 
      onSubmit={handleSubmit} 
      className="space-y-6"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.3 }}
    >
      <motion.div 
        className="space-y-2"
        initial={{ x: -20 }}
        animate={{ x: 0 }}
        transition={{ delay: 0.1 }}
      >
        <label
          htmlFor="case-description"
          className="block text-sm font-medium text-gray-700"
        >
          Case Description
        </label>
        <textarea
          id="case-description"
          name="case-description"
          rows={6}
          className="shadow-sm focus:ring-indigo-500 focus:border-indigo-500 block w-full sm:text-sm border-gray-300 rounded-md transition-all duration-200"
          value={caseDescription}
          onChange={(e) => setCaseDescription(e.target.value)}
          placeholder="Enter your case description here..."
          disabled={isLoading}
        />
      </motion.div>

      <motion.div
        initial={{ x: -20 }}
        animate={{ x: 0 }}
        transition={{ delay: 0.2 }}
      >
        <CapabilitySelect
          selectedCapabilities={selectedCapabilities}
          onChange={setSelectedCapabilities}
          disabled={isLoading}
        />
      </motion.div>

      {error && (
        <motion.div 
          role="alert" 
          aria-live="polite"
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -10 }}
        >
          <Alert type="error" message={error} />
        </motion.div>
      )}

      <motion.div 
        className="flex justify-center"
        initial={{ x: -20 }}
        animate={{ x: 0 }}
        transition={{ delay: 0.3 }}
      >
        <button
          type="submit"
          disabled={isLoading}
          className="primary-button w-full sm:w-auto"
        >
          {isLoading ? (
            <span className="flex items-center">
              <span className="animate-spin mr-2">⌛</span>
              Generating...
            </span>
          ) : (
            'Generate Case Review'
          )}
        </button>
      </motion.div>
    </motion.form>
  );
}