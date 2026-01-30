'use client';

import { useParams, useRouter, useSearchParams } from 'next/navigation';
import { useState, useEffect, Suspense } from 'react';
import ClinicalLayout from '@/components/clinical-master/ClinicalLayout';
import ConsultationTimer from '@/components/clinical-master/ConsultationTimer';
import AudioWaveform from '@/components/clinical-master/AudioWaveform';
import TranscriptFeed from '@/components/clinical-master/TranscriptFeed';
import { useAudioSession } from '@/hooks/useAudioSession';
import { createClient } from '@/lib/supabase/client';

interface StationData {
  id: string;
  title: string;
  patient_name: string;
  patient_age: number;
  candidate_instructions: string;
  consultation_duration_seconds: number;
}

function LiveConsultationContent() {
  const params = useParams();
  const router = useRouter();
  const searchParams = useSearchParams();
  const sessionId = params.sessionId as string;
  const stationId = searchParams.get('stationId');

  const [station, setStation] = useState<StationData | null>(null);
  const [consultationDuration, setConsultationDuration] = useState(120); // 2 minutes default
  const [isProcessing, setIsProcessing] = useState(false);

  // Fetch station data on mount
  useEffect(() => {
    async function fetchStation() {
      if (!stationId) return;

      const supabase = createClient();
      const { data, error } = await supabase
        .from('stations')
        .select('id, title, patient_name, patient_age, candidate_instructions, consultation_duration_seconds')
        .eq('id', stationId)
        .single();

      if (!error && data) {
        setStation(data);
        setConsultationDuration(data.consultation_duration_seconds || 120);
      }
    }

    fetchStation();
  }, [stationId]);

  const {
    isConnected,
    isRecording,
    transcript,
    connect,
    startRecording,
    endConsultation,
    error,
  } = useAudioSession({
    sessionId,
    stationId: stationId || undefined,
    onSessionStarted: (durationSeconds) => {
      setConsultationDuration(durationSeconds);
    },
    onConsultationEnded: () => {
      setIsProcessing(true);
      // Navigate to feedback page after a short delay
      setTimeout(() => {
        router.push(`/clinical-master/feedback/${sessionId}`);
      }, 2000);
    },
    onError: (error) => {
      console.error('Session error:', error);
    },
  });

  // Auto-connect on mount
  useEffect(() => {
    connect();
  }, [connect]);

  // Auto-start recording once connected
  useEffect(() => {
    if (isConnected && !isRecording) {
      startRecording();
    }
  }, [isConnected, isRecording, startRecording]);

  const handleTimerComplete = () => {
    endConsultation();
  };

  const handleEndConsultation = () => {
    if (confirm('Are you sure you want to end this consultation?')) {
      endConsultation();
    }
  };

  // Format patient display name
  const patientDisplay = station
    ? `${station.patient_name} (${station.patient_age}${station.patient_age ? 'y' : ''})`
    : 'Patient';

  if (isProcessing) {
    return (
      <ClinicalLayout showSidebar={false} showNotepad={false}>
        <div className="flex-1 flex items-center justify-center bg-gradient-to-b from-[#111731] to-[#070A13]">
          <div className="glass-card w-full max-w-2xl rounded-3xl p-12 flex flex-col items-center gap-8">
            <div className="relative">
              <div className="size-40 rounded-full border-4 border-slate-700/50 flex items-center justify-center">
                <div className="size-40 absolute border-4 border-primary rounded-full animate-spin border-t-transparent"></div>
                <div className="text-center">
                  <span className="text-4xl font-bold text-white">82%</span>
                </div>
              </div>
            </div>
            <div className="text-center">
              <h3 className="text-2xl font-bold text-white tracking-tight mb-2">
                Finalising Consultation
              </h3>
              <p className="text-slate-400 text-sm">
                Our clinical engine is processing your assessment.
              </p>
            </div>
          </div>
        </div>
      </ClinicalLayout>
    );
  }

  return (
    <ClinicalLayout
      showSidebar={false}
      showNotepad={true}
      candidateBrief={station?.candidate_instructions}
      stationId={stationId || undefined}
    >
      {/* Timer Bar */}
      <div className="h-16 border-b border-slate-800 bg-[#111318] flex items-center justify-between px-8 shadow-sm z-10">
        <div className="flex items-center gap-2">
          <span className="material-symbols-outlined text-slate-400">timer</span>
          <span className="text-slate-400 text-sm font-medium">Time Remaining</span>
        </div>

        <ConsultationTimer
          durationSeconds={consultationDuration}
          label=""
          onComplete={handleTimerComplete}
          autoStart={true}
        />

        <div className="flex items-center gap-2">
          <div className="px-2 py-1 rounded bg-slate-800 border border-slate-700 text-xs text-slate-400">
            Session ID: {sessionId.slice(-8)}
          </div>
          {isConnected && (
            <div className="flex items-center gap-1 text-xs text-green-400">
              <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></span>
              Connected
            </div>
          )}
          {error && (
            <div className="text-xs text-red-400">Error: {error}</div>
          )}
        </div>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 overflow-y-auto p-6 flex flex-col gap-6 scroll-smooth">
        {/* Patient Avatar & Audio Visualizer */}
        <div className="flex flex-col md:flex-row gap-6 items-center justify-center min-h-[220px]">
          {/* Patient Avatar */}
          <div className="relative group shrink-0">
            <div className="w-32 h-32 md:w-40 md:h-40 rounded-2xl overflow-hidden border-2 border-slate-700 shadow-xl relative bg-slate-800">
              <div className="w-full h-full flex items-center justify-center">
                <span className="material-symbols-outlined text-6xl text-slate-600">person</span>
              </div>
              <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent p-3">
                <p className="text-white text-sm font-semibold text-center">
                  {patientDisplay}
                </p>
              </div>
            </div>
            {isRecording && (
              <div className="absolute -right-2 -top-2 flex h-6 w-6 items-center justify-center rounded-full bg-green-500 ring-4 ring-[#0f172a]">
                <span className="material-symbols-outlined text-white text-[14px] font-bold">
                  mic
                </span>
              </div>
            )}
          </div>

          {/* Audio Waveform */}
          <AudioWaveform isActive={transcript.length > 0 && transcript[transcript.length - 1]?.role === 'assistant'} />
        </div>

        {/* Live Transcription Feed */}
        <TranscriptFeed transcript={transcript} />
      </div>

      {/* Utility Control Bar */}
      <div className="h-20 bg-[#111318] border-t border-slate-800 flex items-center justify-center gap-6 px-6 z-20">
        <button
          onClick={() => { }}
          className="flex flex-col items-center gap-1 group"
          disabled={!isRecording}
        >
          <div className="w-12 h-12 rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center group-hover:bg-slate-700 group-hover:border-slate-600 transition-all disabled:opacity-50">
            <span className="material-symbols-outlined text-white text-[24px]">
              {isRecording ? 'mic' : 'mic_off'}
            </span>
          </div>
          <span className="text-[10px] uppercase font-bold text-slate-500 group-hover:text-slate-300">
            {isRecording ? 'Mute' : 'Unmuted'}
          </span>
        </button>

        <div className="w-px h-10 bg-slate-800 mx-2"></div>

        <button
          onClick={handleEndConsultation}
          className="flex items-center gap-3 px-6 h-12 rounded-full bg-red-500/10 border border-red-500/50 hover:bg-red-500 hover:text-white text-red-500 transition-all group"
        >
          <span className="material-symbols-outlined group-hover:text-white transition-colors">
            call_end
          </span>
          <span className="font-semibold text-sm">End Consultation</span>
        </button>
      </div>
    </ClinicalLayout>
  );
}

export default function LiveConsultationPage() {
  return (
    <Suspense fallback={
      <div className="flex items-center justify-center h-screen bg-[#0f172a]">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-500" />
      </div>
    }>
      <LiveConsultationContent />
    </Suspense>
  );
}
