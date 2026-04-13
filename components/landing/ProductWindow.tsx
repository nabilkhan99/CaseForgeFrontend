'use client';

import { ReactNode } from 'react';

interface ProductWindowProps {
  label: string;
  timer: string;
  children: ReactNode;
}

export default function ProductWindow({ label, timer, children }: ProductWindowProps) {
  return (
    <div
      className="rounded-[20px] overflow-hidden border border-black/[0.06]"
      style={{
        background: '#FFFCF8',
        boxShadow: '0 24px 64px rgba(180,83,9,0.06), 0 2px 4px rgba(0,0,0,0.04)',
      }}
    >
      {/* Top bar */}
      <div className="h-12 flex items-center justify-between px-5 border-b border-black/[0.05]">
        <div className="flex items-center gap-2.5">
          <div className="w-2 h-2 rounded-full bg-primary" />
          <span className="text-[11px] font-mono text-muted">{label}</span>
        </div>
        <span className="text-[12px] font-mono text-primary">{timer}</span>
      </div>

      {/* Content */}
      <div>{children}</div>
    </div>
  );
}
