// src/components/ReviewDisplay.tsx
'use client';

import { useState, useEffect } from 'react';
import { CaseReviewResponse } from '@/lib/types';
import { api } from '@/lib/api';
import { Alert } from './common/Alert';
//import { CopyButton } from './common/CopyButton';
import { motion, AnimatePresence } from 'framer-motion';
import { CollapsibleSection } from './CollapsibleSection';

interface ReviewDisplayProps {
  review: CaseReviewResponse;
  isImproveMode: boolean;
  onImprove: (improved: CaseReviewResponse) => void;
  onNewCase: () => void;
  setIsImproveMode: (value: boolean) => void;
}

const getIcon = (sectionKey: string) => {
  switch (sectionKey) {
    case 'brief_description':
      return '📝';
    case 'capabilities':
      return '🎯';
    case 'learning_needs':
      return (
        <svg className="h-5 w-5 text-medical-blue" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path 
            strokeLinecap="round" 
            strokeLinejoin="round" 
            strokeWidth={2} 
            d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253"
          />
        </svg>
      );
    case 'reflection':
      return (
        <svg className="h-5 w-5 text-medical-blue" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path 
            strokeLinecap="round" 
            strokeLinejoin="round" 
            strokeWidth={2} 
            d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z"
          />
        </svg>
      );
    default:
      return '📄';
  }
};

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
  const [improvingSectionKey, setImprovingSectionKey] = useState<string | null>(null);
  const [sectionImprovementPrompt, setSectionImprovementPrompt] = useState('');
  const [isSectionImproving, setIsSectionImproving] = useState(false);

  useEffect(() => {
    console.log('Review prop changed:', review);
    setEditableContent(review);
  }, [review]);

  useEffect(() => {
    const adjustTextareas = () => {
      const textareas = document.querySelectorAll('textarea');
      textareas.forEach(textarea => {
        textarea.style.height = 'auto';
        textarea.style.height = `${textarea.scrollHeight}px`;
      });
    };

    adjustTextareas();
    // Run once after a short delay to handle initial render
    const timeoutId = setTimeout(adjustTextareas, 200);
    
    return () => clearTimeout(timeoutId);
  }, [editableContent]);

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

  const handleSectionImprovement = async (sectionKey: string, content: string) => {
    try {
      setIsSectionImproving(true);
      
      const isCapability = sectionKey.startsWith('capabilities.');
      const [, capabilityName] = isCapability ? sectionKey.split('.') : [];
      
      const improvedContent = await api.improveSection({
        section_type: isCapability ? 'capability' : sectionKey,
        section_content: content,
        improvement_prompt: sectionImprovementPrompt,
        capability_name: capabilityName
      });

      handleContentChange(sectionKey, improvedContent);
      setImprovingSectionKey(null);
      setSectionImprovementPrompt('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to improve section');
    } finally {
      setIsSectionImproving(false);
    }
  };

  const renderSection = (
    title: string,
    content: string | Record<string, string>,
    key: string
  ) => {
    if (key === 'capabilities' && typeof content === 'object') {
      return (
        <div className="space-y-4">
          {Object.entries(content).map(([capKey, capContent]) => (
            <div key={capKey} className="space-y-2">
              <h4 className="text-white/80">{capKey}</h4>
              <div className="flex flex-col space-y-2">
                <div className="flex justify-end items-center gap-2">
                  <motion.button
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    onClick={() => {
                      if (improvingSectionKey === `capabilities.${capKey}`) {
                        handleSectionImprovement(`capabilities.${capKey}`, capContent);
                      } else {
                        setImprovingSectionKey(`capabilities.${capKey}`);
                      }
                    }}
                    className="button-secondary text-sm px-3 py-1 whitespace-nowrap"
                  >
                    <span className="flex items-center gap-1">
                      <span>🪄</span>
                      {improvingSectionKey === `capabilities.${capKey}` ? 'Apply' : 'Improve'}
                    </span>
                  </motion.button>
                  <motion.button
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    onClick={() => copyToClipboard(capContent, `capabilities.${capKey}`)}
                    className="button-secondary text-sm px-3 py-1"
                  >
                    {copiedSection === `capabilities.${capKey}` ? '✓ Copied!' : 'Copy'}
                  </motion.button>
                </div>
                {improvingSectionKey === `capabilities.${capKey}` && (
                  <textarea
                    value={sectionImprovementPrompt}
                    onChange={(e) => setSectionImprovementPrompt(e.target.value)}
                    placeholder="Enter improvement instructions..."
                    className="glass-input w-full text-sm py-1"
                    rows={2}
                    disabled={isSectionImproving}
                  />
                )}
              </div>
              <textarea
                value={capContent}
                onChange={(e) => handleContentChange(`capabilities.${capKey}`, e.target.value)}
                className="glass-input w-full min-h-[100px]"
                ref={(textarea) => {
                  if (textarea) {
                    textarea.style.height = 'auto';
                    textarea.style.height = `${textarea.scrollHeight}px`;
                  }
                }}
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
  
    if (typeof content === 'string') {
      return (
        <div className="space-y-2">
          <div className="flex flex-col space-y-2">
            <div className="flex justify-end items-center gap-2">
              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={() => {
                  if (improvingSectionKey === key) {
                    handleSectionImprovement(key, content);
                  } else {
                    setImprovingSectionKey(key);
                  }
                }}
                className="button-secondary text-sm px-3 py-1 whitespace-nowrap"
              >
                <span className="flex items-center gap-1">
                  <span>🪄</span>
                  {improvingSectionKey === key ? 'Apply' : 'Improve'}
                </span>
              </motion.button>
              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={() => copyToClipboard(content, key)}
                className="button-secondary text-sm px-3 py-1"
              >
                {copiedSection === key ? '✓ Copied!' : 'Copy'}
              </motion.button>
            </div>
            {improvingSectionKey === key && (
              <textarea
                value={sectionImprovementPrompt}
                onChange={(e) => setSectionImprovementPrompt(e.target.value)}
                placeholder="Enter improvement instructions..."
                className="glass-input w-full text-sm py-1"
                rows={2}
                disabled={isSectionImproving}
              />
            )}
          </div>
          <textarea
            value={content}
            onChange={(e) => handleContentChange(key, e.target.value)}
            className="glass-input w-full min-h-[100px]"
            ref={(textarea) => {
              if (textarea) {
                textarea.style.height = 'auto';
                textarea.style.height = `${textarea.scrollHeight}px`;
              }
            }}
            onInput={(e) => {
              const target = e.target as HTMLTextAreaElement;
              target.style.height = 'auto';
              target.style.height = `${target.scrollHeight}px`;
            }}
          />
        </div>
      );
    }
  
    return null;
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
    <motion.article 
      className="space-y-6"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.3 }}
    >
      <motion.header 
        className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4"
        initial={{ y: -20 }}
        animate={{ y: 0 }}
        transition={{ delay: 0.1 }}
      >
        <h1 className="text-xl sm:text-2xl font-bold text-white break-words">{editableContent.case_title}</h1>
        <div className="flex gap-2 sm:gap-4">
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={() => setIsImproveMode(!isImproveMode)}
            className="button-secondary text-sm sm:text-base flex-1 sm:flex-none px-3 sm:px-4 py-2"
          >
            <span className="flex items-center justify-center gap-2">
              {isImproveMode ? '✕ Cancel' : '✨ Improve'}
            </span>
          </motion.button>
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={onNewCase}
            className="primary-button text-sm sm:text-base flex-1 sm:flex-none px-3 sm:px-4 py-2"
          >
            <span className="flex items-center justify-center gap-2">
              <span>🔄</span>
              New Case
            </span>
          </motion.button>
        </div>
      </motion.header>

      <AnimatePresence>
        {isImproveMode && (
          <motion.section
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.3 }}
            className="space-y-4 p-4 sm:p-6 bg-white/5 rounded-xl border border-white/10"
          >
            <div className="space-y-2">
              <label htmlFor="improvement-prompt" className="text-white/80 flex items-center gap-2">
                <span>✨</span>
                Improvement Instructions
              </label>
              <textarea
                id="improvement-prompt"
                value={improvementPrompt}
                onChange={(e) => setImprovementPrompt(e.target.value)}
                placeholder="Enter your improvement instructions..."
                className="glass-input w-full"
                rows={3}
                disabled={isLoading}
              />
            </div>
            {error && <Alert type="error" message={error} />}
            <div className="flex justify-center pt-6">
              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={handleImprove}
                disabled={isLoading}
                className="primary-button"
              >
                {isLoading ? (
                  <span className="flex items-center gap-1">
                    <span className="animate-pulse text-white">🪄</span>
                    Improving...
                  </span>
                ) : (
                  <span className="flex items-center gap-1">
                    <span className="text-white">✨</span>
                    Apply Improvements
                  </span>
                )}
              </motion.button>
            </div>
          </motion.section>
        )}
      </AnimatePresence>

      <motion.div 
        className="space-y-4"
        initial={{ y: 20 }}
        animate={{ y: 0 }}
        transition={{ delay: 0.2 }}
      >
        {Object.entries(editableContent.sections).map(([key, content]) => (
          <CollapsibleSection
            key={key}
            title={key.charAt(0).toUpperCase() + key.slice(1).replace(/_/g, ' ')}
            icon={getIcon(key)}
            defaultOpen={key === 'brief_description'}
          >
            {renderSection(
              key.charAt(0).toUpperCase() + key.slice(1).replace(/_/g, ' '),
              content,
              key
            )}
          </CollapsibleSection>
        ))}
      </motion.div>
    </motion.article>
  );
}