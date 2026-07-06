'use client';

import { FileDown } from 'lucide-react';

export default function PrintButton() {
  return (
    <button
      type="button"
      onClick={() => window.print()}
      className="inline-flex items-center gap-2 rounded-lg bg-[#EF9F27] px-4 py-2.5 text-sm font-semibold text-[#2C2C2A] shadow-[0_2px_6px_rgba(186,117,23,0.4)] transition-all hover:brightness-105 print:hidden"
    >
      <FileDown className="h-4 w-4" aria-hidden="true" />
      Download this specification as a PDF
    </button>
  );
}
