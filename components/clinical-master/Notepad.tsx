'use client';

import { useState, useEffect } from 'react';

export default function Notepad() {
  const [notes, setNotes] = useState('');
  const [activeTab, setActiveTab] = useState<'notepad' | 'brief'>('notepad');

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

  return (
    <aside className="w-96 flex-shrink-0 flex flex-col bg-[#111318] border-l border-slate-800 z-20 shadow-xl">
      {/* Tabs */}
      <div className="flex border-b border-slate-800 bg-[#111318]">
        <button
          onClick={() => setActiveTab('brief')}
          className={`flex-1 py-4 text-sm font-medium transition-all ${
            activeTab === 'brief'
              ? 'text-slate-400 hover:text-white border-b-2 border-transparent hover:border-slate-700'
              : 'text-slate-400'
          }`}
        >
          Candidate Brief
        </button>
        <button
          onClick={() => setActiveTab('notepad')}
          className={`flex-1 py-4 text-sm transition-all ${
            activeTab === 'notepad'
              ? 'font-bold text-primary border-b-2 border-primary bg-primary/5'
              : 'font-medium text-slate-400'
          }`}
        >
          Notepad
        </button>
      </div>

      {/* Notepad Content */}
      <div className="flex-1 flex flex-col relative bg-[#161b26]">
        {/* Status Bar */}
        <div className="px-4 py-2 bg-[#111318] border-b border-slate-800 flex justify-between items-center">
          <span className="text-xs text-slate-500">Last saved: Just now</span>
          <span className="material-symbols-outlined text-green-500 text-[16px]">
            cloud_done
          </span>
        </div>

        {/* Textarea */}
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          className="w-full h-full bg-transparent text-slate-300 p-6 resize-none focus:outline-none focus:ring-0 border-none font-mono text-sm leading-relaxed"
          placeholder="Type your clinical notes here..."
        />

        {/* Helper overlay */}
        <div className="absolute bottom-4 right-4 text-[10px] text-slate-600 font-mono bg-[#111318] px-2 py-1 rounded border border-slate-800 pointer-events-none">
          Press TAB to switch focus
        </div>
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
              const sessionId = `session-${Date.now()}`;
              window.location.href = `/clinical-master/session/${sessionId}`;
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
