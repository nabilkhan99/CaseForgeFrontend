'use client';

import { motion, AnimatePresence } from 'framer-motion';

interface InterruptButtonProps {
  /** Show the control (the patient is audibly speaking). */
  visible: boolean;
  onInterrupt: () => void;
}

/**
 * Pill control to cut the patient off mid-speech without ending the session.
 * Rendered in a fixed-height slot so the voice area doesn't jump as it
 * appears/disappears with the patient's speech.
 */
export default function InterruptButton({ visible, onInterrupt }: InterruptButtonProps) {
  return (
    <div className="h-11 flex items-center justify-center flex-shrink-0">
      <AnimatePresence>
        {visible && (
          <motion.button
            initial={{ opacity: 0, y: 6, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 6, scale: 0.96 }}
            transition={{ duration: 0.18, ease: 'easeOut' }}
            onClick={onInterrupt}
            aria-label="Interrupt the patient"
            className="min-h-[44px] px-5 rounded-full flex items-center gap-2.5 text-[13px] font-medium text-primary bg-primary/5 border border-primary/25 hover:bg-primary/10 transition-colors cursor-pointer"
          >
            <span className="relative flex items-center justify-center w-4 h-4">
              <motion.span
                className="absolute inset-0 rounded-full border border-primary/40"
                animate={{ scale: [1, 1.4], opacity: [0.6, 0] }}
                transition={{ duration: 1.4, repeat: Infinity, ease: 'easeOut' }}
              />
              <span className="w-2 h-2 rounded-[2px] bg-primary" />
            </span>
            Interrupt patient
          </motion.button>
        )}
      </AnimatePresence>
    </div>
  );
}
