// src/components/ReviewDisplay.tsx
'use client';

import { useState, useEffect } from 'react';
import { CaseReviewResponse } from '@/lib/types';
import { api } from '@/lib/api';
import { Alert } from './common/Alert';
//import { CopyButton } from './common/CopyButton';

interface ReviewDisplayProps {
  review: CaseReviewResponse;
  isImproveMode: boolean;
  onImprove: (improved: CaseReviewResponse) => void;
  onNewCase: () => void;
  setIsImproveMode: (value: boolean) => void;
}

export function ReviewDisplay({
  review,
  isImproveMode,
  onImprove,
  onNewCase,
  setIsImproveMode,
}: ReviewDisplayProps) {
  const [editableContent, setEditableContent] = useState(review);
  const [improvementPrompt, setImprovementPrompt] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copiedSection, setCopiedSection] = useState<string | null>(null);

  useEffect(() => {
    console.log('Review prop changed:', review);
    setEditableContent(review);
  }, [review]);

  useEffect(() => {
    // Adjust all textareas to fit their content
    const textareas = document.querySelectorAll('textarea');
    textareas.forEach(textarea => {
      textarea.style.height = 'auto';
      textarea.style.height = `${textarea.scrollHeight}px`;
    });
  }, [editableContent]); // Run when content changes

  const handleContentChange = (section: string, content: string) => {
    setEditableContent(prev => {
      if (section.startsWith('capabilities.')) {
        const [, capabilityKey] = section.split('.');
        return {
          ...prev,
          sections: {
            ...prev.sections,
            capabilities: {
              ...prev.sections.capabilities,
              [capabilityKey]: content
            }
          }
        };
      }
      return {
        ...prev,
        sections: {
          ...prev.sections,
          [section]: content
        }
      };
    });
  };

  const copyToClipboard = async (content: string, section: string) => {
    try {
      await navigator.clipboard.writeText(content);
      setCopiedSection(section);
      setTimeout(() => setCopiedSection(null), 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  };

  const renderSection = (
    title: string,
    content: string | Record<string, string>,
    key: string
  ) => {
    // For the capabilities section which is a Record<string, string>
    if (key === 'capabilities' && typeof content === 'object') {
      return (
        <div key={key} className="space-y-2">
          <h3 className="text-lg font-medium text-gray-900">Capabilities</h3>
          {Object.entries(content).map(([capKey, capContent]) => (
            <div key={capKey} className="mt-4">
              <div className="flex justify-between items-center mb-2">
                <h4 className="text-md font-medium text-gray-700">{capKey}</h4>
                <button
                  onClick={() => copyToClipboard(capContent, `capabilities.${capKey}`)}
                  className="inline-flex items-center px-3 py-1 border border-gray-300 shadow-sm text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
                >
                  {copiedSection === `capabilities.${capKey}` ? 'Copied!' : 'Copy'}
                </button>
              </div>
              <textarea
                value={capContent}
                onChange={(e) => handleContentChange(`capabilities.${capKey}`, e.target.value)}
                className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                style={{ height: 'auto', minHeight: '0px' }}
                onInput={(e) => {
                  const target = e.target as HTMLTextAreaElement;
                  target.style.height = 'auto';
                  target.style.height = `${target.scrollHeight}px`;
                }}
              />
            </div>
          ))}
        </div>
      );
    }
  
    // For string content
    if (typeof content === 'string') {
      return (
        <div key={key} className="space-y-2">
          <div className="flex justify-between items-center">
            <h3 className="text-lg font-medium text-gray-900">{title}</h3>
            <button
              onClick={() => copyToClipboard(content, key)}
              className="inline-flex items-center px-3 py-1 border border-gray-300 shadow-sm text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
            >
              {copiedSection === key ? 'Copied!' : 'Copy'}
            </button>
          </div>
          <textarea
            value={content}
            onChange={(e) => handleContentChange(key, e.target.value)}
            className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
            style={{ height: 'auto', minHeight: '0px' }}
            onInput={(e) => {
              const target = e.target as HTMLTextAreaElement;
              target.style.height = 'auto';
              target.style.height = `${target.scrollHeight}px`;
            }}
          />
        </div>
      );
    }
  
    return null; // Handle any unexpected content types
  };

  const handleImprove = async () => {
    setError(null);
    setIsLoading(true);

    try {
      if (!improvementPrompt.trim()) {
        throw new Error('Please enter improvement instructions');
      }

      const improved = await api.improveReview({
        original_case: editableContent.review_content,
        improvement_prompt: improvementPrompt,
        selected_capabilities: Object.keys(editableContent.sections.capabilities),
      });

      onImprove(improved);
      setImprovementPrompt('');
      setIsImproveMode(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <article className="space-y-8">
      <header className="flex justify-between items-center">
        <h1 className="text-2xl font-bold text-gray-900">{editableContent.case_title}</h1>
        <div className="flex gap-4">
          <button
            onClick={() => setIsImproveMode(!isImproveMode)}
            className="inline-flex items-center px-4 py-2 border border-gray-300 shadow-sm text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
          >
            {isImproveMode ? 'Cancel Improve' : 'Improve'}
          </button>
          <button
            onClick={onNewCase}
            className="primary-button"
          >
            New Case
          </button>
        </div>
      </header>

      {isImproveMode && (
        <section className="space-y-4" aria-label="Improvement Section">
          <div className="space-y-2">
            <label htmlFor="improvement-prompt" className="block text-sm font-medium text-gray-700">
              Improvement Instructions
            </label>
            <textarea
              id="improvement-prompt"
              value={improvementPrompt}
              onChange={(e) => setImprovementPrompt(e.target.value)}
              placeholder="Enter your improvement instructions..."
              className="shadow-sm focus:ring-indigo-500 focus:border-indigo-500 block w-full sm:text-sm border-gray-300 rounded-md"
              rows={3}
              disabled={isLoading}
            />
          </div>
          {error && <Alert type="error" message={error} />}
          <button
            onClick={handleImprove}
            disabled={isLoading}
            className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
          >
            {isLoading ? (
              <span className="flex items-center">
                <span className="animate-spin mr-2">⌛</span>
                Improving...
              </span>
            ) : (
              'Apply Improvements'
            )}
          </button>
        </section>
      )}

      <div className="space-y-8">
        {Object.entries(editableContent.sections).map(([key, content]) => (
          renderSection(
            key.charAt(0).toUpperCase() + key.slice(1).replace(/_/g, ' '),
            content,
            key
          )
        ))}
      </div>
    </article>
  );
}