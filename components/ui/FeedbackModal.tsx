'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

interface FeedbackModalProps {
  isOpen: boolean;
  onClose: () => void;
  sourceType: 'case' | 'portfolio';
  sourceId?: string;
}

export default function FeedbackModal({ isOpen, onClose, sourceType, sourceId }: FeedbackModalProps) {
  const [comment, setComment] = useState('');
  const [email, setEmail] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!comment.trim()) return;

    setIsSubmitting(true);
    try {
      await fetch('/api/feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          comment: comment.trim(),
          email: email.trim() || null,
          source_type: sourceType,
          source_id: sourceId || null,
        }),
      });
    } catch {
      // Fail silently — feedback is non-critical
    }

    setIsSubmitting(false);
    setShowSuccess(true);

    setTimeout(() => {
      setShowSuccess(false);
      onClose();
      setComment('');
      setEmail('');
    }, 2000);
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            className="fixed inset-0 bg-black/30 z-50"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
          />
          {/* Modal */}
          <motion.div
            className="fixed inset-0 z-50 flex items-center justify-center p-4"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <motion.div
              className="w-full max-w-md bg-white rounded-2xl shadow-elevation-4 border border-border-card overflow-hidden"
              initial={{ scale: 0.95, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.95, y: 20 }}
              onClick={e => e.stopPropagation()}
            >
              {/* Header */}
              <div className="flex items-center justify-between px-6 py-4 border-b border-black/[0.06]">
                <h3 className="text-base font-semibold text-heading">Send Feedback</h3>
                <button
                  onClick={onClose}
                  className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-black/[0.04] transition-colors text-muted hover:text-heading"
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                    <path d="M18 6L6 18M6 6l12 12" />
                  </svg>
                </button>
              </div>

              {showSuccess ? (
                <div className="px-6 py-12 text-center space-y-2">
                  <p className="text-heading font-medium">Thank you!</p>
                  <p className="text-text-secondary text-sm">Your feedback helps us improve.</p>
                </div>
              ) : (
                <form onSubmit={handleSubmit} className="px-6 py-5 space-y-4">
                  <div>
                    <label htmlFor="fb-comment" className="block text-sm font-medium text-heading mb-1.5">
                      Your feedback
                    </label>
                    <textarea
                      id="fb-comment"
                      required
                      rows={4}
                      className="w-full rounded-xl border border-black/[0.08] focus:border-primary/30 focus:ring-2 focus:ring-primary/20 text-sm p-3 text-heading placeholder:text-muted resize-none transition-all"
                      placeholder="What's on your mind?"
                      value={comment}
                      onChange={e => setComment(e.target.value)}
                    />
                  </div>
                  <div>
                    <label htmlFor="fb-email" className="block text-sm font-medium text-heading mb-1.5">
                      Email <span className="text-muted font-normal">(optional)</span>
                    </label>
                    <input
                      type="email"
                      id="fb-email"
                      className="w-full rounded-xl border border-black/[0.08] focus:border-primary/30 focus:ring-2 focus:ring-primary/20 text-sm p-3 text-heading placeholder:text-muted transition-all"
                      placeholder="you@example.com"
                      value={email}
                      onChange={e => setEmail(e.target.value)}
                    />
                  </div>
                  <button
                    type="submit"
                    disabled={isSubmitting || !comment.trim()}
                    className="w-full py-3 rounded-xl text-white text-sm font-semibold transition-all disabled:opacity-50 disabled:cursor-not-allowed hover:brightness-110"
                    style={{ background: '#C2410C' }}
                  >
                    {isSubmitting ? 'Sending...' : 'Send Feedback'}
                  </button>
                </form>
              )}
            </motion.div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
