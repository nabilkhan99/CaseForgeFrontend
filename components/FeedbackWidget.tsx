'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import FeedbackModal from '@/components/ui/FeedbackModal';

export function FeedbackWidget() {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <>
      <div className="w-full flex flex-col items-end py-12 px-6 mt-auto z-40 relative">
        <motion.button
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          onClick={() => setIsOpen(true)}
          className="px-5 py-2.5 min-h-[44px] rounded-full border border-primary/20 text-primary bg-white/70 hover:bg-white hover:border-primary/40 transition-all duration-200 flex items-center gap-2 text-sm font-medium backdrop-blur-sm"
        >
          Feedback
        </motion.button>
      </div>

      <FeedbackModal
        isOpen={isOpen}
        onClose={() => setIsOpen(false)}
        sourceType="portfolio"
      />
    </>
  );
}
