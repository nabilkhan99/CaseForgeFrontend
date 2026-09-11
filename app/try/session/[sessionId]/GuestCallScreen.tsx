'use client';

import { useRouter } from 'next/navigation';
import { useState, useEffect, useCallback, useRef } from 'react';
import { motion } from 'framer-motion';
import Link from 'next/link';
import { useRealtimeSession } from '@/hooks/useRealtimeSession';
import ConnectingScreen from '@/components/clinical-master/ConnectingScreen';
import ConsultationStage from '@/components/clinical-master/ConsultationStage';
import SessionControls from '@/components/clinical-master/SessionControls';
import ConfirmModal from '@/components/ui/ConfirmModal';
import { micRecoveryHint } from '@/lib/clinical-master/micErrors';
import type { CallBrief } from '@/lib/trial/callBrief';
import { markTrialSessionStarted } from '@/lib/trial/storage';

export interface GuestCallScreenProps {
  sessionId: string;
  stationId: string;
  /** Two lines: who is on the line, and why they came. */
  brief: CallBrief;
  patientName: string;
  patientInitials: string;
  durationSeconds: number;
  /** The optional exam-style reading page, carrying this same session. */
  fullBriefHref: string;
}

/**
 * The one-click consultation.
 *
 * The row and the station are resolved on the server before this paints, so
 * there is nothing to fetch and `connect()` — which asks for the microphone —
 * runs on arrival rather than after two round trips.
 *
 * Three things this screen owns that the authed session does not:
 *
 * - **The brief is on the screen.** Two lines, above the orb. There is no
 *   reading page in the default path, so without them the trainee is talking to
 *   a stranger about nothing.
 * - **The clock starts at the first word, not at connect.** A guest arriving
 *   cold spends the first seconds finding out that the thing is live at all,
 *   and burning their twelve minutes on the WebRTC handshake would be a
 *   consultation they never had. `isConnected` is what ConsultationStage uses
 *   to start the clock, so it is handed the later moment deliberately.
 * - **"End whenever you like."** The offer is a live patient, not an exam, and
 *   the sentence next to the End button says so — with the one caveat that
 *   matters, which is that a full run is what gets marked.
 */
export default function GuestCallScreen({
  sessionId,
  stationId,
  brief,
  patientName,
  patientInitials,
  durationSeconds,
  fullBriefHref,
}: GuestCallScreenProps) {
  const router = useRouter();

  const [isProcessing, setIsProcessing] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [showEndModal, setShowEndModal] = useState(false);
  const [showLeaveModal, setShowLeaveModal] = useState(false);
  const [showTranscript, setShowTranscript] = useState(false);
  const [clockRunning, setClockRunning] = useState(false);
  const isEndingRef = useRef(false);

  // Graceful end (button, timer, or the model's end_consultation tool): the hook
  // persists the transcript + moves the session to 'processing', then this fires.
  const handleEnded = useCallback(() => {
    isEndingRef.current = true;
    setIsProcessing(true);
    router.push(`/try/feedback/${sessionId}`);
  }, [router, sessionId]);

  const { isConnected, isSpeaking, transcript, connect, endConsultation, disconnect, setMicMuted, getPatientLevel, error, errorKind, status } =
    useRealtimeSession({
      sessionId,
      stationId,
      tokenEndpoint: '/api/try/realtime-token',
      onConsultationEnded: handleEnded,
      onError: () => {},
    });

  useEffect(() => {
    // Never auto-reconnect after a connection failure — the error screen owns retry.
    if (!isProcessing && !isEndingRef.current && status === 'disconnected' && !error) connect();
  }, [isProcessing, status, error, connect]);

  // Where this consultation's report will live, so the landing navbar can
  // deep-link a returning visitor at it. The one-click door has no "Begin"
  // button to hang this off, so it happens on arrival.
  useEffect(() => {
    markTrialSessionStarted(sessionId);
  }, [sessionId]);

  // The first word spoken by anyone starts the clock, and nothing stops it.
  useEffect(() => {
    if (!clockRunning && isConnected && (isSpeaking || transcript.length > 0)) {
      setClockRunning(true);
    }
  }, [clockRunning, isConnected, isSpeaking, transcript.length]);

  const handleEndConsultation = useCallback(() => {
    isEndingRef.current = true;
    endConsultation();
  }, [endConsultation]);

  const handleToggleMute = () => {
    const newMuted = !isMuted;
    setIsMuted(newMuted);
    setMicMuted(newMuted);
  };

  // Abandon: tear down without saving or generating feedback.
  const handleLeaveWithoutFinishing = useCallback(() => {
    disconnect();
    router.push('/');
  }, [disconnect, router]);

  // The reading page is the same consultation, not a new one — it is handed
  // this session id, so taking the detour does not spend a second of the
  // three-a-day guest allowance.
  const handleReadFullBrief = useCallback(() => {
    disconnect();
    router.push(fullBriefHref);
  }, [disconnect, router, fullBriefHref]);

  if (isProcessing) {
    return (
      <div className="min-h-[100dvh] bg-surface flex flex-col items-center justify-center gap-6">
        <motion.div
          className="w-12 h-12 rounded-full border-2 border-primary border-t-transparent"
          animate={{ rotate: 360 }}
          transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
        />
        <div className="text-center">
          <h3 className="text-[18px] font-semibold text-heading mb-1">Finalising Consultation</h3>
          <p className="text-[14px] text-muted">Generating your feedback...</p>
        </div>
      </div>
    );
  }

  // A refused microphone is not a connection problem, and "Try again" is the
  // one thing that cannot fix it: the browser remembers the refusal (iOS Safari
  // until the site's settings are reset), so connect() would re-throw the same
  // error forever — and on this lane each attempt that got as far as the mint
  // also spent the guest cooldown, leaving a visitor stuck behind their own
  // 2-minute refusal. The mint now happens after the microphone, and this
  // screen says which permission to change and where, exactly as the signed-in
  // session screen has done since the mic errors were classified.
  if (error && !isConnected) {
    const micProblem = errorKind !== null && errorKind !== 'connection';
    const hint = micRecoveryHint(
      errorKind ?? 'connection',
      typeof navigator !== 'undefined' ? navigator.userAgent : '',
    );
    const title =
      errorKind === 'mic_denied' ? 'Microphone blocked'
      : errorKind === 'mic_missing' ? 'No microphone found'
      : errorKind === 'mic_busy' ? 'Microphone in use'
      : errorKind === 'mic_unsupported' ? "This browser can't capture audio"
      : 'Connection problem';
    return (
      <div className="min-h-[100dvh] bg-surface flex items-center justify-center px-6">
        <motion.div
          className="max-w-md text-center"
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <div className="mx-auto mb-5 flex h-12 w-12 items-center justify-center rounded-full bg-red-50 border border-red-200">
            <svg width="18" height="18" viewBox="0 0 16 16" fill="none" className="text-danger">
              <path d="M8 5v4M8 11.5v.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
              <circle cx="8" cy="8" r="6.5" stroke="currentColor" strokeWidth="1.5" />
            </svg>
          </div>
          <h3 className="text-[18px] font-semibold text-heading mb-2">{title}</h3>
          <p className="text-[14px] leading-[1.65] text-muted mb-2">
            {micProblem ? 'The consultation needs your microphone to hear you.' : error}
          </p>
          {micProblem && <p className="text-[13px] leading-[1.65] text-muted mb-6">{hint}</p>}
          <div className={`flex flex-col items-center gap-3 ${micProblem ? '' : 'mt-4'}`}>
            <button
              onClick={() => (micProblem ? window.location.reload() : connect())}
              className="min-h-[44px] rounded-xl px-6 py-3 text-[14px] font-semibold text-white cursor-pointer"
              style={{ background: 'linear-gradient(135deg, #B45309, #D97706)', boxShadow: '0 4px 12px rgba(180,83,9,0.2)' }}
            >
              {micProblem ? 'Reload this page' : 'Try again'}
            </button>
            <Link href="/" className="text-[13px] font-semibold text-primary hover:underline">
              Back to Fourteen Fisherman
            </Link>
          </div>
        </motion.div>
      </div>
    );
  }

  // Guests used to sit in front of an idle orb and a static full clock for the
  // whole handshake, with nothing saying a call was being placed. The gate stays
  // on "not connected", which also covers `disconnected`; only the pulse inside
  // it distinguishes a handshake actually in progress.
  if (status !== 'connected') {
    return (
      <ConnectingScreen
        patientName={patientName}
        // The brief, during the handshake rather than at the same moment the
        // patient starts talking. This door has no reading page in front of it,
        // so these two lines used to arrive with the first "Hello".
        brief={brief}
        connecting={status === 'connecting'}
        onCancel={handleLeaveWithoutFinishing}
      />
    );
  }

  return (
    <div className="min-h-[100dvh] bg-surface font-sans flex flex-col">
      {/* Top bar */}
      {/* viewportFit is 'cover', so the timer and Exit would sit under the notch
          in landscape and in a home-screen launch without these insets. */}
      <div className="min-h-14 flex items-center justify-between border-b border-black/[0.06] bg-surface/80 backdrop-blur-xl flex-shrink-0 pt-[env(safe-area-inset-top)] pl-[max(1rem,env(safe-area-inset-left))] pr-[max(1rem,env(safe-area-inset-right))] sm:pl-[max(1.5rem,env(safe-area-inset-left))] sm:pr-[max(1.5rem,env(safe-area-inset-right))]">
        <button
          onClick={() => setShowLeaveModal(true)}
          className="min-h-[44px] min-w-[44px] text-[13px] text-muted hover:text-heading transition-colors flex items-center gap-1 flex-shrink-0 cursor-pointer"
        >
          &larr; <span className="hidden sm:inline">Exit</span>
        </button>
        <span className="truncate px-2 text-[13px] font-semibold text-heading">{patientName}</span>
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1.5">
            <motion.div
              className="w-1.5 h-1.5 rounded-full bg-success"
              animate={{ opacity: [1, 0.3, 1] }}
              transition={{ duration: 1.8, repeat: Infinity }}
            />
            <span className="text-[10px] font-semibold text-success uppercase">Live</span>
          </div>
        </div>
      </div>

      {/* The brief, on the screen. Two lines and a quiet way to the real one. */}
      <div className="flex-shrink-0 border-b border-black/[0.05] px-5 py-3 sm:px-7">
        <div className="mx-auto flex max-w-[560px] flex-col gap-1">
          <p className="text-[14px] font-semibold leading-snug text-heading">{brief.who}</p>
          {brief.complaint && (
            <p className="text-[13px] leading-snug text-muted">{brief.complaint}</p>
          )}
          <button
            type="button"
            onClick={handleReadFullBrief}
            className="mt-1 self-start text-[12px] text-muted underline decoration-black/20 underline-offset-2 transition-colors hover:text-heading cursor-pointer"
          >
            Read the full brief first
          </button>
        </div>
      </div>

      <ConsultationStage
        patientInitials={patientInitials}
        isSpeaking={isSpeaking}
        // Deliberately the clock's start, not the connection's: see the header.
        isConnected={clockRunning}
        getPatientLevel={getPatientLevel}
        durationSeconds={durationSeconds}
        onTimeUp={handleEndConsultation}
        showTranscript={showTranscript}
        transcript={transcript}
      />

      <p className="flex-shrink-0 px-6 pb-1 text-center text-[12px] leading-snug text-muted">
        End whenever you like. A full run gets a marked report.
      </p>

      <SessionControls
        isConnected={isConnected}
        isMuted={isMuted}
        onToggleMute={handleToggleMute}
        showTranscript={showTranscript}
        onToggleTranscript={() => setShowTranscript(prev => !prev)}
        onEnd={() => setShowEndModal(true)}
      />

      <ConfirmModal
        open={showEndModal}
        title="End Consultation"
        message="Are you sure you want to end this consultation? Your feedback will be generated based on the conversation so far."
        confirmLabel="End Now"
        cancelLabel="Continue"
        variant="danger"
        onConfirm={() => { setShowEndModal(false); handleEndConsultation(); }}
        onCancel={() => setShowEndModal(false)}
      />

      <ConfirmModal
        open={showLeaveModal}
        title="Leave Consultation"
        message="Leave without finishing? Your progress won't be saved."
        confirmLabel="Leave"
        cancelLabel="Stay"
        variant="danger"
        onConfirm={() => { setShowLeaveModal(false); handleLeaveWithoutFinishing(); }}
        onCancel={() => setShowLeaveModal(false)}
      />
    </div>
  );
}
