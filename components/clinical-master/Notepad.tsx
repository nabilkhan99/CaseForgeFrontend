'use client';

import { useState, useEffect } from 'react';

interface NotepadProps {
  candidateBrief?: string;
  stationId?: string;
}

export default function Notepad({ candidateBrief, stationId }: NotepadProps) {
  const [notes, setNotes] = useState('');
  const [activeTab, setActiveTab] = useState<'notepad' | 'brief'>('brief');

  // Load notes from localStorage on mount
  useEffect(() => {
    const savedNotes = localStorage.getItem('clinical-master-notes');
    if (savedNotes) {
      setNotes(savedNotes);
    }
  }, []);

  // Auto-save notes
  useEffect(() => {
    const timer = setTimeout(() => {
      localStorage.setItem('clinical-master-notes', notes);
    }, 1000);
    return () => clearTimeout(timer);
  }, [notes]);

  // Format the candidate brief with section headers
  const formatBrief = (brief: string) => {
    if (!brief) return null;

    // Split by common section headers
    const formatted = brief
      .replace(/Personal details:/gi, '\n\n**Personal details:**\n')
      .replace(/Patient name:/gi, '\n• Patient name:')
      .replace(/Patient age:/gi, '\n• Patient age:')
      .replace(/Past Medical History:/gi, '\n\n**Past Medical History:**\n')
      .replace(/Medication History:/gi, '\n\n**Medication History:**\n')
      .replace(/Medical Notes:/gi, '\n\n**Medical Notes:**\n')
      .replace(/Hospital Admission/gi, '\n\n*Hospital Admission*')
      .replace(/During admission:/gi, '\n• During admission:')
      .replace(/Investigation Results/gi, '\n\n**Investigation Results:**\n')
      .replace(/Bloods:/gi, '\n• Bloods:')
      .replace(/Chest X-ray:/gi, '\n• Chest X-ray:')
      .replace(/Urine culture:/gi, '\n• Urine culture:')
      .replace(/ECG:/gi, '\n• ECG:')
      .replace(/Discharge Summary:/gi, '\n\n**Discharge Summary:**\n')
      .replace(/Impression:/gi, '\n• Impression:')
      .replace(/Advised/gi, '\n• Advised')
      .replace(/NKDA/gi, '\n• NKDA');

    return formatted.split('\n').map((line, index) => {
      if (line.startsWith('**') && line.endsWith('**')) {
        return (
          <h4 key={index} className="font-bold text-primary mt-4 mb-2">
            {line.replace(/\*\*/g, '')}
          </h4>
        );
      }
      if (line.startsWith('*') && line.endsWith('*') && !line.startsWith('**')) {
        return (
          <p key={index} className="font-semibold text-slate-200 mt-3 mb-1">
            {line.replace(/\*/g, '')}
          </p>
        );
      }
      if (line.startsWith('•')) {
        return (
          <p key={index} className="text-slate-300 ml-2 my-1">
            {line}
          </p>
        );
      }
      if (line.trim()) {
        return (
          <p key={index} className="text-slate-300 my-1">
            {line}
          </p>
        );
      }
      return null;
    });
  };

  return (
    <aside className="w-96 flex-shrink-0 flex flex-col bg-[#111318] border-l border-slate-800 z-20 shadow-xl">
      {/* Tabs */}
      <div className="flex border-b border-slate-800 bg-[#111318]">
        <button
          onClick={() => setActiveTab('brief')}
          className={`flex-1 py-4 text-sm transition-all ${activeTab === 'brief'
            ? 'font-bold text-primary border-b-2 border-primary bg-primary/5'
            : 'font-medium text-slate-400 hover:text-white'
            }`}
        >
          Candidate Brief
        </button>
        <button
          onClick={() => setActiveTab('notepad')}
          className={`flex-1 py-4 text-sm transition-all ${activeTab === 'notepad'
            ? 'font-bold text-primary border-b-2 border-primary bg-primary/5'
            : 'font-medium text-slate-400 hover:text-white'
            }`}
        >
          Notepad
        </button>
      </div>

      {/* Content Area */}
      <div className="flex-1 flex flex-col relative bg-[#161b26] min-h-0">
        {/* Status Bar */}
        <div className="px-4 py-2 bg-[#111318] border-b border-slate-800 flex justify-between items-center">
          <span className="text-xs text-slate-500">
            {activeTab === 'notepad' ? 'Last saved: Just now' : 'Candidate Instructions'}
          </span>
          {activeTab === 'notepad' && (
            <span className="material-symbols-outlined text-green-500 text-[16px]">
              cloud_done
            </span>
          )}
        </div>

        {activeTab === 'notepad' ? (
          /* Notepad Textarea */
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            className="w-full h-full bg-transparent text-slate-300 p-6 resize-none focus:outline-none focus:ring-0 border-none font-mono text-sm leading-relaxed"
            placeholder="Type your clinical notes here..."
          />
        ) : (
          /* Candidate Brief Content */
          <div className="flex-1 overflow-y-auto p-6 custom-scrollbar">
            {candidateBrief ? (
              <div className="text-sm leading-relaxed">
                {formatBrief(candidateBrief)}
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center h-full text-slate-500">
                <span className="material-symbols-outlined text-4xl mb-2">description</span>
                <p className="text-center">No candidate brief available for this station.</p>
              </div>
            )}
          </div>
        )}

        {/* Helper overlay - only for notepad */}
        {activeTab === 'notepad' && (
          <div className="absolute bottom-4 right-4 text-[10px] text-slate-600 font-mono bg-[#111318] px-2 py-1 rounded border border-slate-800 pointer-events-none">
            Press TAB to switch focus
          </div>
        )}
      </div>

      {/* Action buttons for reading phase */}
      <div className="p-5 border-t border-slate-800 bg-[#0b0e14]">
        <div className="flex flex-col gap-3">
          <div className="flex items-center justify-between text-xs text-slate-400 mb-1">
            <span>Reading time remaining</span>
            <span className="text-white font-mono">--:--</span>
          </div>
          <button
            onClick={() => {
              const sessionId = crypto.randomUUID();
              const stationParam = stationId ? `?stationId=${stationId}` : '';
              window.location.href = `/clinical-master/session/${sessionId}${stationParam}`;
            }}
            className="w-full h-12 bg-primary hover:bg-blue-600 active:bg-blue-700 text-white font-bold rounded-lg shadow-lg shadow-blue-600/20 flex items-center justify-center gap-2 transition-all transform active:scale-[0.98]"
          >
            <span>Enter Room</span>
            <span className="material-symbols-outlined">login</span>
          </button>
          <button className="w-full h-10 bg-slate-800 hover:bg-slate-700 text-slate-300 font-medium rounded-lg border border-slate-700 flex items-center justify-center gap-2 transition-colors text-sm">
            <span className="material-symbols-outlined text-[18px]">flag</span>
            <span>Flag for Review</span>
          </button>
        </div>
      </div>
    </aside>
  );
}
