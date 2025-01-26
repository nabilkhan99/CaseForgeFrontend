import { motion, AnimatePresence } from 'framer-motion';

interface ImprovementModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (prompt: string) => Promise<void>;
  isLoading: boolean;
}

export function ImprovementModal({ isOpen, onClose, onSubmit, isLoading }: ImprovementModalProps) {
  const [prompt, setPrompt] = useState('');
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async () => {
    try {
      await onSubmit(prompt);
      setPrompt('');
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50"
        >
          <motion.div
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.95, opacity: 0 }}
            className="w-full max-w-lg bg-neutral-900 rounded-xl p-6 space-y-4 border border-white/10"
          >
            <div className="flex justify-between items-center">
              <h2 className="text-xl font-medium text-white">Improve Review</h2>
              <button onClick={onClose} className="text-white/60 hover:text-white">
                ✕
              </button>
            </div>
            
            <motion.div
              initial={{ x: -20 }}
              animate={{ x: 0 }}
              transition={{ delay: 0.2 }}
              className="ai-glow w-full px-2 sm:px-0"
            >
              <CapabilitySelect
                selectedCapabilities={selectedCapabilities}
                onChange={setSelectedCapabilities}
                disabled={isLoading}
              />
            </motion.div>
            
            <textarea
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder="Enter improvement instructions..."
              className="glass-input w-full h-32"
              disabled={isLoading}
            />
            
            {error && <div className="text-red-500 text-sm">{error}</div>}
            
            <div className="flex justify-end gap-3">
              <button
                onClick={onClose}
                className="button-secondary px-4 py-2"
                disabled={isLoading}
              >
                Cancel
              </button>
              <button
                onClick={handleSubmit}
                disabled={isLoading || !prompt.trim()}
                className="primary-button px-4 py-2"
              >
                {isLoading ? (
                  <span className="flex items-center gap-2">
                    <span className="animate-pulse">⚡</span>
                    Improving...
                  </span>
                ) : (
                  <span className="flex items-center gap-2">
                    <span>✨</span>
                    Apply Improvements
                  </span>
                )}
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
} 