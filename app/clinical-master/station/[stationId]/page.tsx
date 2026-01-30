'use client';

import { useParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import ClinicalLayout from '@/components/clinical-master/ClinicalLayout';
import ConsultationTimer from '@/components/clinical-master/ConsultationTimer';
import { createClient } from '@/lib/supabase/client';

interface StationData {
  id: string;
  title: string;
  patient_name: string;
  candidate_instructions: string;
  reading_duration_seconds: number;
  consultation_duration_seconds: number;
  domain_name: string;
}

export default function ReadingPhasePage() {
  const params = useParams();
  const stationId = params.stationId as string;

  const [station, setStation] = useState<StationData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchStation() {
      const supabase = createClient();

      const { data: s, error } = await supabase
        .from('stations')
        .select('id, title, patient_name, candidate_instructions, domain_id, reading_duration_seconds, consultation_duration_seconds')
        .eq('id', stationId)
        .single();

      if (error || !s) {
        console.error('Error fetching station:', error?.message);
        setLoading(false);
        return;
      }

      // Fetch domain name separately
      const { data: domain } = await supabase
        .from('domains')
        .select('name')
        .eq('id', s.domain_id)
        .single();

      setStation({
        id: s.id,
        title: s.title,
        patient_name: s.patient_name,
        candidate_instructions: s.candidate_instructions || '',
        reading_duration_seconds: s.reading_duration_seconds,
        consultation_duration_seconds: s.consultation_duration_seconds,
        domain_name: domain?.name || 'Unknown',
      });
      setLoading(false);
    }

    if (stationId) {
      fetchStation();
    }
  }, [stationId]);

  const handleTimerComplete = () => {
    console.log('Reading time complete');
  };

  if (loading) {
    return (
      <ClinicalLayout showSidebar={true} showNotepad={true} candidateBrief="" stationId={stationId}>
        <div className="flex-1 flex items-center justify-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-500" />
        </div>
      </ClinicalLayout>
    );
  }

  return (
    <ClinicalLayout
      showSidebar={true}
      showNotepad={true}
      currentStationId={stationId}
      stationTitle={station?.title || 'Station'}
      candidateBrief={station?.candidate_instructions || ''}
      stationId={stationId}
    >
      {/* Header with Timer */}
      <header className="h-16 flex items-center justify-between px-6 border-b border-slate-800 bg-[#17202b] shrink-0 z-20 relative shadow-sm">
        <div className="flex items-center gap-3">
          <div className="size-8 rounded-lg bg-primary flex items-center justify-center text-white shadow-lg shadow-blue-500/20">
            <span className="material-symbols-outlined text-[20px]">medical_services</span>
          </div>
          <div>
            <h1 className="text-base font-bold tracking-tight text-white leading-none">
              Clinical Master
            </h1>
            <p className="text-xs text-slate-400 font-medium mt-0.5">{station?.title || 'Loading...'}</p>
          </div>
        </div>

        <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2">
          <ConsultationTimer
            durationSeconds={station?.reading_duration_seconds || 180}
            label="Reading Time"
            onComplete={handleTimerComplete}
          />
        </div>

        <div className="flex items-center gap-3">
          <button className="flex items-center gap-2 px-4 py-2 rounded-lg bg-red-500/10 text-red-600 dark:text-red-400 hover:bg-red-500/20 transition-colors text-sm font-medium border border-red-500/20">
            <span className="material-symbols-outlined text-[18px]">close</span>
            <span>End Exam</span>
          </button>
        </div>
      </header>

      {/* Main Content */}
      <div className="flex-1 flex flex-col min-w-0 bg-[#101922] relative overflow-hidden">
        <div className="px-8 py-4 border-b border-slate-800 bg-[#17202b]/50 backdrop-blur-sm sticky top-0 z-10 flex justify-between items-center">
          <h2 className="text-lg font-bold text-white tracking-tight">
            Station 1: Reading Material
          </h2>
          <div className="flex items-center gap-2">
            <button
              className="p-1.5 hover:bg-slate-700 rounded text-slate-400 hover:text-white transition-colors"
              title="Zoom Out"
            >
              <span className="material-symbols-outlined text-[20px]">remove</span>
            </button>
            <button
              className="p-1.5 hover:bg-slate-700 rounded text-slate-400 hover:text-white transition-colors"
              title="Zoom In"
            >
              <span className="material-symbols-outlined text-[20px]">add</span>
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-8 custom-scrollbar flex justify-center">
          {station?.candidate_instructions ? (
            <div className="w-full max-w-4xl bg-white text-slate-900 shadow-2xl min-h-[800px] relative">
              <div className="p-12 md:p-16">
                <h3 className="text-xl font-bold uppercase tracking-wide mb-8 border-b-2 border-slate-900 pb-2 inline-block">
                  Materials for Candidate
                </h3>

                <div className="space-y-1 mb-8 font-medium text-base">
                  <div className="flex gap-2">
                    <span className="font-bold w-20">Name:</span>
                    <span>{station.patient_name}</span>
                  </div>
                </div>

                <div className="space-y-4 text-base leading-relaxed">
                  {/* Render the candidate instructions with better formatting */}
                  {station.candidate_instructions.split('\n').map((line, index) => (
                    <p key={index} className={line.includes(':') && line.match(/^[A-Z]/) ? 'font-semibold mt-4' : ''}>
                      {line}
                    </p>
                  ))}

                  {/* If it's a single paragraph, split it intelligently */}
                  {!station.candidate_instructions.includes('\n') && (
                    <div className="whitespace-pre-wrap">
                      {station.candidate_instructions
                        .replace(/Personal details:/gi, '\n\n**Personal details:**\n')
                        .replace(/Past Medical History:/gi, '\n\n**Past Medical History:**\n')
                        .replace(/Medication History:/gi, '\n\n**Medication History:**\n')
                        .replace(/Medical Notes:/gi, '\n\n**Medical Notes:**\n')
                        .replace(/Investigation Results:/gi, '\n\n**Investigation Results:**\n')
                        .replace(/Discharge Summary:/gi, '\n\n**Discharge Summary:**\n')
                        .split('\n')
                        .map((line, i) => {
                          if (line.startsWith('**') && line.endsWith('**')) {
                            return <h4 key={i} className="font-bold text-lg mt-6 mb-2">{line.replace(/\*\*/g, '')}</h4>;
                          }
                          return line && <p key={i} className="mb-2">{line}</p>;
                        })}
                    </div>
                  )}

                  <div className="pt-8 border-t border-slate-300">
                    <p className="font-bold italic text-slate-600">End of notes</p>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className="flex items-center justify-center h-full">
              <p className="text-slate-400">No candidate brief available for this station.</p>
            </div>
          )}
        </div>
      </div>
    </ClinicalLayout>
  );
}
