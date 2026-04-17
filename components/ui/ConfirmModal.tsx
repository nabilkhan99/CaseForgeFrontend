'use client';

import { motion, AnimatePresence } from 'framer-motion';
import PrimaryButton from './PrimaryButton';
import SecondaryButton from './SecondaryButton';

interface ConfirmModalProps {
  open: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: 'danger' | 'default';
  onConfirm: () => void;
  onCancel: () => void;
}

export default function ConfirmModal({
  open,
  title,
  message,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  variant = 'default',
  onConfirm,
  onCancel,
}: ConfirmModalProps) {
  return (
    <AnimatePresence>
      {open && (
        <>
          {/* Backdrop */}
          <motion.div
            className="fixed inset-0 bg-black/20 backdrop-blur-sm z-50"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onCancel}
          />

          {/* Modal — slides up from bottom on mobile, centers on desktop */}
          <motion.div
            className="fixed inset-x-0 bottom-0 sm:inset-0 z-50 flex items-end sm:items-center sm:justify-center p-4 pointer-events-none"
          >
            <motion.div
              className="w-full sm:max-w-sm pointer-events-auto"
              initial={{ opacity: 0, y: 48 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 48 }}
              transition={{ type: 'spring', stiffness: 200, damping: 24 }}
            >
              <div className="rounded-2xl bg-surface-raised border border-black/[0.06] p-6 shadow-elevation-4 pb-[max(1.5rem,env(safe-area-inset-bottom))]">
                <h3 className="text-[18px] font-semibold text-heading mb-2">{title}</h3>
                <p className="text-[14px] text-muted mb-6 leading-relaxed">{message}</p>
                <div className="flex flex-col-reverse sm:flex-row gap-3 sm:justify-end">
                  <SecondaryButton onClick={onCancel} size="sm">
                    {cancelLabel}
                  </SecondaryButton>
                  {variant === 'danger' ? (
                    <SecondaryButton onClick={onConfirm} variant="danger" size="sm">
                      {confirmLabel}
                    </SecondaryButton>
                  ) : (
                    <PrimaryButton onClick={onConfirm} size="sm">
                      {confirmLabel}
                    </PrimaryButton>
                  )}
                </div>
              </div>
            </motion.div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
