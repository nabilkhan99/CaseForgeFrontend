'use client';

import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';

/**
 * Pre-consultation audio guidance shown above the "Begin Consultation" CTA.
 *
 * Also carries the recording notice. This is the last screen before the mic
 * opens, so it is where the user has to be told the consultation is recorded —
 * stated plainly, before they consent by starting.
 *
 * Always recommends headphones (they remove the speaker→mic echo path that
 * makes the server VAD cut the patient off mid-sentence). On Firefox it also
 * recommends switching browser: Firefox's echo cancellation is weak and the
 * Realtime WebRTC transport has known Firefox-only session drops, so voice
 * quality there is unreliable regardless of what we do client-side.
 */
export default function AudioSetupNotice() {
  const [isFirefox, setIsFirefox] = useState(false);

  useEffect(() => {
    // UA sniff after mount — avoids a server/client hydration mismatch.
    setIsFirefox(/firefox/i.test(navigator.userAgent));
  }, []);

  return (
    <div className="mb-4 space-y-2">
      {isFirefox && (
        <motion.div
          initial={{ opacity: 0, y: -4 }}
          animate={{ opacity: 1, y: 0 }}
          className="px-4 py-3 rounded-lg text-[13px] leading-relaxed"
          style={{
            background: 'rgba(180,83,9,0.06)',
            border: '1px solid rgba(180,83,9,0.18)',
            color: '#92400E',
          }}
        >
          <span className="font-semibold">Firefox detected.</span> Voice
          consultations are unreliable in Firefox — the patient&apos;s audio can
          cut out mid-sentence. For the best experience, use{' '}
          <span className="font-semibold">Chrome, Safari or Edge</span>.
        </motion.div>
      )}
      <p className="flex items-center justify-center gap-1.5 text-[12px] text-muted">
        <svg
          className="w-3.5 h-3.5 shrink-0"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <path d="M3 14v-3a9 9 0 0 1 18 0v3" />
          <path d="M3 14a2 2 0 0 1 2-2h1a2 2 0 0 1 2 2v3a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-3z" />
          <path d="M21 14a2 2 0 0 0-2-2h-1a2 2 0 0 0-2 2v3a2 2 0 0 0 2 2h1a2 2 0 0 0 2-2v-3z" />
        </svg>
        Headphones recommended — they stop the patient&apos;s voice being picked
        up by your mic.
      </p>
      <p className="flex items-center justify-center gap-1.5 text-center text-[12px] text-muted">
        <svg
          className="w-3.5 h-3.5 shrink-0"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <circle cx="12" cy="12" r="9" />
          <circle cx="12" cy="12" r="3.5" fill="currentColor" stroke="none" />
        </svg>
        This consultation is recorded so you can play it back with your feedback.
      </p>
    </div>
  );
}
