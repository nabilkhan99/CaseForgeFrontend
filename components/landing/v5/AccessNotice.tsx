'use client';

import { useSearchParams } from 'next/navigation';
import { motion } from 'framer-motion';

/**
 * Why a signed-in user was sent here. The gate (middleware and the session
 * APIs) redirects to /pricing?renew=true when access has lapsed and
 * ?upgrade=true when there was never a plan — without this the page just
 * reads as marketing and the bounce looks like a bug.
 */
export default function AccessNotice() {
  const params = useSearchParams();
  const renew = params.get('renew') === 'true';
  const upgrade = params.get('upgrade') === 'true';

  if (!renew && !upgrade) return null;

  return (
    <section className="px-5 sm:px-8">
      <motion.p
        initial={{ opacity: 0, y: -6 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="mx-auto max-w-3xl rounded-2xl bg-[#FDF0DC] px-5 py-4 text-center text-xs leading-relaxed text-[#854F0B] sm:text-sm"
      >
        {renew
          ? 'Your access has ended. Pick a plan to continue — your history and feedback stay where they are.'
          : 'You need a plan to start consultations.'}
      </motion.p>
    </section>
  );
}
