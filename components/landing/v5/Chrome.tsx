import type { ReactNode } from 'react';

/**
 * Browser-chrome frame used to present product UI as an artifact —
 * traffic-light dots, a mono label, optional right-hand meta.
 */
export default function Chrome({
  label,
  meta,
  children,
  className = '',
}: {
  label: string;
  meta?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={`flex flex-col overflow-hidden rounded-xl border border-heading/10 bg-surface-raised shadow-elevation-3 ${className}`}
    >
      <div className="flex flex-shrink-0 items-center gap-1.5 border-b border-heading/[0.07] px-4 py-2.5">
        <span className="h-2.5 w-2.5 rounded-full bg-[#E5DFD3]" aria-hidden="true" />
        <span className="h-2.5 w-2.5 rounded-full bg-[#E5DFD3]" aria-hidden="true" />
        <span className="h-2.5 w-2.5 rounded-full bg-[#E5DFD3]" aria-hidden="true" />
        <span className="ml-2.5 font-mono text-[10px] uppercase tracking-[0.16em] text-muted">
          {label}
        </span>
        {meta && (
          <span className="ml-auto flex items-center gap-2 font-mono text-[10px] text-muted">
            {meta}
          </span>
        )}
      </div>
      <div className="min-h-0 flex-1">{children}</div>
    </div>
  );
}
