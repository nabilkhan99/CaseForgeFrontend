// src/components/ReviewDisplay.tsx
'use client';

import { useState, useEffect } from 'react';
import { CaseReviewResponse } from '@/lib/types';
import { api } from '@/lib/api';
import { motion } from 'framer-motion';
import { CollapsibleSection } from './CollapsibleSection';
import { analytics } from '@/lib/analytics';
import { LoadingOverlay } from './common/LoadingOverlay';

interface ReviewDisplayProps {
  review: CaseReviewResponse;
  experienceGroups: string[];
  onNewCase: () => void;
  onUpdate: (review: CaseReviewResponse) => void;
}

const getIcon = (sectionKey: string) => {
  switch (sectionKey) {
    case 'brief_description':
      return '📝';
    case 'capabilities':
      return '🎯';
    case 'learning_needs':
      return '📒';
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
  experienceGroups,
  onNewCase,
  onUpdate,
}: ReviewDisplayProps) {
  const [editableContent, setEditableContent] = useState(review);
  const [copiedSection, setCopiedSection] = useState<string | null>(null);
  const [improvingSectionKey, setImprovingSectionKey] = useState<string | null>(null);
  const [sectionImprovementPrompt, setSectionImprovementPrompt] = useState('');
  const [isSectionImproving, setIsSectionImproving] = useState(false);
  const [titleCopied, setTitleCopied] = useState(false);

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

  const handleCopyTitle = async () => {
    try {
      await navigator.clipboard.writeText(editableContent.case_title);
      setTitleCopied(true);
      setTimeout(() => setTitleCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy title:', err);
    }
  };

  const handleContentChange = (section: string, content: string) => {
    let updatedReview: CaseReviewResponse;
    
    if (section.startsWith('capabilities.')) {
      const [, capabilityKey] = section.split('.');
      updatedReview = {
        ...editableContent,
        sections: {
          ...editableContent.sections,
          capabilities: {
            ...editableContent.sections.capabilities,
            [capabilityKey]: content
          }
        }
      };
    } else {
      updatedReview = {
        ...editableContent,
        sections: {
          ...editableContent.sections,
          [section]: content
        }
      };
    }

    setEditableContent(updatedReview);
    onUpdate(updatedReview);
  };

  const copyToClipboard = async (content: string, section: string) => {
    try {
      await navigator.clipboard.writeText(content);
      analytics.trackCopyAction(section, content.length);
      setCopiedSection(section);
      setTimeout(() => setCopiedSection(null), 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
      analytics.trackError('copy_failed', err instanceof Error ? err.message : 'Unknown error', { section });
    }
  };

  const handleSectionImprovement = async (sectionKey: string, content: string) => {
    try {
      setIsSectionImproving(true);
      
      const isCapability = sectionKey.startsWith('capabilities.');
      const [, capabilityName] = isCapability ? sectionKey.split('.') : [];
      
      // Track section improvement request
      analytics.trackImprovementRequested(sectionKey, sectionImprovementPrompt, false);
      
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
      analytics.trackError('section_improvement_failed', err instanceof Error ? err.message : 'Unknown error', { section: sectionKey });
      console.error('Failed to improve section:', err);
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
              <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-2">
                <h4 className="text-white/80">{capKey}</h4>
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

  return (
    <>
      <LoadingOverlay 
        isVisible={isSectionImproving} 
        messages={[
          "Analysing section content...",
          "Understanding improvement request...",
          "Consulting medical guidelines...",
          "Applying specific improvements...",
          "Polishing the text...",
          "Finalising updates..."
        ]}
      />
      <motion.article 
        className="space-y-6"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.3 }}
    >
      <motion.header 
        className="flex flex-col sm:flex-row sm:justify-between sm:items-start gap-4"
        initial={{ y: -20 }}
        animate={{ y: 0 }}
        transition={{ delay: 0.1 }}
      >
        <div className="flex items-start gap-3 flex-1 min-w-0">
          <h1 className="text-xl sm:text-2xl font-bold text-white break-words">{editableContent.case_title}</h1>
          <button
            onClick={handleCopyTitle}
            className="p-2 text-white/50 hover:text-white hover:bg-white/10 rounded-lg transition-all flex-shrink-0 mt-0.5"
            title="Copy title"
          >
            {titleCopied ? (
              <span className="text-green-400 text-sm font-medium">Copied!</span>
            ) : (
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
              </svg>
            )}
          </button>
        </div>
        <motion.button
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          onClick={onNewCase}
          className="primary-button text-sm sm:text-base px-3 sm:px-4 py-2 flex-shrink-0"
        >
          <span className="flex items-center justify-center gap-2">
            <span>🔄</span>
            New Case
          </span>
        </motion.button>
      </motion.header>

      {/* Clinical Experience Groups */}
      {experienceGroups && experienceGroups.length > 0 && (
        <motion.div
          className="flex flex-wrap gap-2"
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15 }}
        >
          <span className="text-white/60 text-sm self-center mr-1">Clinical Experience Groups:</span>
          {experienceGroups.map((group, index) => (
            <span
              key={index}
              className="inline-flex items-center px-3 py-1.5 rounded-full text-sm font-medium bg-teal-500/20 text-teal-300 border border-teal-500/30"
            >
              🏥 {group}
            </span>
          ))}
        </motion.div>
      )}

      <motion.div 
        className="space-y-4"
        initial={{ y: 20 }}
        animate={{ y: 0 }}
        transition={{ delay: 0.2 }}
      >
        {/* Define the desired order: brief_description, capabilities, reflection, learning_needs */}
        {['brief_description', 'capabilities', 'reflection', 'learning_needs']
          .filter(key => editableContent.sections[key as keyof typeof editableContent.sections])
          .map((key) => {
            const content = editableContent.sections[key as keyof typeof editableContent.sections];
            return (
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
            );
          })}
      </motion.div>
    </motion.article>
    </>
  );
}