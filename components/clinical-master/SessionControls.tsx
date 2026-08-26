'use client';

import { motion } from 'framer-motion';

interface SessionControlsProps {
  isConnected: boolean;
  isMuted: boolean;
  onToggleMute: () => void;
  showTranscript: boolean;
  onToggleTranscript: () => void;
  onEnd: () => void;
}

/**
 * The bottom control bar of a live consultation, shared by the authed session
 * and the free `/try` session so the two can't drift apart again.
 *
 * Two things this fixes over the hand-rolled copies it replaces:
 * - The big amber circle was a decorative `motion.div` with no handler, while
 *   the real mute control was a small grey outline button two slots to its
 *   left. On a phone the visual hierarchy says "tap the orange circle", so
 *   every first-timer did, nothing happened, and they concluded the microphone
 *   was broken. There is now one microphone control: the big one.
 * - Neither icon button had an accessible name; the transcript toggle was
 *   labelled only by `title`, which touch never surfaces.
 */
export default function SessionControls({
  isConnected,
  isMuted,
  onToggleMute,
  showTranscript,
  onToggleTranscript,
  onEnd,
}: SessionControlsProps) {
  return (
    <div className="min-h-[88px] flex items-center justify-center gap-3 sm:gap-4 border-t border-hairline flex-shrink-0 py-3 pl-[max(1rem,env(safe-area-inset-left))] pr-[max(1rem,env(safe-area-inset-right))] pb-[max(0.75rem,env(safe-area-inset-bottom))] sm:pl-[max(1.5rem,env(safe-area-inset-left))] sm:pr-[max(1.5rem,env(safe-area-inset-right))]">
      <button
        onClick={onToggleTranscript}
        aria-label={showTranscript ? 'Show waveform' : 'Show transcript'}
        aria-pressed={showTranscript}
        title={showTranscript ? 'Show waveform' : 'Show transcript'}
        className={`w-11 h-11 rounded-full flex items-center justify-center border cursor-pointer hover:bg-black/[0.02] transition-colors flex-shrink-0 ${
          showTranscript ? 'border-primary/30 bg-primary/5' : 'border-defined'
        }`}
      >
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none" className={showTranscript ? 'text-primary' : 'text-muted'}>
          <path d="M2 4h12M2 8h8M2 12h10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
        </svg>
      </button>

      <motion.button
        type="button"
        onClick={onToggleMute}
        disabled={!isConnected}
        aria-pressed={isMuted}
        aria-label={isMuted ? 'Unmute microphone' : 'Mute microphone'}
        className="flex flex-col items-center justify-center gap-1 cursor-pointer disabled:opacity-40 flex-shrink-0"
        whileTap={isConnected ? { scale: 0.94 } : {}}
      >
        <motion.span
          className={`w-14 h-14 rounded-full flex items-center justify-center transition-colors ${
            isMuted ? 'border-2 border-danger/40 bg-red-50' : ''
          }`}
          style={
            isMuted
              ? undefined
              : { background: 'linear-gradient(135deg, #B45309, #D97706)', boxShadow: '0 4px 16px rgba(180,83,9,0.25)' }
          }
          // The muted branch clears the shadow explicitly rather than passing
          // `{}` — Framer holds the last animated value, which left an amber
          // glow burning behind the red muted circle.
          animate={
            isConnected && !isMuted
              ? { boxShadow: ['0 4px 16px rgba(180,83,9,0.25)', '0 6px 20px rgba(180,83,9,0.35)', '0 4px 16px rgba(180,83,9,0.25)'] }
              : { boxShadow: '0 0 0 0 rgba(180,83,9,0)' }
          }
          transition={isConnected && !isMuted ? { duration: 2, repeat: Infinity } : { duration: 0.2 }}
        >
          <svg width="18" height="18" viewBox="0 0 14 14" fill="none" className={isMuted ? 'text-danger' : ''}>
            <path
              d="M7 1C5.62 1 4.5 2.12 4.5 3.5v3.5c0 1.38 1.12 2.5 2.5 2.5s2.5-1.12 2.5-2.5V3.5C9.5 2.12 8.38 1 7 1z"
              fill={isMuted ? 'currentColor' : 'white'}
            />
            <path
              d="M3 6.5v.5a4 4 0 0 0 8 0v-.5M7 11v2M5 13h4"
              stroke={isMuted ? 'currentColor' : 'white'}
              strokeWidth="1.2"
              strokeLinecap="round"
            />
            {isMuted && <path d="M1.5 1.5l11 11" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />}
          </svg>
        </motion.span>
        <span className={`text-[10px] font-medium uppercase tracking-[0.08em] ${isMuted ? 'text-danger' : 'text-muted'}`}>
          {isMuted ? 'Muted' : 'Mute'}
        </span>
      </motion.button>

      <button
        onClick={onEnd}
        className="min-h-[44px] px-3 sm:px-5 py-2.5 rounded-xl text-[13px] font-medium text-danger bg-red-50 border border-red-200 hover:bg-red-100 transition-colors cursor-pointer whitespace-nowrap flex-shrink-0"
      >
        <span className="hidden sm:inline">End Consultation</span>
        <span className="sm:hidden">End</span>
      </button>
    </div>
  );
}
