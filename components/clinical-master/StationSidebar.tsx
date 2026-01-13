'use client';

import { useState } from 'react';
import { mockExams } from '@/lib/clinical-master/mock-data';
import Link from 'next/link';

interface StationSidebarProps {
  currentStationId?: string;
}

export default function StationSidebar({ currentStationId }: StationSidebarProps) {
  const [expandedExamId, setExpandedExamId] = useState<string>('mock-01');

  return (
    <aside className="w-80 bg-[#111318] border-r border-slate-800 flex flex-col shrink-0 z-20">
      {/* Header */}
      <div className="p-6 border-b border-slate-800 bg-[#111318]">
        <h3 className="text-white text-lg font-bold leading-tight tracking-tight mb-4">
          Examination Progress
        </h3>
        {/* Progress Bar */}
        <div className="flex flex-col gap-2">
          <div className="flex gap-6 justify-between text-sm">
            <span className="text-slate-300 font-medium">0/7 Completed</span>
            <span className="text-white font-bold">0%</span>
          </div>
          <div className="rounded-full bg-slate-700 h-2 overflow-hidden">
            <div className="h-full bg-green-500 rounded-full" style={{ width: '0%' }}></div>
          </div>
        </div>
      </div>

      {/* Station List */}
      <div className="flex-1 overflow-y-auto p-4 space-y-2">
        {mockExams.map((exam) => (
          <div key={exam.id} className="mb-1">
            <button
              onClick={() => setExpandedExamId(expandedExamId === exam.id ? '' : exam.id)}
              className={`w-full flex items-center justify-between p-4 transition-colors ${
                expandedExamId === exam.id
                  ? 'bg-slate-800/30'
                  : 'hover:bg-slate-800/30'
              }`}
            >
              <span className="text-sm font-medium text-slate-200">{exam.name}</span>
              <span className="material-symbols-outlined text-slate-400 text-sm">
                {expandedExamId === exam.id ? 'keyboard_arrow_up' : 'keyboard_arrow_down'}
              </span>
            </button>

            {expandedExamId === exam.id && exam.stations.length > 0 && (
              <div className="bg-[#0d141d] py-2 space-y-1">
                {exam.stations.map((station) => (
                  <div key={station.id} className="px-2">
                    <Link
                      href={`/clinical-master/station/${station.id}`}
                      className={`w-full flex items-center gap-3 p-2.5 rounded-lg transition-colors group ${
                        currentStationId === station.id
                          ? 'bg-primary text-white shadow-md'
                          : 'text-slate-400 hover:bg-slate-800 hover:text-slate-200'
                      }`}
                    >
                      <span className="material-symbols-outlined text-[20px]">
                        {station.completed ? 'check_circle' : 'radio_button_unchecked'}
                      </span>
                      <div className="text-left overflow-hidden flex-1">
                        <p className="text-sm font-medium truncate leading-tight">
                          {station.title}
                        </p>
                      </div>
                      {currentStationId === station.id && (
                        <span className="material-symbols-outlined text-[16px]">arrow_forward</span>
                      )}
                    </Link>
                  </div>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>
    </aside>
  );
}
