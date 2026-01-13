'use client';

import { useState } from 'react';
import ClinicalLayout from '@/components/clinical-master/ClinicalLayout';
import { mockExams } from '@/lib/clinical-master/mock-data';
import Link from 'next/link';

export default function ClinicalMasterPage() {
  const [selectedStationId, setSelectedStationId] = useState<string>('station-1');
  
  const selectedStation = mockExams[0].stations.find(s => s.id === selectedStationId);

  return (
    <ClinicalLayout showSidebar={true} showNotepad={true}>
      {/* Main Content Area */}
      <div className="flex-1 relative flex flex-col items-center justify-center p-8 bg-[#080c12]">
        {/* Background Gradients */}
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-indigo-600/10 rounded-full blur-[120px] pointer-events-none"></div>
        <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-purple-600/10 rounded-full blur-[120px] pointer-events-none"></div>

        {/* Content */}
        <div className="z-10 text-center max-w-2xl w-full flex flex-col items-center">
          <h2 className="text-5xl font-extrabold text-white mb-4 tracking-tight">
            {selectedStation?.title || 'Select a Station'}
          </h2>

          <div className="flex items-center gap-3 text-indigo-300/80 font-medium mb-12 bg-indigo-500/5 px-6 py-2 rounded-full border border-indigo-500/10">
            <span className="material-symbols-outlined text-[20px]">schedule</span>
            <span className="tracking-wide">3 min reading / 12 min consultation</span>
          </div>

          {selectedStation && (
            <div className="relative group w-full max-w-sm">
              <div className="absolute -inset-1 bg-gradient-to-r from-purple-600 to-indigo-600 rounded-2xl blur opacity-30 group-hover:opacity-60 transition duration-1000 group-hover:duration-200"></div>
              <Link href={`/clinical-master/station/${selectedStationId}`}>
                <button className="relative w-full py-6 px-12 bg-gradient-to-r from-purple-600 to-indigo-600 rounded-2xl flex items-center justify-center gap-4 text-white font-bold text-xl shadow-2xl transition-all hover:scale-[1.02] active:scale-[0.98]">
                  <span>Start Station</span>
                  <span className="material-symbols-outlined text-2xl">play_circle</span>
                </button>
              </Link>
            </div>
          )}
        </div>

        {/* Placeholder for station materials */}
        <div className="absolute bottom-12 w-full max-w-4xl px-8 opacity-20">
          <div className="h-24 rounded-2xl border-2 border-dashed border-white/10 flex items-center justify-center">
            <span className="text-slate-500 font-medium italic">
              Station materials will appear once the timer begins
            </span>
          </div>
        </div>
      </div>
    </ClinicalLayout>
  );
}
