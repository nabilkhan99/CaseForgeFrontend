'use client';

import { useParams, useRouter, useSearchParams } from 'next/navigation';
import { useState, useEffect, useCallback, Suspense } from 'react';
import { motion } from 'framer-motion';
import Link from 'next/link';
import { useLiveKitSession } from '@/hooks/useLiveKitSession';
import ConsultationTimer from '@/components/clinical-master/ConsultationTimer';
import ConfirmModal from '@/components/ui/ConfirmModal';

interface StationData {
  id: string;
  title: string;
  patient_name: string;
  patient_age: number;
  consultation_duration_seconds: number;
}

function AudioVisualizer({ active }: { active: boolean }) {
  const barCount = 48;
  return (
    <div className="flex items-center justify-center gap-[3px] h-20 w-full max-w-[400px] mx-auto">
      {Array.from({ length: barCount }).map((_, i) => {
        const center = barCount / 2;
        const dist = Math.abs(i - center) / center;
        const maxH = active ? 100 - dist * 55 : 15;
        return (
          <motion.div
            key={i}
            className="rounded-full"
            style={{
              width: '3px',
              background: active
                ? `linear-gradient(180deg, rgba(180,83,9,${0.8 - dist * 0.4}) 0%, rgba(245,158,11,${0.2 + (1 - dist) * 0.3}) 100%)`
                : 'rgba(0,0,0,0.08)',
            }}
            animate={{
              height: active
                ? [
                    `${10 + Math.sin(i * 0.5) * 6}%`,
                    `${maxH * (0.3 + Math.sin(i * 0.35 + 1) * 0.7)}%`,
                    `${10 + Math.sin(i * 0.5 + 2) * 6}%`,
                  ]
                : ['15%'],
            }}
            transition={
              active
                ? { duration: 0.8 + (i % 6) * 0.1, repeat: Infinity, delay: (i % 8) * 0.05, ease: 'easeInOut' }
                : { duration: 0.3 }
            }
          />
        );
      })}
    </div>
  );
}

function GuestLiveConsultationContent() {
  const params = useParams();
  const router = useRouter();
  const searchParams = useSearchParams();
  const sessionId = params.sessionId as string;
  const stationId = searchParams.get('stationId');

  const [station, setStation] = useState<StationData | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [showEndModal, setShowEndModal] = useState(false);

  useEffect(() => {
    async function fetchStation() {
      if (!stationId) return;

      try {
        const res = await fetch('/api/try/free-cases');
        if (!res.ok) return;
        const data = await res.json();
        const found = (data.stations || []).find((s: { id: string }) => s.id === stationId);
        if (found) {
          setStation({
            id: found.id,
            title: found.title,
            patient_name: found.patient_name,
            patient_age: found.patient_age,
            consultation_duration_seconds: found.consultation_duration_seconds || 300,
          });
        }
      } catch {
        // Handle silently
      }
    }

    fetchStation();
  }, [stationId]);

  const { isConnected, isSpeaking, connect, endConsultation, setMicMuted, error, status } =
    useLiveKitSession({
      sessionId,
      stationId: stationId || undefined,
      tokenEndpoint: '/api/try/livekit-token',
      onSessionStarted: () => {},
      onConsultationEnded: () => {},
      onError: () => {},
    });

  useEffect(() => {
    if (station && status === 'disconnected') connect();
  }, [station, status, connect]);

  const finishConsultation = useCallback(async () => {
    setIsProcessing(true);
    try {
      await endConsultation();
    } catch {
      // Continue to feedback even if disconnect fails
    }
    router.push(`/try/feedback/${sessionId}`);
  }, [endConsultation, router, sessionId]);

  const handleToggleMute = () => {
    const newMuted = !isMuted;
    setIsMuted(newMuted);
    setMicMuted(newMuted);
  };

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

  if (!stationId) {
    return (
      <div className="min-h-[100dvh] bg-surface flex items-center justify-center">
        <div className="text-center">
          <p className="text-muted mb-4">Missing station information</p>
          <Link href="/try" className="text-primary hover:underline text-sm">Back to Cases</Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-[100dvh] bg-surface font-sans flex flex-col">
      {/* Top bar */}
      <div className="h-12 flex items-center justify-between px-6 border-b border-black/[0.06] bg-surface/80 backdrop-blur-xl flex-shrink-0">
        <div className="hidden sm:block text-[13px] text-muted truncate max-w-[200px]">
          {station?.patient_name || 'Loading...'}
        </div>
        <ConsultationTimer
          durationSeconds={station?.consultation_duration_seconds || 300}
          autoStart={isConnected}
          onComplete={finishConsultation}
        />
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

      {/* Main voice area */}
      <div className="flex-1 flex flex-col items-center justify-center px-6 py-12 gap-8">
        {/* Patient avatar with pulse */}
        <motion.div className="relative" initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }}>
          <motion.div
            className="absolute rounded-full"
            style={{ inset: '-16px', border: '1.5px solid rgba(180,83,9,0.1)' }}
            animate={isSpeaking ? { scale: [1, 1.25, 1], opacity: [0.4, 0, 0.4] } : { scale: 1, opacity: 0 }}
            transition={{ duration: 2, repeat: Infinity }}
          />
          <motion.div
            className="absolute rounded-full"
            style={{ inset: '-8px', border: '2px solid rgba(180,83,9,0.15)' }}
            animate={isSpeaking ? { scale: [1, 1.15, 1], opacity: [0.6, 0, 0.6] } : { scale: 1, opacity: 0 }}
            transition={{ duration: 1.5, repeat: Infinity, delay: 0.2 }}
          />
          <div
            className="w-20 h-20 rounded-full flex items-center justify-center text-white text-[24px] font-semibold relative"
            style={{ background: 'linear-gradient(135deg, #F59E0B, #B45309)', boxShadow: '0 8px 32px rgba(180,83,9,0.3)' }}
          >
            {patientInitials}
          </div>
        </motion.div>

        {/* Speaking indicator */}
        <div className="text-center">
          <motion.div
            className="text-[12px] font-semibold text-primary uppercase tracking-[0.1em] mb-0.5"
            animate={isSpeaking ? { opacity: [1, 0.4, 1] } : { opacity: 0.5 }}
            transition={{ duration: 1.8, repeat: Infinity }}
          >
            {isSpeaking ? 'Patient Speaking' : 'Listening...'}
          </motion.div>
          <div className="text-[12px] text-muted">
            {station?.patient_name || 'Patient'}
          </div>
        </div>

        {/* Waveform */}
        <AudioVisualizer active={isSpeaking} />
      </div>

      {/* Controls bar */}
      <div className="min-h-[80px] flex items-center justify-center gap-6 px-6 border-t border-black/[0.06] flex-shrink-0 pb-[env(safe-area-inset-bottom)]">
        <button
          onClick={handleToggleMute}
          disabled={!isConnected}
          className="w-11 h-11 rounded-full flex items-center justify-center border border-black/[0.08] cursor-pointer hover:bg-black/[0.02] transition-colors disabled:opacity-40"
        >
          <svg width="16" height="16" viewBox="0 0 14 14" fill="none" className={isMuted ? 'text-danger' : 'text-muted'}>
            {isMuted ? (
              <path d="M7 1v12M4 4v6M10 3v8M1 6v2M13 5v4M2 2l10 10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
            ) : (
              <path d="M7 1v12M4 4v6M10 3v8M1 6v2M13 5v4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
            )}
          </svg>
        </button>

        <motion.div
          className="w-14 h-14 rounded-full flex items-center justify-center cursor-pointer"
          style={{ background: 'linear-gradient(135deg, #B45309, #D97706)', boxShadow: '0 4px 16px rgba(180,83,9,0.25)' }}
          animate={isConnected ? { boxShadow: ['0 4px 16px rgba(180,83,9,0.25)', '0 6px 20px rgba(180,83,9,0.35)', '0 4px 16px rgba(180,83,9,0.25)'] } : {}}
          transition={{ duration: 2, repeat: Infinity }}
        >
          <svg width="16" height="16" viewBox="0 0 14 14" fill="none">
            <path d="M7 1C5.62 1 4.5 2.12 4.5 3.5v3.5c0 1.38 1.12 2.5 2.5 2.5s2.5-1.12 2.5-2.5V3.5C9.5 2.12 8.38 1 7 1z" fill="white" />
            <path d="M3 6.5v.5a4 4 0 0 0 8 0v-.5M7 11v2M5 13h4" stroke="white" strokeWidth="1.2" strokeLinecap="round" />
          </svg>
        </motion.div>

        <button
          onClick={() => setShowEndModal(true)}
          className="min-h-[44px] px-5 py-2.5 rounded-xl text-[13px] font-medium text-danger bg-red-50 border border-red-200 hover:bg-red-100 transition-colors cursor-pointer"
        >
          End Consultation
        </button>
      </div>

      <ConfirmModal
        open={showEndModal}
        title="End Consultation"
        message="Are you sure you want to end this consultation? Your feedback will be generated based on the conversation so far."
        confirmLabel="End Now"
        cancelLabel="Continue"
        variant="danger"
        onConfirm={() => { setShowEndModal(false); finishConsultation(); }}
        onCancel={() => setShowEndModal(false)}
      />
    </div>
  );
}

export default function GuestLiveConsultationPage() {
  return (
    <Suspense fallback={
      <div className="min-h-[100dvh] bg-surface flex items-center justify-center">
        <div className="text-muted text-sm">Loading...</div>
      </div>
    }>
      <GuestLiveConsultationContent />
    </Suspense>
  );
}
