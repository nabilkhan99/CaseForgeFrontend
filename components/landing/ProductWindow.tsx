'use client';

import { ReactNode } from 'react';

interface ProductWindowProps {
  label: string;
  timer: string;
  children: ReactNode;
}

export default function ProductWindow({ children }: ProductWindowProps) {
  return (
    <div
      className="rounded-[20px] overflow-hidden border border-black/[0.06]"
      style={{
        background: '#FFFCF8',
        boxShadow: '0 24px 64px rgba(180,83,9,0.06), 0 2px 4px rgba(0,0,0,0.04)',
      }}
    >
      {/* Content */}
      <div>{children}</div>
    </div>
  );
}
