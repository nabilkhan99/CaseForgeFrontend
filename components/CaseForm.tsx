// src/components/CaseForm.tsx
'use client';

import { useState } from 'react';
import { api } from '@/lib/api';
import { CapabilitySelect } from './CapabilitySelect';
import { CaseReviewResponse } from '@/lib/types';
import { motion } from 'framer-motion';
import { analytics } from '@/lib/analytics';
import { LoadingOverlay } from './common/LoadingOverlay';

interface CaseFormProps {
  onReviewGenerated: (review: CaseReviewResponse, experienceGroups: string[]) => void;
}

export function CaseForm({ onReviewGenerated }: CaseFormProps) {
  const [caseDescription, setCaseDescription] = useState('');
  const [selectedCapabilities, setSelectedCapabilities] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [aiSelectEnabled, setAiSelectEnabled] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      if (caseDescription.trim().length < 10) {
        throw new Error('Please enter a longer case description');
      }

      let capabilitiesToUse = selectedCapabilities;

      // If AI selection is enabled, get AI-selected capabilities
      if (aiSelectEnabled) {
        const aiResponse = await api.selectCapabilities({
          case_description: caseDescription,
        });
        capabilitiesToUse = aiResponse.selected_capabilities;
      } else {
        // Manual selection validation
        if (selectedCapabilities.length === 0) {
          throw new Error('Please select at least one capability or enable AI selection');
        }

        if (selectedCapabilities.length > 3) {
          throw new Error('Please select no more than three capabilities');
        }
      }

      // Track case submission
      analytics.trackCaseSubmitted(caseDescription, capabilitiesToUse);

      // Call both APIs in parallel for better performance
      const [response, experienceGroupsResponse] = await Promise.all([
        api.generateReview({
          case_description: caseDescription,
          selected_capabilities: capabilitiesToUse,
        }),
        api.selectExperienceGroups({
          case_description: caseDescription,
        }),
      ]);

      // Track successful generation
      analytics.trackReviewGenerated(response.case_title, capabilitiesToUse);

      onReviewGenerated(response, experienceGroupsResponse.experience_groups);
    } catch (err) {
      console.error(err);
      analytics.trackError('generation_failed', err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <>
      <LoadingOverlay 
        isVisible={isLoading} 
        messages={[
          "Calibrating humility levels...",
          "Making sure your ES approves...",
          "Analysing case details...",
          "Identifying clinical capabilities...",
          "Consulting RCGP guidelines..."
        ]}
      />
      <motion.form 
        onSubmit={handleSubmit} 
      className="space-y-8"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.5 }}
    >
      <div className="relative space-y-4">
        <motion.div 
          className="space-y-2"
          initial={{ x: -20 }}
          animate={{ x: 0 }}
          transition={{ delay: 0.1 }}
        >
          <label className="text-white/80 flex items-center gap-2">
            <svg className="h-5 w-5 text-medical-blue" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            Case Description
          </label>
          <textarea
            className="glass-input w-full h-40"
            value={caseDescription}
            onChange={(e) => setCaseDescription(e.target.value)}
            placeholder="Describe your medical case here..."
            disabled={isLoading}
          />
        </motion.div>

        <motion.div
          initial={{ x: -20 }}
          animate={{ x: 0 }}
          transition={{ delay: 0.2 }}
          className="ai-glow"
        >
          <CapabilitySelect
            selectedCapabilities={selectedCapabilities}
            onChange={setSelectedCapabilities}
            disabled={isLoading}
            aiSelectEnabled={aiSelectEnabled}
            onAISelectToggle={setAiSelectEnabled}
          />
        </motion.div>
      </div>

      <motion.div 
        className="flex justify-center pt-6"
        initial={{ y: 20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 0.3 }}
      >
        <button
          type="submit"
          disabled={isLoading}
          className="primary-button group relative"
        >
          <span className="flex items-center gap-1">
            <span className="text-white group-hover:rotate-180 transition-transform duration-300">✨</span>
            Generate Review
          </span>
        </button>
      </motion.div>
    </motion.form>
    </>
  );
}