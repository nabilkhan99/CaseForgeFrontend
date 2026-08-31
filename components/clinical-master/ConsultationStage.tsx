'use client';

import { motion, useReducedMotion } from 'framer-motion';
import type { TranscriptItem } from '@/lib/clinical-master/types';
import ConsultationTimer from './ConsultationTimer';
import LiveTranscript from './LiveTranscript';
import PatientOrb from './PatientOrb';

/**
 * The middle of a live consultation: who is talking, the orb, the clock ring
 * around it, and the transcript when it's open.
 *
 * Shared by the authed session and the free `/try` session for the same reason
 * SessionControls is — the two pages held byte-identical copies of this region
 * and every fix had to be applied twice or one of them silently rotted. There
 * is now one copy, and `/try` cannot fall behind.
 *
 * ## One clock, one ring
 *
 * The ring is drawn by ConsultationTimer itself rather than from a lifted
 * value, so there is still exactly one countdown on the page. The orb is handed
 * to it as `children`: an element created here and passed down as a prop is not
 * rebuilt when ConsultationTimer's own twice-a-second state changes, so the orb
 * sits inside the ring without paying for its ticks.
 */

/** Diameters in px, roomy and with the transcript open. */
const RING = { full: 244, compact: 156 };
const ORB = { full: 196, compact: 124 };

export interface ConsultationStageProps {
  patientInitials: string;
  /** True while the patient is producing audio. */
  isSpeaking: boolean;
  /** Starts the clock. Only ever true here — the connecting gate is upstream. */
  isConnected: boolean;
  /** Stable getter for the patient's 0..1 playback level; see useRealtimeSession. */
  getPatientLevel: () => number | null;
  durationSeconds: number;
  /**
   * Fired when the countdown reaches zero. This does NOT end the consultation —
   * the session hook owns that, a few seconds later, so a sentence still in
   * progress is transcribed rather than lost with the connection.
   */
  onTimeUp: () => void;
  /** True once the countdown has reached zero and the line is winding down. */
  timeUp?: boolean;
  showTranscript: boolean;
  transcript: TranscriptItem[];
}

export default function ConsultationStage({
  patientInitials,
  isSpeaking,
  isConnected,
  getPatientLevel,
  durationSeconds,
  onTimeUp,
  timeUp = false,
  showTranscript,
  transcript,
}: ConsultationStageProps) {
  const shouldReduceMotion = useReducedMotion();

  return (
    <div className="flex-1 flex flex-col items-center justify-center px-6 py-6 gap-5 min-h-0">
      <motion.div
        className="flex-shrink-0 text-[12px] font-semibold text-primary uppercase tracking-[0.1em]"
        animate={isSpeaking && !timeUp ? { opacity: [1, 0.4, 1] } : { opacity: 0.5 }}
        // Reduced motion collapses the pulse to its end value rather than
        // dropping the `animate` prop, which would leave the label stuck at
        // whatever opacity Framer last held. Same reasoning as ArcGauge: the
        // rendered tree never branches on a preference the server can't see.
        transition={
          shouldReduceMotion ? { duration: 0 } : { duration: 1.8, repeat: Infinity }
        }
      >
        {timeUp
          ? "Time's up — finish your sentence"
          : isSpeaking
            ? 'Patient Speaking'
            : 'Listening...'}
      </motion.div>

      <ConsultationTimer
        durationSeconds={durationSeconds}
        autoStart={isConnected}
        onComplete={onTimeUp}
        ring
        ringSize={showTranscript ? RING.compact : RING.full}
        className="flex-shrink-0"
      >
        <PatientOrb
          initials={patientInitials}
          active={isSpeaking}
          getLevel={getPatientLevel}
          size={showTranscript ? ORB.compact : ORB.full}
        />
      </ConsultationTimer>

      {showTranscript && (
        <LiveTranscript items={transcript} className="flex-1 w-full max-w-[480px] min-h-0" />
      )}
    </div>
  );
}
