'use client';

import { fmtMark } from '@/lib/clinical-master/scoring';
import type { CohortStats } from '@/lib/trainer/cohortStats';

interface CohortStatBandProps {
  stats: CohortStats;
  /** How many of those sessions carry a mark — the denominator for the middle two. */
  marked: number;
}

/**
 * The four numbers, as big type between hairline rules.
 *
 * Not four cards. The dashboard's rule is that only things which earn a
 * container get one, and a figure with a label under it does not — the rules
 * above and below are the whole frame, and they let the numbers be the largest
 * thing on the page after the chart, which is what a trainer is scanning for.
 *
 * The middle two carry "of N marked" rather than sharing the first figure's
 * denominator. Two denominators on one row is genuinely easy to misread, and a
 * cohort mid-pilot will routinely have sat more cases than have been marked.
 */
export default function CohortStatBand({ stats, marked }: CohortStatBandProps) {
  const cells: { label: string; value: string; caption?: string }[] = [
    { label: 'Sessions', value: String(stats.sessions) },
    {
      label: 'Avg score',
      value: stats.averageScore === null ? '—' : stats.averageScore.toFixed(1),
      caption: stats.averageScore === null ? 'nothing marked yet' : `of ${fmtMark(stats.maxScore)} · ${marked} marked`,
    },
    {
      label: 'Pass rate',
      value: stats.passRate === null ? '—' : `${stats.passRate}%`,
      caption: stats.passRate === null ? 'nothing marked yet' : `of ${marked} marked`,
    },
    { label: 'This week', value: String(stats.thisWeek), caption: 'sessions in 7 days' },
  ];

  return (
    <div className="mb-8 grid grid-cols-2 gap-y-5 border-y border-hairline py-5 sm:grid-cols-4">
      {cells.map((cell) => (
        <div key={cell.label}>
          <div className="text-[10px] font-semibold uppercase tracking-[0.1em] text-muted">
            {cell.label}
          </div>
          <div className="mt-1.5 font-mono text-[26px] font-bold leading-none tabular-nums text-heading">
            {cell.value}
          </div>
          {cell.caption && (
            <div className="mt-1.5 text-[11px] leading-tight text-muted">{cell.caption}</div>
          )}
        </div>
      ))}
    </div>
  );
}
