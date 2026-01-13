'use client';

export default function AudioWaveform({ isActive = false }: { isActive?: boolean }) {
  return (
    <div className="flex-1 w-full max-w-md h-24 bg-slate-800/50 rounded-xl border border-slate-700/50 flex items-center justify-center gap-1 px-8 relative overflow-hidden">
      {/* Active Speaker Label */}
      <div className="absolute top-2 left-3 flex items-center gap-2">
        <span className={`block w-2 h-2 rounded-full ${isActive ? 'bg-green-500 animate-pulse' : 'bg-slate-600'}`}></span>
        <span className="text-[10px] uppercase tracking-wider text-slate-400 font-medium">
          {isActive ? 'Patient Speaking' : 'Listening...'}
        </span>
      </div>

      {/* Animated Bars */}
      {isActive ? (
        <>
          <div className="w-1.5 bg-green-500/80 rounded-full h-4 animate-[wave_1s_ease-in-out_infinite]"></div>
          <div className="w-1.5 bg-green-500/80 rounded-full h-8 animate-[wave_1.2s_ease-in-out_infinite_0.1s]"></div>
          <div className="w-1.5 bg-green-500/80 rounded-full h-12 animate-[wave_0.8s_ease-in-out_infinite_0.2s]"></div>
          <div className="w-1.5 bg-green-500/80 rounded-full h-6 animate-[wave_1.1s_ease-in-out_infinite_0.3s]"></div>
          <div className="w-1.5 bg-green-500/80 rounded-full h-10 animate-[wave_0.9s_ease-in-out_infinite_0.4s]"></div>
          <div className="w-1.5 bg-green-500/80 rounded-full h-14 animate-[wave_1.3s_ease-in-out_infinite_0.5s]"></div>
          <div className="w-1.5 bg-green-500/80 rounded-full h-8 animate-[wave_1.0s_ease-in-out_infinite_0.6s]"></div>
          <div className="w-1.5 bg-green-500/80 rounded-full h-4 animate-[wave_1.2s_ease-in-out_infinite_0.7s]"></div>
          <div className="w-1.5 bg-green-500/80 rounded-full h-2 animate-[wave_0.8s_ease-in-out_infinite_0.8s]"></div>
        </>
      ) : (
        <>
          <div className="w-1.5 bg-slate-600 rounded-full h-2"></div>
          <div className="w-1.5 bg-slate-600 rounded-full h-3"></div>
          <div className="w-1.5 bg-slate-600 rounded-full h-4"></div>
          <div className="w-1.5 bg-slate-600 rounded-full h-3"></div>
          <div className="w-1.5 bg-slate-600 rounded-full h-2"></div>
          <div className="w-1.5 bg-slate-600 rounded-full h-4"></div>
          <div className="w-1.5 bg-slate-600 rounded-full h-3"></div>
          <div className="w-1.5 bg-slate-600 rounded-full h-2"></div>
          <div className="w-1.5 bg-slate-600 rounded-full h-1"></div>
        </>
      )}

      <style jsx>{`
        @keyframes wave {
          0%, 100% { height: 10%; }
          50% { height: 100%; }
        }
      `}</style>
    </div>
  );
}
