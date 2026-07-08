'use client';

import { motion } from 'framer-motion';

interface Domain {
  label: string;
  score: string;
  pct: number;
  pass: boolean;
}

const DOMAINS: readonly Domain[] = [
  { label: 'Data gathering', score: '2 / 3', pct: 67, pass: true },
  { label: 'Clinical management (weighted)', score: '2.5 / 4.5', pct: 56, pass: false },
  { label: 'Relating to others', score: '2.5 / 3', pct: 83, pass: true },
];

const PASS_GREEN = '#27500A';
const AMBER = '#B45309';

export default function ChapterScore() {
  return (
    <div className="p-5 lg:p-6">
      {/* Eyebrow */}
      <div className="text-[10px] font-bold text-primary uppercase tracking-[0.14em] mb-1.5">
        Session Complete
      </div>

      {/* Case title — matches the brief (Jack Thompson ECG request) */}
      <h3 className="text-[16px] font-semibold text-heading leading-[1.25] mb-4">
        A father requests an ECG for his son who has joined a running club
      </h3>

      {/* Final verdict */}
      <div
        className="rounded-xl px-3.5 py-3 mb-4"
        style={{ background: 'rgba(180,83,9,0.04)', border: '1px solid rgba(180,83,9,0.12)' }}
      >
        <div className="flex items-baseline justify-between mb-2">
          <span className="text-[9px] font-semibold text-muted uppercase tracking-[0.12em]">
            Final Verdict
          </span>
          <span className="font-mono text-[11px] text-muted">Total / 10.5</span>
        </div>
        <div className="flex items-baseline gap-2.5 mb-2.5">
          <span className="text-[22px] font-bold leading-none" style={{ color: PASS_GREEN }}>
            Bare Pass
          </span>
          <span className="font-mono text-[15px] font-bold text-heading">7</span>
          <span className="font-mono text-[11px] text-muted">/ 10.5</span>
        </div>
        <div className="h-1.5 rounded-full overflow-hidden bg-black/[0.06]">
          <motion.div
            className="h-full rounded-full"
            style={{ background: PASS_GREEN }}
            initial={{ width: 0 }}
            animate={{ width: '67%' }}
            transition={{ type: 'spring', stiffness: 40, damping: 18, delay: 0.3 }}
          />
        </div>
        <p className="text-[11px] text-body leading-[1.6] mt-2.5">
          You safely reassured the father and explained the low likelihood of sudden death, but
          could have explored his ideas and concerns more fully before moving to management.
        </p>
      </div>

      {/* Domain summary */}
      <div className="text-[9px] font-semibold text-muted uppercase tracking-[0.12em] mb-2">
        Domain Score Summary
      </div>
      <div className="flex flex-col gap-2">
        {DOMAINS.map((d, i) => {
          const colour = d.pass ? PASS_GREEN : AMBER;
          return (
            <motion.div
              key={d.label}
              initial={{ opacity: 0, x: -8 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.5 + i * 0.1 }}
            >
              <div className="flex items-center justify-between mb-1">
                <span className="text-[11px] text-stone-600 font-medium truncate pr-2">
                  {d.label}
                </span>
                <div className="flex items-center gap-1.5 flex-shrink-0">
                  <span className="font-mono text-[10px] font-bold text-heading">{d.score}</span>
                  <span
                    className="px-1.5 py-0.5 rounded-full text-[8px] font-bold uppercase tracking-wide"
                    style={{
                      background: d.pass ? 'rgba(39,80,10,0.1)' : 'rgba(180,83,9,0.1)',
                      color: colour,
                    }}
                  >
                    {d.pass ? 'Pass' : 'Fail'}
                  </span>
                </div>
              </div>
              <div className="h-1.5 rounded-full overflow-hidden bg-black/[0.05]">
                <motion.div
                  className="h-full rounded-full"
                  style={{ background: colour }}
                  initial={{ width: 0 }}
                  animate={{ width: `${d.pct}%` }}
                  transition={{ type: 'spring', stiffness: 40, damping: 18, delay: 0.6 + i * 0.12 }}
                />
              </div>
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}
