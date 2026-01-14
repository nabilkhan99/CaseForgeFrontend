'use client';

import { DomainScore } from '@/lib/clinical-master/types';

interface FeedbackCardProps {
  domain: DomainScore;
  passThreshold?: number;
}

export default function FeedbackCard({ domain, passThreshold = 60 }: FeedbackCardProps) {
  const barColor = domain.score >= 80 ? 'bg-emerald-500' : domain.score >= 60 ? 'bg-blue-500' : 'bg-orange-500';

  return (
    <div className="bg-white/5 rounded-xl p-4 border border-white/5 flex flex-col justify-center">
      <div className="flex items-center justify-between mb-3">
        <div>
          <p className="text-xs font-bold text-white uppercase mb-0.5">{domain.domain}</p>
          <p className="text-[10px] text-slate-400">Performance</p>
        </div>
        <span className="text-xl font-bold text-white">{domain.score}%</span>
      </div>
      
      <div className="relative h-2 w-full bg-slate-700/30 rounded-full mt-2">
        <div
          className={`absolute inset-y-0 left-0 ${barColor} rounded-full`}
          style={{ width: `${domain.score}%` }}
        ></div>
        {/* Pass threshold indicator */}
        <div
          className="absolute top-0 bottom-0 w-px border-r-2 border-dotted border-white/40 h-[14px] -mt-1 z-10"
          style={{ left: `${passThreshold}%` }}
        ></div>
      </div>
    </div>
  );
}
