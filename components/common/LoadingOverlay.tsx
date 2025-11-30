import { motion, AnimatePresence } from 'framer-motion';
import { useEffect, useState } from 'react';

interface LoadingOverlayProps {
  isVisible: boolean;
  messages?: string[];
}

const DEFAULT_MESSAGES = [
  "Analysing content...",
  "Consulting medical guidelines...",
  "Synthesising response...",
  "Applying clinical reasoning...",
  "Formatting output..."
];

export function LoadingOverlay({ 
  isVisible, 
  messages = DEFAULT_MESSAGES 
}: LoadingOverlayProps) {
  const [currentMessageIndex, setCurrentMessageIndex] = useState(0);

  useEffect(() => {
    if (!isVisible) {
      setCurrentMessageIndex(0);
      return;
    }

    const interval = setInterval(() => {
      setCurrentMessageIndex((prev) => (prev + 1) % messages.length);
    }, 2500);

    return () => clearInterval(interval);
  }, [isVisible, messages.length]);

  return (
    <AnimatePresence>
      {isVisible && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm"
        >
          <div className="bg-white rounded-2xl p-8 shadow-2xl max-w-sm w-full mx-4 flex flex-col items-center space-y-6">
            {/* Animated Circle Icon */}
            <div className="relative w-20 h-20">
              <motion.div
                className="absolute inset-0 border-4 border-indigo-100 rounded-full"
                animate={{ scale: [1, 1.1, 1] }}
                transition={{ duration: 2, repeat: Infinity }}
              />
              <motion.div
                className="absolute inset-0 border-4 border-indigo-500 rounded-full border-t-transparent"
                animate={{ rotate: 360 }}
                transition={{ duration: 1.5, repeat: Infinity, ease: "linear" }}
              />
              <div className="absolute inset-0 flex items-center justify-center text-2xl">
                ✨
              </div>
            </div>

            {/* Thinking Text */}
            <div className="text-center space-y-2">
              <h3 className="text-xl font-semibold text-gray-900">
                Thinking...
              </h3>
              <div className="h-6 overflow-hidden">
                <AnimatePresence mode="wait">
                  <motion.p
                    key={currentMessageIndex}
                    initial={{ y: 20, opacity: 0 }}
                    animate={{ y: 0, opacity: 1 }}
                    exit={{ y: -20, opacity: 0 }}
                    transition={{ duration: 0.3 }}
                    className="text-sm text-gray-500 font-medium"
                  >
                    {messages[currentMessageIndex]}
                  </motion.p>
                </AnimatePresence>
              </div>
            </div>

            {/* Progress Bar */}
            <div className="w-full bg-gray-100 h-1.5 rounded-full overflow-hidden">
              <motion.div
                className="h-full bg-indigo-500"
                initial={{ x: "-100%" }}
                animate={{ x: "100%" }}
                transition={{ 
                  duration: 2, 
                  repeat: Infinity, 
                  ease: "easeInOut",
                  repeatDelay: 0.5 
                }}
              />
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
