'use client';

import { useParams, useRouter, useSearchParams } from 'next/navigation';
import { useState, useEffect, useCallback, useRef, Suspense } from 'react';
import { motion } from 'framer-motion';
import Link from 'next/link';
import { useRealtimeSession } from '@/hooks/useRealtimeSession';
import { micRecoveryHint } from '@/lib/clinical-master/micErrors';
import { createClient } from '@/lib/supabase/client';
import ConnectingScreen from '@/components/clinical-master/ConnectingScreen';
import ConsultationStage from '@/components/clinical-master/ConsultationStage';
import SessionControls from '@/components/clinical-master/SessionControls';
import ConfirmModal from '@/components/ui/ConfirmModal';

interface StationData {
  id: string;
  title: string;
  patient_name: string;
  consultation_duration_seconds: number;
}

function LiveConsultationContent() {
  const params = useParams();
  const router = useRouter();
  const searchParams = useSearchParams();
  const sessionId = params.sessionId as string;
  const stationId = searchParams.get('stationId');
  const from = searchParams.get('from');

  const [station, setStation] = useState<StationData | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [showEndModal, setShowEndModal] = useState(false);
  const [showLeaveModal, setShowLeaveModal] = useState(false);
  const [userId, setUserId] = useState<string | undefined>(undefined);
  const [showTranscript, setShowTranscript] = useState(false);
  const isEndingRef = useRef(false);

  useEffect(() => {
    async function fetchUser() {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (user) setUserId(user.id);
    }
    fetchUser();
  }, []);

  useEffect(() => {
    async function fetchStation() {
      if (!stationId) return;
      const supabase = createClient();
      const { data } = await supabase
        .from('stations')
        .select('id, title, patient_name, consultation_duration_seconds')
        .eq('id', stationId)
        .single();
      if (data) setStation(data);
    }
    fetchStation();
  }, [stationId]);

  // Graceful end (button, timer, or the model's end_consultation tool): the hook
  // persists the transcript + moves the session to 'processing', then this fires.
  const handleEnded = useCallback(() => {
    isEndingRef.current = true;
    setIsProcessing(true);
    const feedbackUrl = from
      ? `/clinical-master/feedback/${sessionId}?from=${from}`
      : `/clinical-master/feedback/${sessionId}`;
    router.push(feedbackUrl);
  }, [router, sessionId, from]);

  const { isConnected, isSpeaking, transcript, connect, endConsultation, disconnect, setMicMuted, getPatientLevel, error, errorKind, status } =
    useRealtimeSession({
      sessionId,
      stationId: stationId || undefined,
      userId,
      onConsultationEnded: handleEnded,
      onError: () => {},
    });

  useEffect(() => {
    // Never auto-reconnect after a connection failure — the error screen owns retry.
    if (station && !isProcessing && !isEndingRef.current && status === 'disconnected' && !error) connect();
  }, [station, isProcessing, status, error, connect]);

  const handleEndConsultation = useCallback(() => {
    isEndingRef.current = true;
    endConsultation();
  }, [endConsultation]);

  const handleToggleMute = () => {
    const newMuted = !isMuted;
    setIsMuted(newMuted);
    setMicMuted(newMuted);
  };

  // Abandon: tear down without saving or generating feedback, and record it —
  // otherwise the row stays 'live' and haunts the dashboard as "Unfinished".
  const markAbandoned = useCallback(() => {
    if (isEndingRef.current) return;
    const body = JSON.stringify({ sessionId });
    if (typeof navigator !== 'undefined' && navigator.sendBeacon) {
      navigator.sendBeacon('/api/clinical-master/abandon-session', new Blob([body], { type: 'text/plain' }));
    } else {
      fetch('/api/clinical-master/abandon-session', { method: 'POST', body, keepalive: true }).catch(() => {});
    }
  }, [sessionId]);

  const handleLeaveWithoutFinishing = useCallback(() => {
    disconnect();
    markAbandoned();
    router.push('/dashboard/library');
  }, [disconnect, markAbandoned, router]);

  // Closing the tab or navigating away mid-consultation is also an abandon.
  useEffect(() => {
    const onHide = () => { if (!isEndingRef.current && !isProcessing) markAbandoned(); };
    window.addEventListener('pagehide', onHide);
    return () => window.removeEventListener('pagehide', onHide);
  }, [markAbandoned, isProcessing]);

  const patientInitials = station
    ? station.patient_name.split(' ').map(n => n[0]).join('').slice(0, 2)
    : '??';

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

  if (error && !isConnected) {
    const micProblem = errorKind !== null && errorKind !== 'connection';
    const hint = micRecoveryHint(errorKind ?? 'connection', typeof navigator !== 'undefined' ? navigator.userAgent : '');
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
          <p className="text-[13px] leading-[1.65] text-muted mb-6">{hint}</p>
          <div className="flex flex-col items-center gap-3">
            {/* A denied mic stays denied until the site setting changes, so
                re-running connect() would loop forever. Reload re-prompts
                once the permission has been reset. */}
            <button
              onClick={() => (micProblem ? window.location.reload() : connect())}
              className="min-h-[44px] rounded-xl px-6 py-3 text-[14px] font-semibold text-white cursor-pointer"
              style={{ background: 'linear-gradient(135deg, #B45309, #D97706)', boxShadow: '0 4px 12px rgba(180,83,9,0.2)' }}
            >
              {micProblem ? "I've fixed it — reload" : 'Try again'}
            </button>
            <Link href="/dashboard/library" className="text-[13px] font-semibold text-primary hover:underline">
              Back to library
            </Link>
          </div>
        </motion.div>
      </div>
    );
  }

  if (!stationId) {
    return (
      <div className="min-h-[100dvh] bg-surface flex items-center justify-center">
        <div className="text-center">
          <p className="text-muted mb-4">Missing station information</p>
          <Link href="/dashboard/library" className="text-primary hover:underline text-sm">Back to Library</Link>
        </div>
      </div>
    );
  }

  // Don't paint the live consultation (orb, "Listening…", running clock) while
  // the token, microphone and WebRTC handshake are still in flight —
  // first-timers were talking into a dead line for up to ten seconds. The gate
  // stays on "not connected", which also covers `disconnected`; only the pulse
  // inside it distinguishes a handshake actually in progress.
  if (status !== 'connected' && !isProcessing) {
    return (
      <ConnectingScreen
        patientName={station?.patient_name}
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
        {/* The clock moved to the ring around the orb — one clock, drawn once.
            This slot keeps the bar's three-up balance and names who is on the
            line, which used to be repeated under the avatar. */}
        <span className="truncate px-2 text-[13px] font-semibold text-heading">
          {station?.patient_name || 'Patient'}
        </span>
        <div className="flex items-center gap-2">
          {isConnected && (
            <div className="flex items-center gap-1.5">
              <motion.div
                className="w-1.5 h-1.5 rounded-full bg-success"
                animate={{ opacity: [1, 0.3, 1] }}
                transition={{ duration: 1.8, repeat: Infinity }}
              />
              <span className="text-[10px] font-semibold text-success uppercase">Live</span>
            </div>
          )}
          {error && <span className="text-[11px] text-danger">{error}</span>}
        </div>
      </div>

      {/* Main voice area — shared with /try so the two cannot drift. Every
          station in the library is 720s; the fallback here says 720 while the
          token routes say 480, which is harmless only while every row has a
          duration. */}
      <ConsultationStage
        patientInitials={patientInitials}
        isSpeaking={isSpeaking}
        isConnected={isConnected}
        getPatientLevel={getPatientLevel}
        durationSeconds={station?.consultation_duration_seconds || 720}
        onTimeUp={handleEndConsultation}
        showTranscript={showTranscript}
        transcript={transcript}
      />

      {/* Controls bar */}
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

export default function LiveConsultationPage() {
  return (
    <Suspense fallback={<div className="min-h-[100dvh] bg-surface flex items-center justify-center"><div className="text-muted text-sm">Loading...</div></div>}>
      <LiveConsultationContent />
    </Suspense>
  );
}
