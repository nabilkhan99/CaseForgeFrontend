'use client';

import { TranscriptItem } from '@/lib/clinical-master/types';
import { useEffect, useRef } from 'react';

interface TranscriptFeedProps {
  transcript: TranscriptItem[];
}

export default function TranscriptFeed({ transcript }: TranscriptFeedProps) {
  const scrollRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [transcript]);

  return (
    <div className="flex-1 bg-[#161b26] rounded-xl border border-slate-800 flex flex-col overflow-hidden min-h-[300px]">
      <div className="bg-slate-800/50 px-4 py-2 border-b border-slate-800 flex justify-between items-center">
        <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
          Live Transcript
        </span>
        <span className="text-xs text-slate-500 flex items-center gap-1">
          <span className="material-symbols-outlined text-[14px]">auto_awesome</span> AI Enabled
        </span>
      </div>

      <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-4">
        {transcript.length === 0 ? (
          <div className="flex items-center justify-center h-full text-slate-500 text-sm">
            Waiting for conversation to begin...
          </div>
        ) : (
          transcript.map((item, index) => {
            const isDoctor = item.role === 'user';
            const time = new Date(item.timestamp).toLocaleTimeString('en-US', {
              hour: '2-digit',
              minute: '2-digit',
              second: '2-digit',
            });

            return (
              <div
                key={index}
                className={`flex gap-4 ${isDoctor ? 'flex-row-reverse' : ''}`}
              >
                <div
                  className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold ${
                    isDoctor
                      ? 'bg-primary text-white'
                      : 'bg-slate-700 text-slate-400'
                  }`}
                >
                  {isDoctor ? 'DR' : 'PT'}
                </div>
                <div className="flex-1 max-w-[80%]">
                  <div
                    className={`p-3 rounded-2xl text-sm leading-relaxed ${
                      isDoctor
                        ? 'bg-primary/20 text-slate-200 rounded-tr-none'
                        : 'bg-slate-800 text-slate-200 rounded-tl-none border border-slate-700'
                    }`}
                  >
                    {item.content}
                  </div>
                  <span className="text-[10px] text-slate-600 mt-1 block">
                    {time}
                  </span>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
