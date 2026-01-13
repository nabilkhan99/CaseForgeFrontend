'use client';

import { useParams, useRouter } from 'next/navigation';
import { useState } from 'react';
import ClinicalLayout from '@/components/clinical-master/ClinicalLayout';
import ConsultationTimer from '@/components/clinical-master/ConsultationTimer';
import { candidateBriefs } from '@/lib/clinical-master/mock-data';

export default function ReadingPhasePage() {
  const params = useParams();
  const router = useRouter();
  const stationId = params.stationId as string;
  const [isTimerComplete, setIsTimerComplete] = useState(false);

  const brief = candidateBriefs[stationId];

  const handleEnterRoom = () => {
    // Generate a session ID and navigate to consultation
    const sessionId = `session-${Date.now()}`;
    router.push(`/clinical-master/session/${sessionId}`);
  };

  const handleTimerComplete = () => {
    setIsTimerComplete(true);
  };

  return (
    <ClinicalLayout showSidebar={true} showNotepad={true} currentStationId={stationId}>
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
            <p className="text-xs text-slate-400 font-medium mt-0.5">SCA Mock Exam 01</p>
          </div>
        </div>

        <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2">
          <ConsultationTimer
            durationSeconds={180} // 3 minutes
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
      <div className="flex-1 flex flex-col min-w-0 bg-[#101922] relative">
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
          {brief ? (
            <div className="w-full max-w-4xl bg-white text-slate-900 shadow-2xl min-h-[800px] relative">
              <div className="p-12 md:p-16">
                <h3 className="text-xl font-bold uppercase tracking-wide mb-8 border-b-2 border-slate-900 pb-2 inline-block">
                  Materials for Candidate.
                </h3>

                <div className="space-y-1 mb-8 font-medium text-base">
                  <div className="flex gap-2">
                    <span className="font-bold w-20">Name:</span>
                    <span>{brief.patientName}</span>
                  </div>
                  <div className="flex gap-2">
                    <span className="font-bold w-20">Age:</span>
                    <span>{brief.age}</span>
                  </div>
                  {brief.address && (
                    <div className="flex gap-2">
                      <span className="font-bold w-20">Address:</span>
                      <span>{brief.address}</span>
                    </div>
                  )}
                </div>

                <div className="space-y-6 text-base leading-relaxed">
                  {brief.medicalHistory.map((item, index) => (
                    <p key={index}>{item}</p>
                  ))}

                  <div className="pt-8">
                    <p className="font-bold">End of notes</p>
                  </div>
                </div>
              </div>

              <div className="absolute right-2 top-1/2 -translate-y-1/2 flex flex-col gap-2 opacity-20 pointer-events-none">
                <span className="material-symbols-outlined text-4xl">keyboard_arrow_up</span>
                <span className="material-symbols-outlined text-4xl">keyboard_arrow_down</span>
              </div>
            </div>
          ) : (
            <div className="flex items-center justify-center h-full">
              <p className="text-slate-400">No candidate brief available for this station.</p>
            </div>
          )}
        </div>
      </div>

      {/* Bottom Action Bar (fixed in notepad) */}
      <style jsx global>{`
        .notepad-actions {
          position: absolute;
          bottom: 0;
          right: 0;
          left: 0;
          padding: 1.25rem;
          border-top: 1px solid rgba(148, 163, 184, 0.1);
          background: #111318;
        }
      `}</style>
    </ClinicalLayout>
  );
}
