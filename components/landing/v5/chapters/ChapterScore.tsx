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

const PASS_TEAL = '#0F6E56';
const FAIL_RED = '#D92D20';

export default function ChapterScore() {
  return (
    <div className="flex h-full flex-col p-5 lg:p-6">
      {/* Eyebrow */}
      <div className="text-[10px] font-bold text-primary uppercase tracking-[0.14em] mb-1.5">
        Session Complete
      </div>

      {/* Case title — matches the brief (Jack Thompson ECG request) */}
      <h3 className="text-[17px] font-semibold text-heading leading-[1.3] mb-5">
        A father requests an ECG for his son
      </h3>

      {/* Final verdict */}
      <div
        className="rounded-xl px-4 py-3.5 mb-5"
        style={{ background: 'rgba(180,83,9,0.04)', border: '1px solid rgba(180,83,9,0.12)' }}
      >
        <div className="flex items-baseline justify-between mb-2.5">
          <span className="text-[10px] font-semibold text-muted uppercase tracking-[0.12em]">
            Final Verdict
          </span>
          <span className="font-mono text-[11px] text-muted">Total / 10.5</span>
        </div>
        <div className="flex items-baseline gap-2.5 mb-3">
          <span className="text-[24px] font-bold leading-none" style={{ color: PASS_TEAL }}>
            Bare Pass
          </span>
          <span className="font-mono text-[16px] font-bold text-heading">7</span>
          <span className="font-mono text-[11px] text-muted">/ 10.5</span>
        </div>
        <div className="h-2.5 rounded-full overflow-hidden bg-black/[0.06]">
          <motion.div
            className="h-full rounded-full"
            style={{ background: PASS_TEAL }}
            initial={{ width: 0 }}
            animate={{ width: '67%' }}
            transition={{ type: 'spring', stiffness: 40, damping: 18, delay: 0.3 }}
          />
        </div>
      </div>

      {/* Domain summary — pinned to the bottom of the card */}
      <div className="mt-auto">
        <div className="text-[10px] font-semibold text-muted uppercase tracking-[0.12em] mb-3">
          Domain Score Summary
        </div>
        <div className="flex flex-col gap-4">
          {DOMAINS.map((d, i) => {
            const colour = d.pass ? PASS_TEAL : FAIL_RED;
            return (
              <motion.div
                key={d.label}
                initial={{ opacity: 0, x: -8 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.5 + i * 0.1 }}
              >
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-[12px] text-stone-600 font-medium truncate pr-2">
                    {d.label}
                  </span>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <span className="font-mono text-[11px] font-bold text-heading">{d.score}</span>
                    <span
                      className="px-2 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-wide"
                      style={{
                        background: d.pass ? 'rgba(15,110,86,0.1)' : 'rgba(217,45,32,0.1)',
                        color: colour,
                      }}
                    >
                      {d.pass ? 'Pass' : 'Fail'}
                    </span>
                  </div>
                </div>
                <div className="h-2.5 rounded-full overflow-hidden bg-black/[0.05]">
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
    </div>
  );
}
