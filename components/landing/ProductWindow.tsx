'use client';

import { ReactNode } from 'react';

interface ProductWindowProps {
  label: string;
  timer: string;
  children: ReactNode;
}

export default function ProductWindow({ children }: ProductWindowProps) {
  return (
    <div className="rounded-2xl overflow-hidden border border-border-card bg-bg-card shadow-card-chrome">
      {/* Content */}
      <div>{children}</div>
    </div>
  );
}
