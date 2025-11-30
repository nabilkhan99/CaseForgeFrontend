'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { analytics } from '@/lib/analytics';

export function FeedbackWidget() {
  const [isOpen, setIsOpen] = useState(false);
  const [email, setEmail] = useState('');
  const [comment, setComment] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!comment.trim()) return;

    setIsSubmitting(true);
    
    // Simulate network delay for better UX
    await new Promise(resolve => setTimeout(resolve, 800));
    
    // Send to PostHog
    analytics.trackFeedback(comment, email);

    setIsSubmitting(false);
    setShowSuccess(true);
    
    // Reset after showing success message
    setTimeout(() => {
      setShowSuccess(false);
      setIsOpen(false);
      setComment('');
      setEmail('');
    }, 2000);
  };

  return (
    <div className="w-full flex flex-col items-end py-12 px-6 mt-auto z-40 relative">
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, scale: 0.9, y: 20, x: 0 }}
            animate={{ opacity: 1, scale: 1, y: 0, x: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: 20, x: 0 }}
            className="mb-4 w-full max-w-sm bg-white rounded-xl shadow-2xl border border-gray-200 overflow-hidden"
          >
            <div className="p-4 bg-gray-50 border-b border-gray-100 flex justify-between items-center">
              <h3 className="font-semibold text-gray-900">Send Feedback</h3>
              <button 
                onClick={() => setIsOpen(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                ✕
              </button>
            </div>

            {showSuccess ? (
              <div className="p-8 text-center space-y-2">
                <div className="text-4xl">✨</div>
                <p className="text-gray-900 font-medium">Thank you!</p>
                <p className="text-gray-500 text-sm">Your feedback helps us improve.</p>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="p-4 space-y-4">
                <div>
                  <label htmlFor="feedback-comment" className="block text-sm font-medium text-gray-700 mb-1">
                    Comments <span className="text-red-500">*</span>
                  </label>
                  <textarea
                    id="feedback-comment"
                    required
                    rows={3}
                    className="w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm p-2 border text-gray-900"
                    placeholder="What's on your mind?"
                    value={comment}
                    onChange={(e) => setComment(e.target.value)}
                  />
                </div>
                <div>
                  <label htmlFor="feedback-email" className="block text-sm font-medium text-gray-700 mb-1">
                    Email <span className="text-gray-400 font-normal">(optional)</span>
                  </label>
                  <input
                    type="email"
                    id="feedback-email"
                    className="w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm p-2 border text-gray-900"
                    placeholder="you@example.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                  />
                </div>
                <button
                  type="submit"
                  disabled={isSubmitting || !comment.trim()}
                  className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isSubmitting ? 'Sending...' : 'Send Feedback'}
                </button>
              </form>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {!isOpen && (
        <motion.button
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          onClick={() => setIsOpen(true)}
          className="px-5 py-2.5 rounded-full border border-indigo-400/30 text-indigo-300 hover:bg-indigo-500/10 hover:text-white hover:border-indigo-400 transition-all duration-200 flex items-center gap-2 text-sm font-medium backdrop-blur-sm"
        >
          <span>💬</span>
          <span>Feedback</span>
        </motion.button>
      )}
    </div>
  );
}
