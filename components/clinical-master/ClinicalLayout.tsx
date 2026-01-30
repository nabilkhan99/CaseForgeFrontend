'use client';

import { ReactNode } from 'react';
import StationSidebar from './StationSidebar';
import Notepad from './Notepad';

interface ClinicalLayoutProps {
  children: ReactNode;
  showSidebar?: boolean;
  showNotepad?: boolean;
  currentStationId?: string;
  stationTitle?: string;
  candidateBrief?: string;
  stationId?: string;
}

export default function ClinicalLayout({
  children,
  showSidebar = true,
  showNotepad = true,
  currentStationId,
  stationTitle,
  candidateBrief,
  stationId,
}: ClinicalLayoutProps) {
  return (
    <div className="flex h-screen overflow-hidden">
      {showSidebar && <StationSidebar currentStationId={currentStationId} stationTitle={stationTitle} />}

      <main className="flex-1 flex flex-col min-w-0 bg-[#0f172a] relative">
        {children}
      </main>

      {showNotepad && <Notepad candidateBrief={candidateBrief} stationId={stationId || currentStationId} />}
    </div>
  );
}
