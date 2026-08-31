'use client';

import { useId, useState } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import type { TrendEvidence } from '@/lib/clinical-master/trendTypes';

interface EvidenceTableProps {
  evidence: TrendEvidence[];
  /** station id → title, from getCaseTitles. */
  titles: Map<string, string>;
}

/**
 * "Where it happened" — the receipts under a pattern.
 *
 * Collapsed by default, unlike the pattern itself: the pattern is the point and
 * the list is the proof, and proof only needs to be reachable. Opening it is a
 * distinct act of doubt ("show me"), and it deserves a distinct click.
 *
 * NOTHING HERE IS A LINK. That is the design, not an omission. This page is the
 * macro picture; a row that jumped to one feedback report would swap the whole
 * frame for a single case, which is exactly the reading this page exists to
 * replace — and the per-case history now lives on the Library topic pages,
 * where a case is what you are looking at anyway.
 */
export default function EvidenceTable({ evidence, titles }: EvidenceTableProps) {
  const shouldReduceMotion = useReducedMotion();
  const [open, setOpen] = useState(false);
  const panelId = useId();

  // A row that cannot say which case it was is not evidence, it is an
  // assertion — "One of your cases" tested exactly as bad as it sounds. Rows
  // without a resolvable title are dropped, and a table with none disappears.
  const named = evidence.filter((item) => titles.get(item.case_id));

  if (named.length === 0) return null;

  return (
    <div className="mt-4">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
        aria-controls={panelId}
        className="-mx-1.5 flex min-h-[32px] items-center gap-1.5 rounded-md px-1.5 text-[12px] text-muted transition-colors hover:text-heading focus-visible-ring"
      >
        <motion.svg
          className="h-3 w-3"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2.5}
          initial={false}
          animate={{ rotate: open ? 90 : 0 }}
          transition={shouldReduceMotion ? { duration: 0 } : { duration: 0.15 }}
          aria-hidden="true"
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
        </motion.svg>
        Where it happened &middot; {named.length}{' '}
        {named.length === 1 ? 'case' : 'cases'}
      </button>

      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            id={panelId}
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={shouldReduceMotion ? { duration: 0 } : { duration: 0.2 }}
            className="overflow-hidden"
          >
            <ul className="mt-2 divide-y divide-hairline">
              {named.map((item, index) => (
                <li
                  key={`${item.case_id}-${index}`}
                  className="flex flex-col gap-1 py-2.5 sm:flex-row sm:gap-4"
                >
                  <span className="flex-shrink-0 text-[13px] font-medium text-heading sm:w-[300px]">
                    {titles.get(item.case_id)}
                  </span>
                  <span className="min-w-0 flex-1 text-[12.5px] italic leading-[1.55] text-muted">
                    &ldquo;{item.quote}&rdquo;
                  </span>
                </li>
              ))}
            </ul>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
