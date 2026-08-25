'use client';

import { motion } from 'framer-motion';
import type { SessionHistoryItem } from '@/lib/supabase/queries/dashboard';
import { MAX_WEIGHTED_SCORE } from '@/lib/clinical-master/types';
import { passMarkFor, fmtMark } from '@/lib/clinical-master/scoring';

/** Below this there is no shape to show, only noise. */
const MIN_POINTS = 4;
/** Most recent N scored cases. */
const WINDOW = 10;
/** Rolling average width — smooths the case-to-case swing without hiding it. */
const SMOOTH = 3;

const VIEW_W = 520;
const VIEW_H = 170;
const PAD_TOP = 24;
const PAD_BOTTOM = 20;
const PAD_X = 14;

interface ScoreTrendProps {
  /** Newest-first, as the history page holds them. */
  sessions: SessionHistoryItem[];
}

/**
 * M4 — "am I getting better?", which a flat list of identical rows cannot answer.
 *
 * Plots the rolling average rather than raw scores: one bad case in an otherwise
 * rising run should not read as a collapse.
 *
 * The headline adapts and the chart does not. An earlier draft hid the chart
 * when the trend was flat or falling, which is worse than unkind — it withholds
 * someone's own data at exactly the moment they most need to see it. So the
 * data always shows; only the framing changes. Rising gets "up X since you
 * started"; anything else gets a neutral title and no verdict, because a
 * candidate can read a downward line perfectly well without being told.
 */
export default function ScoreTrend({ sessions }: ScoreTrendProps) {
  const scored = sessions
    .filter((s) => s.outcome === 'scored')
    .slice(0, WINDOW)
    .reverse(); // oldest → newest, the direction a chart reads

  if (scored.length < MIN_POINTS) return null;

  const maxScore = scored[0]?.maxScore || MAX_WEIGHTED_SCORE;
  const passMark = passMarkFor(maxScore);

  const rolling = scored.map((_, i) => {
    const from = Math.max(0, i - (SMOOTH - 1));
    const slice = scored.slice(from, i + 1);
    return slice.reduce((sum, s) => sum + s.weightedScore, 0) / slice.length;
  });

  const plotW = VIEW_W - PAD_X * 2;
  const plotH = VIEW_H - PAD_TOP - PAD_BOTTOM;
  const x = (i: number) => PAD_X + (rolling.length === 1 ? plotW / 2 : (i / (rolling.length - 1)) * plotW);
  const y = (v: number) => PAD_TOP + (1 - Math.max(0, Math.min(1, v / maxScore))) * plotH;

  const points = rolling.map((v, i) => `${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(' ');
  const passY = y(passMark);

  const delta = rolling[rolling.length - 1] - rolling[0];
  const rising = delta >= 0.3;

  return (
    <div className="mb-5 rounded-xl border border-black/[0.07] bg-surface-raised px-4 py-3.5">
      <div className="mb-3 flex items-baseline justify-between gap-3">
        <div>
          <div className="text-[10px] font-semibold uppercase tracking-[0.13em] text-muted">
            Your last {scored.length} marked cases
          </div>
          <div className="mt-0.5 text-[15px] font-bold text-heading">
            {rising ? `Up ${delta.toFixed(1)} since you started` : 'How your average is moving'}
          </div>
        </div>
        {rising && (
          <span className="font-mono text-[12px] font-bold text-success">&#8599; improving</span>
        )}
      </div>

      <svg
        viewBox={`0 0 ${VIEW_W} ${VIEW_H}`}
        className="block h-auto w-full"
        role="img"
        aria-label={`Rolling average score across your last ${scored.length} marked cases, from ${rolling[0].toFixed(1)} to ${rolling[rolling.length - 1].toFixed(1)} out of ${fmtMark(maxScore)}. The pass mark is ${fmtMark(passMark)}.`}
      >
        <line
          x1="0"
          y1={passY}
          x2={VIEW_W}
          y2={passY}
          stroke="rgba(28,25,23,0.22)"
          strokeWidth="1"
          strokeDasharray="4 4"
        />
        <text x="0" y={passY - 7} fontFamily="JetBrains Mono, monospace" fontSize="10" fill="#8A817A">
          {fmtMark(passMark)} pass mark
        </text>

        <motion.polyline
          points={points}
          fill="none"
          stroke="#B45309"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          initial={{ pathLength: 0, opacity: 0 }}
          animate={{ pathLength: 1, opacity: 1 }}
          transition={{ duration: 1.4, ease: [0.3, 0.7, 0.4, 1] }}
        />

        {rolling.map((v, i) => (
          <motion.circle
            key={scored[i].id}
            cx={x(i)}
            cy={y(v)}
            r={i === rolling.length - 1 ? 4.5 : 3.5}
            fill="#B45309"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.13 + i * 0.09, duration: 0.3 }}
          />
        ))}
      </svg>

      <p className="mt-2 font-mono text-[10px] text-muted">
        Rolling average of your last {SMOOTH}
      </p>
    </div>
  );
}
