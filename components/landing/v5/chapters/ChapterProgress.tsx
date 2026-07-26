'use client';

import { motion } from 'framer-motion';

const SESSIONS = [
  { id: 'S1', title: 'Chest Pain — New Onset', date: '2 weeks ago', score: 52 },
  { id: 'S2', title: 'Child Eczema — Steroid Concerns', date: '12 days ago', score: 58 },
  { id: 'S3', title: 'Low Mood — Work Stress', date: '10 days ago', score: 64 },
  { id: 'S4', title: 'Knee Pain — Sports Injury', date: '1 week ago', score: 69 },
  { id: 'S5', title: 'Breathlessness — Smoker', date: '4 days ago', score: 72 },
  { id: 'S6', title: 'ECG Request — Running Club', date: 'Today', score: 78 },
];

const DOMAINS = [
  { name: 'Data Gathering', current: 82, previous: 68 },
  { name: 'Clinical Management', current: 71, previous: 63 },
  { name: 'Interpersonal Skills', current: 88, previous: 76 },
];

export default function ChapterProgress() {
  return (
    <div className="p-5 lg:p-6">
      {/* Top row: big stat + trend */}
      <div className="flex items-center gap-4 mb-5">
        <div className="flex-1">
          <div className="text-[10px] font-semibold text-muted uppercase tracking-[0.1em] mb-1">
            Average Score
          </div>
          <div className="flex items-end gap-2">
            <motion.span
              className="text-[40px] font-extrabold leading-none"
              style={{
                background: 'linear-gradient(135deg, #B45309, #D97706)',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
                backgroundClip: 'text',
              }}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.2 }}
            >
              78
            </motion.span>
            <motion.span
              className="text-[13px] font-semibold text-success mb-1.5 flex items-center gap-0.5"
              initial={{ opacity: 0, x: -4 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.5 }}
            >
              ↑ 26pts
              <span className="text-[10px] text-muted font-normal ml-1">from first station</span>
            </motion.span>
          </div>
        </div>
        <div className="text-right">
          <div className="text-[10px] font-semibold text-muted uppercase tracking-[0.1em] mb-1">
            Stations completed
          </div>
          <div className="text-[28px] font-bold text-heading leading-none">6</div>
        </div>
      </div>

      {/* Mini score timeline — horizontal bar of session scores */}
      <div className="mb-5">
        <div className="text-[10px] font-semibold text-muted uppercase tracking-[0.1em] mb-3">
          Score Timeline
        </div>
        <div className="flex gap-1.5">
          {SESSIONS.map((s, i) => {
            const height = `${(s.score / 100) * 100}%`;
            const isLatest = i === SESSIONS.length - 1;
            return (
              <motion.div
                key={s.id}
                className="flex-1 flex flex-col items-center gap-1.5"
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.3 + i * 0.08 }}
              >
                <span className={`text-[10px] font-mono ${isLatest ? 'text-primary font-bold' : 'text-muted'}`}>
                  {s.score}
                </span>
                <div className="w-full h-16 bg-black/[0.03] rounded-md overflow-hidden flex items-end">
                  <motion.div
                    className="w-full rounded-md"
                    style={{
                      background: isLatest
                        ? 'linear-gradient(180deg, #B45309, #D97706)'
                        : `rgba(180,83,9,${0.12 + (s.score / 100) * 0.25})`,
                    }}
                    initial={{ height: 0 }}
                    animate={{ height }}
                    transition={{
                      type: 'spring',
                      stiffness: 50,
                      damping: 16,
                      delay: 0.5 + i * 0.1,
                    }}
                  />
                </div>
                <span className={`text-[9px] ${isLatest ? 'text-primary font-semibold' : 'text-muted'}`}>
                  {s.id}
                </span>
              </motion.div>
            );
          })}
        </div>
      </div>

      {/* Domain progress — desktop only */}
      <div className="hidden lg:block">
        <div className="border-t border-black/[0.05] mb-5" />
        <div className="mb-5">
          <div className="text-[10px] font-semibold text-muted uppercase tracking-[0.1em] mb-3">
            Domain Growth
          </div>
          <div className="flex flex-col gap-3">
            {DOMAINS.map((d, i) => (
              <motion.div
                key={d.name}
                initial={{ opacity: 0, x: -8 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.8 + i * 0.1 }}
              >
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-[12px] text-stone-600 font-medium">{d.name}</span>
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] text-muted line-through">{d.previous}%</span>
                    <span className="text-[12px] font-bold text-heading">{d.current}%</span>
                    <span className="text-[10px] font-semibold text-success">
                      +{d.current - d.previous}
                    </span>
                  </div>
                </div>
                <div className="relative h-2.5 bg-black/[0.04] rounded-full overflow-hidden">
                  <div
                    className="absolute h-full rounded-full bg-black/[0.06]"
                    style={{ width: `${d.previous}%` }}
                  />
                  <motion.div
                    className="absolute h-full rounded-full"
                    style={{ background: 'linear-gradient(90deg, #B45309, #F59E0B)' }}
                    initial={{ width: `${d.previous}%` }}
                    animate={{ width: `${d.current}%` }}
                    transition={{
                      type: 'spring',
                      stiffness: 40,
                      damping: 18,
                      delay: 1.0 + i * 0.15,
                    }}
                  />
                </div>
              </motion.div>
            ))}
          </div>
        </div>

      </div>
    </div>
  );
}
