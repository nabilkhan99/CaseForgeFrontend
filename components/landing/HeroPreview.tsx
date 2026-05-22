'use client';

import { motion } from 'framer-motion';

interface TimelinePoint {
  label: string;
  value: number;
  height: number;
  current?: boolean;
}

interface DomainGrowth {
  name: string;
  value: number;
  delta: number;
}

const TIMELINE: TimelinePoint[] = [
  { label: 'S1', value: 52, height: 62 },
  { label: 'S2', value: 58, height: 74 },
  { label: 'S3', value: 64, height: 86 },
  { label: 'S4', value: 69, height: 98 },
  { label: 'S5', value: 72, height: 108 },
  { label: 'S6', value: 78, height: 128, current: true },
];

const DOMAINS: DomainGrowth[] = [
  { name: 'Data gathering', value: 82, delta: 14 },
  { name: 'Clinical management', value: 71, delta: 8 },
  { name: 'Relating to others', value: 88, delta: 12 },
];

const WAVE_BARS = [
  18, 42, 28, 64, 22, 78, 40, 92, 30, 58, 18, 48, 70, 26, 52, 84, 34, 62, 20,
  46, 74, 30, 56, 24, 50, 68,
];

export default function HeroPreview() {
  return (
    <motion.div
      initial={{ opacity: 0, y: 32 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.8, delay: 0.35, ease: [0.22, 1, 0.36, 1] }}
      className="relative mx-auto mt-16 sm:mt-20"
      style={{ maxWidth: 880 }}
    >
      <div
        className="relative rounded-[18px] p-3"
        style={{
          background: '#1f1a14',
          boxShadow:
            '0 30px 80px -30px rgba(40,20,4,.55), 0 1px 0 rgba(255,255,255,.05) inset',
        }}
      >
        <div
          className="grid grid-cols-1 md:grid-cols-[36%_1fr] rounded-xl overflow-hidden"
          style={{ background: '#fbf7ee', minHeight: 540 }}
        >
          {/* LEFT — progress dashboard */}
          <div
            className="flex flex-col gap-[18px] p-[22px] md:border-r"
            style={{ background: '#fdf9ef', borderColor: '#ece2cb' }}
          >
            {/* Score hero */}
            <div className="grid grid-cols-[1fr_auto] items-end gap-1.5">
              <div
                className="col-span-2 text-[10.5px] font-medium uppercase tracking-[0.16em]"
                style={{ color: '#7a6a55' }}
              >
                Average score
              </div>
              <div
                className="font-semibold tabular-nums"
                style={{
                  fontFamily:
                    'var(--font-display), ui-sans-serif, system-ui, sans-serif',
                  fontSize: 56,
                  lineHeight: 1,
                  color: '#a8520f',
                  letterSpacing: '-0.03em',
                }}
              >
                78
              </div>
              <div
                className="inline-flex items-center gap-1 px-[9px] py-1 rounded-full text-[12px] font-semibold"
                style={{ background: 'rgba(98,160,74,.14)', color: '#4d7235', marginBottom: 6 }}
              >
                <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="12" y1="19" x2="12" y2="5" />
                  <polyline points="5 12 12 5 19 12" />
                </svg>
                26 pts
              </div>
            </div>

            {/* Score timeline */}
            <div className="flex-1 flex flex-col min-h-0">
              <div
                className="text-[10.5px] font-medium uppercase tracking-[0.16em] mb-2.5"
                style={{ color: '#7a6a55' }}
              >
                Score timeline
              </div>
              <div className="flex-1 grid grid-cols-6 gap-2.5 items-end" style={{ minHeight: 120 }}>
                {TIMELINE.map((p, i) => (
                  <div key={p.label} className="flex flex-col items-center gap-1.5">
                    <span
                      className="text-[11.5px] tabular-nums"
                      style={{
                        color: p.current ? '#a8520f' : '#7a6a55',
                        fontWeight: p.current ? 600 : 400,
                      }}
                    >
                      {p.value}
                    </span>
                    <motion.div
                      initial={{ scaleY: 0 }}
                      animate={{ scaleY: 1 }}
                      transition={{
                        duration: 0.7,
                        delay: 0.6 + i * 0.08,
                        ease: [0.22, 1, 0.36, 1],
                      }}
                      style={{
                        height: p.height,
                        width: '100%',
                        borderRadius: 6,
                        transformOrigin: 'bottom',
                        background: p.current
                          ? 'linear-gradient(180deg, #e88a3a, #c2641c)'
                          : 'linear-gradient(180deg, #f0bf8d, #d9a273)',
                      }}
                    />
                    <span
                      className="text-[10.5px] tracking-[0.05em]"
                      style={{
                        color: p.current ? '#a8520f' : '#7a6a55',
                        fontWeight: p.current ? 600 : 400,
                      }}
                    >
                      {p.label}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* Domain growth */}
            <div className="grid gap-4 mt-auto">
              <div
                className="text-[11px] font-medium uppercase tracking-[0.16em]"
                style={{ color: '#7a6a55' }}
              >
                Domain growth
              </div>
              {DOMAINS.map((d, i) => (
                <div key={d.name} className="grid gap-[7px]">
                  <div className="flex items-baseline justify-between gap-2.5 text-[13px]">
                    <span className="font-medium text-[#1a1612] whitespace-nowrap">
                      {d.name}
                    </span>
                    <span className="inline-flex items-baseline gap-1.5 tabular-nums shrink-0">
                      <span className="font-semibold text-[13.5px] text-[#1a1612]">
                        {d.value}%
                      </span>
                      <span className="text-[12px] font-semibold" style={{ color: '#4d7235' }}>
                        +{d.delta}
                      </span>
                    </span>
                  </div>
                  <div
                    className="h-3 rounded-full overflow-hidden"
                    style={{ background: '#ece2cb' }}
                  >
                    <motion.div
                      initial={{ width: 0 }}
                      animate={{ width: `${d.value}%` }}
                      transition={{
                        duration: 1,
                        delay: 1.1 + i * 0.15,
                        ease: [0.22, 1, 0.36, 1],
                      }}
                      className="h-full rounded-full"
                      style={{
                        background:
                          'linear-gradient(90deg, #b35712, #e88a3a, #f0bf8d)',
                      }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* RIGHT — live consultation */}
          <div className="flex flex-col" style={{ background: '#fdf9ef' }}>
            <div
              className="flex items-center gap-3 px-5 py-4 border-b"
              style={{ borderColor: '#ece2cb' }}
            >
              <div
                className="w-[38px] h-[38px] rounded-full flex items-center justify-center text-[13px] font-semibold"
                style={{
                  background: 'linear-gradient(135deg, #d3711e, #a8520f)',
                  color: '#fff8e9',
                  boxShadow: '0 6px 14px -8px rgba(160,75,15,.5)',
                }}
              >
                JT
              </div>
              <div className="flex-1">
                <div className="text-[14.5px] font-semibold text-[#1a1612]">
                  Jack Thompson
                </div>
              </div>
              <span
                className="inline-flex items-center gap-1.5 text-[11.5px] font-semibold tracking-[0.12em]"
                style={{ color: '#547a3f' }}
              >
                <LivePulseDot />
                LIVE
              </span>
            </div>

            <div className="px-5 pt-3.5 pb-1 text-center">
              <div
                className="text-[11.5px] font-semibold tracking-[0.18em]"
                style={{ color: '#a8520f' }}
              >
                PATIENT SPEAKING
              </div>
            </div>

            {/* Waveform */}
            <div
              className="flex items-center justify-center gap-[3px] px-5 pt-2.5 pb-2"
              style={{ height: 88 }}
              aria-hidden
            >
              {WAVE_BARS.map((h, i) => (
                <motion.span
                  key={i}
                  className="inline-block"
                  style={{
                    width: 3,
                    height: `${h}%`,
                    background: 'linear-gradient(180deg, #e89045, #c2641c)',
                    borderRadius: 2,
                    transformOrigin: 'center',
                  }}
                  animate={{ scaleY: [0.3, 1, 0.3] }}
                  transition={{
                    duration: 1.2,
                    repeat: Infinity,
                    ease: 'easeInOut',
                    delay: (i * 0.08) % 1.2,
                  }}
                />
              ))}
            </div>

            {/* Ripple stage */}
            <div className="relative flex-1 flex items-start justify-center px-5 pt-2" style={{ minHeight: 160 }}>
              {/* Rings */}
              <div className="absolute left-1/2 top-[58px] -translate-x-1/2 -translate-y-1/2 pointer-events-none">
                {[0, 0.8, 1.6, 2.4].map((delay) => (
                  <motion.span
                    key={delay}
                    className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full"
                    style={{ border: '1px solid rgba(194,100,28,.18)' }}
                    initial={{ width: 110, height: 110, opacity: 0.6 }}
                    animate={{ width: 320, height: 320, opacity: 0 }}
                    transition={{
                      duration: 3.2,
                      repeat: Infinity,
                      ease: 'easeOut',
                      delay,
                    }}
                  />
                ))}
              </div>

              <motion.div
                className="relative z-10 flex items-center justify-center text-[20px] font-semibold rounded-full"
                style={{
                  width: 96,
                  height: 96,
                  background: 'linear-gradient(135deg, #d3711e, #a8520f)',
                  color: '#fff8e9',
                  boxShadow: '0 12px 30px -10px rgba(160,75,15,.55)',
                  letterSpacing: '-0.01em',
                }}
                animate={{ y: [0, -8, 0] }}
                transition={{ duration: 2.8, repeat: Infinity, ease: 'easeInOut' }}
              >
                JT
              </motion.div>
            </div>

            {/* Status row */}
            <div
              className="flex items-center justify-between px-5 pb-4 text-[12px] tabular-nums"
              style={{ color: '#7a6a55' }}
            >
              <span className="inline-flex items-center gap-1.5">
                <RecordingDot />
                Recording
              </span>
              <span>03:34 / 12:00</span>
              <span className="font-semibold" style={{ color: '#a8520f' }}>
                70% remaining
              </span>
            </div>

            {/* Controls */}
            <div
              className="grid items-center gap-3 px-4 py-3.5 border-t"
              style={{
                gridTemplateColumns: '1fr auto 1fr',
                borderColor: '#ece2cb',
              }}
            >
              <button
                type="button"
                aria-label="Notes"
                className="w-[46px] h-[46px] rounded-[10px] inline-flex items-center justify-center transition"
                style={{ color: '#a8520f' }}
              >
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                  <polyline points="14 2 14 8 20 8" />
                  <line x1="8" y1="13" x2="16" y2="13" />
                  <line x1="8" y1="17" x2="13" y2="17" />
                </svg>
              </button>
              <button
                type="button"
                aria-label="Mic"
                className="justify-self-center w-[50px] h-[50px] rounded-full inline-flex items-center justify-center"
                style={{
                  background: 'linear-gradient(135deg, #d3711e, #a8520f)',
                  color: '#fff8e9',
                  boxShadow: '0 10px 20px -8px rgba(160,75,15,.55)',
                }}
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3z" />
                  <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
                  <line x1="12" y1="19" x2="12" y2="23" />
                  <line x1="8" y1="23" x2="16" y2="23" />
                </svg>
              </button>
              <button
                type="button"
                className="justify-self-end px-4 py-2.5 rounded-[10px] text-[13px] font-medium"
                style={{
                  background: '#fcecec',
                  color: '#c43c3c',
                  border: '1px solid #f1c8c8',
                }}
              >
                End consultation
              </button>
            </div>
          </div>
        </div>
      </div>
    </motion.div>
  );
}

function LivePulseDot() {
  return (
    <span className="relative inline-flex" style={{ width: 7, height: 7 }}>
      <motion.span
        className="absolute inset-0 rounded-full"
        style={{ background: '#62a04a' }}
        animate={{ boxShadow: ['0 0 0 0 rgba(98,160,74,.55)', '0 0 0 7px rgba(98,160,74,0)', '0 0 0 0 rgba(98,160,74,0)'] }}
        transition={{ duration: 1.4, repeat: Infinity, ease: 'easeOut' }}
      />
    </span>
  );
}

function RecordingDot() {
  return (
    <span className="relative inline-flex" style={{ width: 7, height: 7 }}>
      <motion.span
        className="absolute inset-0 rounded-full"
        style={{ background: '#c43c3c' }}
        animate={{ opacity: [1, 0.5, 1] }}
        transition={{ duration: 1.4, repeat: Infinity, ease: 'easeInOut' }}
      />
    </span>
  );
}
