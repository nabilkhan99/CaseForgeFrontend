'use client';

interface StationSidebarProps {
  currentStationId?: string;
  stationTitle?: string;
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export default function StationSidebar({ currentStationId, stationTitle }: StationSidebarProps) {
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
            <span className="text-slate-300 font-medium">0/1 Completed</span>
            <span className="text-white font-bold">0%</span>
          </div>
          <div className="rounded-full bg-slate-700 h-2 overflow-hidden">
            <div className="h-full bg-green-500 rounded-full" style={{ width: '0%' }}></div>
          </div>
        </div>
      </div>

      {/* Current Station */}
      <div className="flex-1 overflow-y-auto p-4 space-y-2">
        <div className="mb-1">
          <div className="w-full flex items-center justify-between p-4 bg-slate-800/30">
            <span className="text-sm font-medium text-slate-200">Current Station</span>
            <span className="material-symbols-outlined text-green-400 text-sm">radio_button_checked</span>
          </div>

          <div className="bg-[#0d141d] py-2 space-y-1">
            <div className="px-2">
              <div className="w-full flex items-center gap-3 p-2.5 rounded-lg bg-primary text-white shadow-md">
                <span className="material-symbols-outlined text-[20px]">
                  radio_button_unchecked
                </span>
                <div className="text-left overflow-hidden flex-1">
                  <p className="text-sm font-medium truncate leading-tight">
                    {stationTitle || 'Station'}
                  </p>
                </div>
                <span className="material-symbols-outlined text-[16px]">arrow_forward</span>
              </div>
            </div>
          </div>
        </div>

        {/* Help Section */}
        <div className="mt-8 p-4 bg-slate-800/20 rounded-lg border border-slate-700/50">
          <h4 className="text-sm font-medium text-slate-300 mb-2">Quick Tips</h4>
          <ul className="text-xs text-slate-400 space-y-2">
            <li className="flex items-start gap-2">
              <span className="material-symbols-outlined text-[14px] mt-0.5 text-primary">lightbulb</span>
              <span>Read the candidate brief carefully before entering the room</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="material-symbols-outlined text-[14px] mt-0.5 text-primary">lightbulb</span>
              <span>Use the notepad to jot down key points</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="material-symbols-outlined text-[14px] mt-0.5 text-primary">lightbulb</span>
              <span>The AI patient will respond to your questions in real-time</span>
            </li>
          </ul>
        </div>
      </div>
    </aside>
  );
}
